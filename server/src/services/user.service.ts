import { Role } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { writeAudit } from './audit.service'
import { emitEnergyUpdate } from '../socket'

// Xóa tài khoản người dùng (kèm xóa toàn bộ lệnh cược của họ)
export async function deleteUser(targetId: string, adminId: string, ip?: string) {
  if (targetId === adminId) throw new Error('Không thể tự xóa chính mình')
  const user = await prisma.user.findUnique({ where: { id: targetId } })
  if (!user) throw new Error('Không tìm thấy người dùng')
  if (user.role === 'ADMIN') throw new Error('Hãy hạ quyền admin trước khi xóa')

  await prisma.$transaction([
    prisma.bet.deleteMany({ where: { userId: targetId } }),
    prisma.user.delete({ where: { id: targetId } }),
  ])

  await writeAudit({
    adminId,
    action: 'USER_DELETED',
    entityType: 'User',
    entityId: targetId,
    newValue: { username: user.username, phone: user.phone },
    ipAddress: ip,
  })

  return { ok: true, username: user.username }
}

export async function setUserEnergy(targetId: string, energy: number, adminId: string, ip?: string) {
  const user = await prisma.user.findUnique({ where: { id: targetId } })
  if (!user) throw new Error('User not found')

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { energy: BigInt(energy) },
    select: { id: true, username: true, energy: true, role: true },
  })

  emitEnergyUpdate(targetId, updated.energy.toString())

  await writeAudit({
    adminId,
    action: 'USER_ENERGY_SET',
    entityType: 'User',
    entityId: targetId,
    oldValue: { energy: user.energy.toString() },
    newValue: { energy: energy.toString() },
    ipAddress: ip,
  })

  return { ...updated, energy: updated.energy.toString() }
}

export async function setUserRole(targetId: string, role: Role, adminId: string, ip?: string) {
  const user = await prisma.user.findUnique({ where: { id: targetId } })
  if (!user) throw new Error('User not found')

  // Không cho tự hạ quyền chính mình (tránh khoá hết admin)
  if (targetId === adminId && role !== 'ADMIN') throw new Error('Không thể tự hạ quyền chính mình')

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { role },
    select: { id: true, username: true, role: true },
  })

  await writeAudit({
    adminId,
    action: role === 'ADMIN' ? 'USER_ROLE_PROMOTED' : 'USER_ROLE_DEMOTED',
    entityType: 'User',
    entityId: targetId,
    oldValue: { role: user.role },
    newValue: { role },
    ipAddress: ip,
  })

  return updated
}

export async function listUsers(page: number, limit: number, search?: string, status?: string) {
  const where: Record<string, unknown> = {}
  if (search) where.OR = [{ username: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }]
  if (status) where.status = status

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, username: true, phone: true, energy: true, role: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ])

  return {
    users: users.map((u) => ({ ...u, energy: u.energy.toString() })),
    total,
    page,
    limit,
  }
}
