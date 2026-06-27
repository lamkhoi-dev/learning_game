import { Choice } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { writeAudit } from './audit.service'
import { emitRoundState, emitRoundResult, emitCountdown } from '../socket'

// Round tự OPEN ngay khi tạo — không cần bước mở thủ công
export async function createRound(adminId: string, coefficient: number, ip?: string) {
  const round = await prisma.round.create({
    data: {
      coefficient,
      createdById: adminId,
      status: 'OPEN',
      openedAt: new Date(),
    },
  })
  await writeAudit({
    adminId,
    action: 'ROUND_CREATED',
    entityType: 'Round',
    entityId: round.id,
    newValue: { coefficient },
    ipAddress: ip,
  })
  return round
}

// Admin chọn kết quả → khoá → đếm ngược 5s → phát kết quả → tự tạo round mới
export async function lockAndPickResult(roundId: string, result: Choice, adminId: string, ip?: string) {
  const round = await prisma.round.findUnique({ where: { id: roundId } })
  if (!round) throw new Error('Round không tồn tại')
  if (round.status !== 'OPEN') throw new Error('Round phải đang OPEN mới khoá được')

  const locked = await prisma.round.update({
    where: { id: roundId },
    data: { status: 'LOCKED', lockedAt: new Date() },
  })

  await writeAudit({ adminId, action: 'ROUND_LOCKED', entityType: 'Round', entityId: roundId, ipAddress: ip })

  emitRoundState({ ...locked, coefficient: locked.coefficient.toString() })
  emitCountdown({ roundId, seconds: 5 })

  // Sau 5s: trả kết quả + tự tạo round mới cùng hệ số
  setTimeout(async () => {
    try {
      const final = await setResult(roundId, result, adminId, ip)
      if (final) {
        emitRoundState({ ...final, coefficient: final.coefficient.toString() })
        emitRoundResult({ roundId: final.id, result: final.result!, coefficient: final.coefficient.toString() })
      }

      // Tự tạo round mới ngay sau đó (cùng hệ số)
      const next = await createRound(adminId, Number(round.coefficient), ip)
      emitRoundState({ ...next, coefficient: next.coefficient.toString() })
    } catch (err) {
      console.error('Auto-result / auto-next round failed:', err)
    }
  }, 5000)

  return locked
}

export async function setResult(roundId: string, result: Choice, adminId: string, ip?: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { bets: true },
  })
  if (!round) throw new Error('Round không tồn tại')
  if (round.status !== 'LOCKED') throw new Error('Round phải ở trạng thái LOCKED')

  const coefficient = Number(round.coefficient)

  await prisma.$transaction(async (tx) => {
    for (const bet of round.bets) {
      if (bet.choice === result) {
        const payout = BigInt(Math.floor(Number(bet.amount) * coefficient))
        await tx.bet.update({ where: { id: bet.id }, data: { status: 'WIN', payout } })
        await tx.user.update({ where: { id: bet.userId }, data: { energy: { increment: payout } } })
      } else {
        await tx.bet.update({ where: { id: bet.id }, data: { status: 'LOSE' } })
      }
    }
    await tx.round.update({
      where: { id: roundId },
      data: { status: 'RESULT', result, resultAt: new Date() },
    })
  })

  // Push energy update tới từng người thắng
  const winBets = round.bets.filter((b) => b.choice === result)
  for (const bet of winBets) {
    const user = await prisma.user.findUnique({ where: { id: bet.userId }, select: { energy: true } })
    if (user) {
      const { emitEnergyUpdate } = await import('../socket')
      emitEnergyUpdate(bet.userId, user.energy.toString())
    }
  }

  const updated = await prisma.round.findUnique({ where: { id: roundId } })
  await writeAudit({
    adminId,
    action: 'ROUND_RESULT_SET',
    entityType: 'Round',
    entityId: roundId,
    newValue: { result, coefficient },
    ipAddress: ip,
  })
  return updated
}

export async function getCurrentRound() {
  return prisma.round.findFirst({
    where: { status: { in: ['WAITING', 'OPEN', 'LOCKED'] } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getRounds(page: number, limit: number) {
  const [rounds, total] = await Promise.all([
    prisma.round.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { bets: true } } },
    }),
    prisma.round.count(),
  ])
  return { rounds, total, page, limit }
}
