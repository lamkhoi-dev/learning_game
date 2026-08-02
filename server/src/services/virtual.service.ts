import { Choice } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { placeBet } from './bet.service'
import { broadcastNewBet, pushChat } from '../socket'

const NAMES = ['Minh', 'Hùng', 'Trang', 'Long', 'Hoa', 'Nam', 'Tú', 'Linh', 'Khoa', 'Dũng',
  'Vy', 'An', 'Bảo', 'Thảo', 'Phúc', 'Quân', 'Hà', 'Sơn', 'Ngọc', 'Tài', 'Đạt', 'Huy', 'Mai', 'Phong']

const CHAT_LINES = ['vào ₮ nào ae', 'Ӿ ăn chắc', 'theo cầu ₮', 'đỏ quá 😤', 'all in ₮', 'Ӿ đi mọi người',
  'lần này ăn to', 'soi cầu ra ₮', 'max Ӿ luôn', 'gỡ nào ae', 'ăn dày 🔥', 'theo nhà cái']

function randInt(min: number, max: number): number {
  if (max < min) [min, max] = [max, min]
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ── Tạo bot ──
export async function createVirtualPlayers(count: number, energy: number) {
  const n = Math.max(1, Math.min(count, 100))
  const created: string[] = []
  for (let i = 0; i < n; i++) {
    // thử vài lần để tránh trùng username/phone
    for (let attempt = 0; attempt < 6; attempt++) {
      const username = `${NAMES[randInt(0, NAMES.length - 1)]}${randInt(10, 99999)}`
      const phone = `bot${randInt(100000000, 999999999)}`
      try {
        await prisma.user.create({
          data: {
            username, phone, passwordHash: '!', role: 'USER', status: 'ACTIVE',
            energy: BigInt(Math.max(0, energy || 1_000_000)),
            isVirtual: true, botSide: 'RANDOM', botMin: 100, botMax: 1000, botAuto: false, botChat: false,
          },
        })
        created.push(username)
        break
      } catch { /* trùng → thử lại */ }
    }
  }
  return { created: created.length }
}

export async function listVirtualPlayers() {
  const bots = await prisma.user.findMany({
    where: { isVirtual: true },
    select: { id: true, username: true, energy: true, botSide: true, botMin: true, botMax: true, botAuto: true, botChat: true },
    orderBy: { createdAt: 'desc' },
  })
  return bots.map(b => ({ ...b, energy: b.energy.toString() }))
}

export async function deleteVirtualPlayer(id: string) {
  const bot = await prisma.user.findUnique({ where: { id } })
  if (!bot || !bot.isVirtual) throw new Error('Không tìm thấy bot')
  await prisma.$transaction([
    prisma.bet.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ])
  return { ok: true }
}

export async function updateBotConfig(id: string, cfg: {
  side?: string; min?: number; max?: number; auto?: boolean; chat?: boolean; energy?: number
}) {
  const bot = await prisma.user.findUnique({ where: { id } })
  if (!bot || !bot.isVirtual) throw new Error('Không tìm thấy bot')
  const data: Record<string, unknown> = {}
  if (cfg.side !== undefined) data.botSide = cfg.side
  if (cfg.min !== undefined) data.botMin = Math.max(0, cfg.min)
  if (cfg.max !== undefined) data.botMax = Math.max(0, cfg.max)
  if (cfg.auto !== undefined) data.botAuto = cfg.auto
  if (cfg.chat !== undefined) data.botChat = cfg.chat
  if (cfg.energy !== undefined) data.energy = BigInt(Math.max(0, cfg.energy))
  const updated = await prisma.user.update({
    where: { id }, data,
    select: { id: true, username: true, energy: true, botSide: true, botMin: true, botMax: true, botAuto: true, botChat: true },
  })
  return { ...updated, energy: updated.energy.toString() }
}

// ── Đặt 1 lệnh cho bot (dùng chung placeBet + broadcast) ──
type BotRow = { id: string; username: string; botSide: string | null; botMin: number; botMax: number; botChat: boolean }

async function placeBotBet(bot: BotRow, roundId: string, choice: Choice, amount: number) {
  try {
    const bet = await placeBet(bot.id, roundId, choice, BigInt(amount))
    broadcastNewBet(bet as unknown as Parameters<typeof broadcastNewBet>[0])
    if (bot.botChat && Math.random() < 0.35) {
      pushChat(bot.username, CHAT_LINES[randInt(0, CHAT_LINES.length - 1)], bot.id)
    }
  } catch { /* phiên đóng / hết chíp → bỏ qua */ }
}

function pickSide(pref: string | null): Choice {
  if (pref === 'T' || pref === 'X') return pref
  return Math.random() < 0.5 ? 'T' : 'X'
}

// ── Bot tự đặt khi phiên mới mở ──
export async function autoPlayForRound(roundId: string) {
  const bots = await prisma.user.findMany({
    where: { isVirtual: true, botAuto: true },
    select: { id: true, username: true, botSide: true, botMin: true, botMax: true, botChat: true },
  })
  for (const bot of bots) {
    const delay = randInt(500, 8000) // rải tự nhiên trong ~8s
    setTimeout(() => {
      const min = bot.botMin > 0 ? bot.botMin : 100
      const max = bot.botMax > 0 ? bot.botMax : 1000
      void placeBotBet(bot, roundId, pickSide(bot.botSide), randInt(min, max))
    }, delay)
  }
}

// ── Rải cược hàng loạt (thủ công) vào phiên đang mở ──
export async function scatterBets(opts: {
  count: number; ratioT: number; min: number; max: number; spreadSeconds: number
}) {
  const round = await prisma.round.findFirst({ where: { status: 'OPEN', paused: false }, orderBy: { createdAt: 'desc' } })
  if (!round) throw new Error('Không có phiên đang mở để rải cược')

  const bots = await prisma.user.findMany({
    where: { isVirtual: true },
    select: { id: true, username: true, botSide: true, botMin: true, botMax: true, botChat: true },
  })
  if (bots.length === 0) throw new Error('Chưa có bot nào — hãy tạo bot trước')

  const count = Math.max(1, Math.min(opts.count || bots.length, bots.length))
  // xáo trộn rồi lấy `count` bot
  const shuffled = [...bots].sort(() => Math.random() - 0.5).slice(0, count)
  const spreadMs = Math.max(0, (opts.spreadSeconds || 0)) * 1000
  const min = Math.max(1, opts.min || 100)
  const max = Math.max(min, opts.max || 1000)
  const ratioT = Math.max(0, Math.min(opts.ratioT ?? 50, 100))

  for (const bot of shuffled) {
    const delay = spreadMs > 0 ? randInt(0, spreadMs) : 0
    setTimeout(() => {
      const choice: Choice = Math.random() * 100 < ratioT ? 'T' : 'X'
      void placeBotBet(bot, round.id, choice, randInt(min, max))
    }, delay)
  }
  return { scheduled: shuffled.length, roundId: round.id }
}
