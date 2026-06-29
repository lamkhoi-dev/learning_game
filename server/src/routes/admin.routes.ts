import { Router, Response } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.middleware'
import { adminMiddleware } from '../middleware/admin.middleware'
import { AuthRequest } from '../types'
import { createRound, lockAndPickResult, getRounds } from '../services/round.service'
import { listUsers, setUserEnergy, setUserRole, deleteUser } from '../services/user.service'
import { cancelBetAdmin, editBetAmount } from '../services/bet.service'
import { prisma } from '../lib/prisma'
import { emitRoundState, emitEnergyUpdate, getIo } from '../socket'
import { Choice, Role } from '@prisma/client'
import { writeAudit } from '../services/audit.service'

const router = Router()
router.use(authMiddleware, adminMiddleware)

const getIp = (req: AuthRequest) => req.ip ?? req.socket?.remoteAddress

// Dashboard
router.get('/dashboard', async (_req, res: Response): Promise<void> => {
  const [activeRound, totalBetsToday, totalUsers, pendingUsers] = await Promise.all([
    prisma.round.findFirst({
      where: { status: { in: ['WAITING', 'OPEN', 'LOCKED'] } },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { bets: true } } },
    }),
    prisma.bet.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    prisma.user.count({ where: { role: 'USER' } }),
    prisma.user.count({ where: { role: 'USER', status: 'PENDING' } }),
  ])
  res.json({
    activeRound: activeRound ? { ...activeRound, coefficient: activeRound.coefficient.toString() } : null,
    totalBetsToday,
    totalUsers,
    pendingUsers,
  })
})

// Rounds
router.get('/rounds', async (req, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  res.json(await getRounds(page, limit))
})

router.post('/rounds', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({ coefficient: z.number().positive() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Hệ số không hợp lệ' }); return }
  try {
    const round = await createRound(req.user!.userId, parsed.data.coefficient, getIp(req))
    emitRoundState({ ...round, coefficient: round.coefficient.toString() })
    res.status(201).json({ ...round, coefficient: round.coefficient.toString() })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Thất bại' })
  }
})

// Bets for a round (live view)
router.get('/rounds/:id/bets', async (req, res: Response): Promise<void> => {
  const bets = await prisma.bet.findMany({
    where: { roundId: req.params.id },
    include: { user: { select: { username: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(bets.map(b => ({
    betId: b.id,
    userId: b.userId,
    username: (b as unknown as { user: { username: string } }).user.username,
    choice: b.choice,
    amount: b.amount.toString(),
    createdAt: b.createdAt,
    roundId: b.roundId,
  })))
})

// Admin cancel a user's bet
router.delete('/bets/:betId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bet = await cancelBetAdmin(req.params.betId)
    // Refund energy to user via socket
    const updated = await prisma.user.findUnique({ where: { id: bet.userId }, select: { energy: true } })
    if (updated) {
      emitEnergyUpdate(bet.userId, updated.energy.toString())
    }
    getIo().emit('bet:feed:remove', { betId: bet.id, roundId: bet.roundId })
    await writeAudit({
      adminId: req.user!.userId,
      action: 'BET_CANCELLED_BY_ADMIN',
      entityType: 'Bet',
      entityId: bet.id,
      newValue: { userId: bet.userId, amount: bet.amount.toString() },
      ipAddress: getIp(req),
    })
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Thất bại' })
  }
})

// Admin sửa số chíp của 1 lệnh
router.put('/bets/:betId', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({ amount: z.number().int().positive() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Số chíp không hợp lệ' }); return }
  try {
    const bet = await editBetAmount(req.params.betId, BigInt(parsed.data.amount))
    const updated = await prisma.user.findUnique({ where: { id: bet.userId }, select: { energy: true } })
    if (updated) emitEnergyUpdate(bet.userId, updated.energy.toString())
    getIo().emit('bet:feed:update', { betId: bet.id, amount: bet.amount.toString(), roundId: bet.roundId })
    await writeAudit({
      adminId: req.user!.userId,
      action: 'BET_EDITED_BY_ADMIN',
      entityType: 'Bet',
      entityId: bet.id,
      newValue: { userId: bet.userId, amount: bet.amount.toString() },
      ipAddress: getIp(req),
    })
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Thất bại' })
  }
})

// Khóa / mở phòng tạm thời (ngừng/tiếp tục nhận cược)
router.put('/rounds/:id/pause', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({ paused: z.boolean() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Tham số không hợp lệ' }); return }
  try {
    const round = await prisma.round.findUnique({ where: { id: req.params.id } })
    if (!round) { res.status(404).json({ error: 'Không tìm thấy phiên' }); return }
    if (round.status !== 'OPEN') { res.status(400).json({ error: 'Chỉ khóa/mở khi phiên đang mở' }); return }

    const updated = await prisma.round.update({
      where: { id: req.params.id },
      data: { paused: parsed.data.paused },
    })
    emitRoundState({ ...updated, coefficient: updated.coefficient.toString() })
    await writeAudit({
      adminId: req.user!.userId,
      action: parsed.data.paused ? 'ROUND_PAUSED' : 'ROUND_RESUMED',
      entityType: 'Round',
      entityId: req.params.id,
      ipAddress: getIp(req),
    })
    res.json({ ...updated, coefficient: updated.coefficient.toString() })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Thất bại' })
  }
})

// Chỉnh hệ số của phiên đang mở
router.put('/rounds/:id/coefficient', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({ coefficient: z.number().positive() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Hệ số không hợp lệ' }); return }
  try {
    const round = await prisma.round.findUnique({ where: { id: req.params.id } })
    if (!round) { res.status(404).json({ error: 'Không tìm thấy phiên' }); return }
    if (round.status !== 'OPEN') { res.status(400).json({ error: 'Chỉ chỉnh hệ số khi phiên đang mở' }); return }

    const updated = await prisma.round.update({
      where: { id: req.params.id },
      data: { coefficient: parsed.data.coefficient },
    })
    emitRoundState({ ...updated, coefficient: updated.coefficient.toString() })
    await writeAudit({
      adminId: req.user!.userId,
      action: 'ROUND_COEFFICIENT_SET',
      entityType: 'Round',
      entityId: req.params.id,
      oldValue: { coefficient: round.coefficient.toString() },
      newValue: { coefficient: updated.coefficient.toString() },
      ipAddress: getIp(req),
    })
    res.json({ ...updated, coefficient: updated.coefficient.toString() })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Thất bại' })
  }
})

// Lock + pick result in one action — triggers 5s countdown then auto-reveals
router.put('/rounds/:id/lock-and-result', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({ result: z.enum(['T', 'X']) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Kết quả phải là T hoặc X' }); return }
  try {
    const round = await lockAndPickResult(req.params.id, parsed.data.result as Choice, req.user!.userId, getIp(req))
    res.json({ ...round, coefficient: round.coefficient.toString() })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Thất bại' })
  }
})

// Users
router.get('/users', async (req, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const search = req.query.search as string | undefined
  const status = req.query.status as string | undefined
  res.json(await listUsers(page, limit, search, status))
})

router.get('/users/pending', async (_req, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    where: { status: 'PENDING', role: 'USER' },
    select: { id: true, username: true, phone: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  res.json(users)
})

router.put('/users/:id/approve', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!user) { res.status(404).json({ error: 'User không tồn tại' }); return }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE' },
      select: { id: true, username: true, status: true },
    })
    await writeAudit({
      adminId: req.user!.userId,
      action: 'USER_APPROVED',
      entityType: 'User',
      entityId: req.params.id,
      oldValue: { status: 'PENDING' },
      newValue: { status: 'ACTIVE' },
      ipAddress: getIp(req),
    })
    res.json(updated)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Thất bại' })
  }
})

router.put('/users/:id/reject', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updated = await prisma.user.delete({ where: { id: req.params.id } })
    await writeAudit({
      adminId: req.user!.userId,
      action: 'USER_REJECTED',
      entityType: 'User',
      entityId: req.params.id,
      newValue: { username: updated.username },
      ipAddress: getIp(req),
    })
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Thất bại' })
  }
})

router.put('/users/:id/energy', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({ energy: z.number().int().min(0) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Năng lượng phải là số nguyên không âm' }); return }
  try {
    const user = await setUserEnergy(req.params.id, parsed.data.energy, req.user!.userId, getIp(req))
    res.json(user)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Thất bại' })
  }
})

router.put('/users/:id/role', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({ role: z.enum(['ADMIN', 'USER']) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Role không hợp lệ' }); return }
  try {
    const user = await setUserRole(req.params.id, parsed.data.role as Role, req.user!.userId, getIp(req))
    res.json(user)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Thất bại' })
  }
})

// Settings — đổi tên thương hiệu
router.get('/settings', async (_req, res: Response): Promise<void> => {
  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  res.json({ brandName: settings?.brandName ?? 'VOID PROTOCOL' })
})

router.put('/settings', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({ brandName: z.string().min(1).max(40) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Tên thương hiệu không hợp lệ (1-40 ký tự)' }); return }
  try {
    const old = await prisma.settings.findUnique({ where: { id: 'singleton' } })
    const updated = await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: { brandName: parsed.data.brandName },
      create: { id: 'singleton', brandName: parsed.data.brandName },
    })
    await writeAudit({
      adminId: req.user!.userId,
      action: 'SETTINGS_UPDATED',
      entityType: 'Settings',
      entityId: 'singleton',
      oldValue: { brandName: old?.brandName ?? null },
      newValue: { brandName: updated.brandName },
      ipAddress: getIp(req),
    })
    res.json({ brandName: updated.brandName })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Thất bại' })
  }
})

// Xóa tài khoản người dùng
router.delete('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await deleteUser(req.params.id, req.user!.userId, getIp(req))
    res.json(result)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Thất bại' })
  }
})

// Audit log
router.get('/audit', async (req, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 30
  const { adminId, action, from, to } = req.query as Record<string, string | undefined>

  const where: Record<string, unknown> = {}
  if (adminId) where.adminId = adminId
  if (action) where.action = action
  if (from || to) where.createdAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { admin: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ])
  res.json({ logs, total, page, limit })
})

export default router
