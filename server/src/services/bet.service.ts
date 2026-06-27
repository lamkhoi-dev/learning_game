import { Choice } from '@prisma/client'
import { prisma } from '../lib/prisma'

export async function placeBet(userId: string, roundId: string, choice: Choice, amount: bigint) {
  const round = await prisma.round.findUnique({ where: { id: roundId } })
  if (!round) throw new Error('Round not found')
  if (round.status !== 'OPEN') throw new Error('Betting is not open')

  // Cho phép đặt nhiều lệnh / cả 2 bên trong cùng 1 phiên (không chặn lệnh trùng)
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  if (user.energy < amount) throw new Error('Insufficient energy')
  if (amount <= BigInt(0)) throw new Error('Bet amount must be positive')

  const [bet] = await prisma.$transaction([
    prisma.bet.create({
      data: { userId, roundId, choice, amount },
      include: { user: { select: { username: true } } },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { energy: { decrement: amount } },
    }),
  ])

  return bet
}

export async function getUserBetForRound(userId: string, roundId: string) {
  return prisma.bet.findFirst({ where: { userId, roundId } })
}

// Admin sửa số chíp của 1 lệnh (chỉ khi phiên đang mở). Tự cộng/trừ chênh lệch cho người chơi.
export async function editBetAmount(betId: string, newAmount: bigint) {
  if (newAmount <= BigInt(0)) throw new Error('Số chíp phải lớn hơn 0')
  const bet = await prisma.bet.findUnique({ where: { id: betId }, include: { round: true } })
  if (!bet) throw new Error('Không tìm thấy lệnh đặt cược')
  if (bet.round.status !== 'OPEN') throw new Error('Chỉ sửa được khi phiên đang mở')
  if (bet.status !== 'PENDING') throw new Error('Không thể sửa lệnh này')

  const delta = newAmount - bet.amount // >0: trừ thêm chíp; <0: hoàn lại
  if (delta > BigInt(0)) {
    const user = await prisma.user.findUnique({ where: { id: bet.userId } })
    if (!user || user.energy < delta) throw new Error('Người chơi không đủ chíp')
  }

  await prisma.$transaction([
    prisma.bet.update({ where: { id: betId }, data: { amount: newAmount } }),
    prisma.user.update({ where: { id: bet.userId }, data: { energy: { decrement: delta } } }),
  ])

  return { id: bet.id, userId: bet.userId, roundId: bet.roundId, amount: newAmount }
}

export async function cancelBetAdmin(betId: string) {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    include: { round: true },
  })
  if (!bet) throw new Error('Lệnh đặt không tồn tại')
  if (bet.round.status !== 'OPEN') throw new Error('Chỉ có thể huỷ khi round đang mở')
  if (bet.status !== 'PENDING') throw new Error('Không thể huỷ lệnh này')

  await prisma.$transaction([
    prisma.bet.delete({ where: { id: betId } }),
    prisma.user.update({ where: { id: bet.userId }, data: { energy: { increment: bet.amount } } }),
  ])

  return bet
}

// Người chơi tự hủy 1 lệnh cụ thể của mình (theo betId)
export async function cancelBet(userId: string, betId: string) {
  const bet = await prisma.bet.findUnique({ where: { id: betId }, include: { round: true } })
  if (!bet) throw new Error('Không tìm thấy lệnh đặt cược')
  if (bet.userId !== userId) throw new Error('Không phải lệnh của bạn')
  if (bet.round.status !== 'OPEN') throw new Error('Chỉ có thể hủy khi phiên đang mở')
  if (bet.status !== 'PENDING') throw new Error('Không thể hủy lệnh này')

  await prisma.$transaction([
    prisma.bet.delete({ where: { id: bet.id } }),
    prisma.user.update({ where: { id: userId }, data: { energy: { increment: bet.amount } } }),
  ])

  return bet
}
