import { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import { randomUUID } from 'crypto'
import { verifyAccessToken } from './lib/jwt'
import { placeBet, cancelBet } from './services/bet.service'
import { prisma } from './lib/prisma'
import { Choice } from '@prisma/client'

let io: Server

// ── Bet đã tạo (từ placeBet) → phát cho tất cả (dùng chung người thật + bot) ──
type CreatedBet = {
  id: string; userId: string; roundId: string; choice: Choice; amount: bigint; createdAt: Date
  user: { username: string }
}
export function broadcastNewBet(bet: CreatedBet): void {
  io?.emit('bet:feed', {
    betId: bet.id,
    userId: bet.userId,
    username: bet.user.username,
    choice: bet.choice,
    amount: bet.amount.toString(),
    createdAt: bet.createdAt,
    roundId: bet.roundId,
  })
  void emitStats()
}

// ── Chat trực tiếp (tạm thời, giữ trong RAM ~50 tin gần nhất) ──
interface ChatMsg { id: string; userId: string; username: string; text: string; createdAt: string }
const chatBuffer: ChatMsg[] = []
const CHAT_MAX = 50
const lastChatAt = new Map<string, number>()

export function pushChat(username: string, text: string, userId = ''): void {
  const msg: ChatMsg = { id: randomUUID(), userId, username, text, createdAt: new Date().toISOString() }
  chatBuffer.push(msg)
  if (chatBuffer.length > CHAT_MAX) chatBuffer.shift()
  io?.emit('chat:message', msg)
}

// Đếm user online (mỗi userId có thể mở nhiều tab → đếm số kết nối)
const onlineUsers = new Map<string, number>()
export function getOnlineCount(): number { return onlineUsers.size }

export async function getTotalBettors(): Promise<number> {
  const rows = await prisma.bet.findMany({ distinct: ['userId'], select: { userId: true } })
  return rows.length
}

export async function emitStats(): Promise<void> {
  if (!io) return
  const totalBettors = await getTotalBettors()
  io.emit('stats:update', { online: onlineUsers.size, totalBettors })
}

export function initSocket(httpServer: HttpServer): Server {
  const allowedOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:3000')
    .split(',').map(s => s.trim())

  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true)
        const ok = allowedOrigins.includes(origin) || origin.includes('ngrok')
        ok ? cb(null, true) : cb(new Error('CORS blocked'))
      },
      credentials: true,
    },
  })

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error('Authentication required'))
    try {
      const payload = verifyAccessToken(token)
      socket.data.userId = payload.userId
      socket.data.role = payload.role
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', async (socket: Socket) => {
    const userId = socket.data.userId as string
    socket.join(`user:${userId}`)

    // Online tracking
    onlineUsers.set(userId, (onlineUsers.get(userId) ?? 0) + 1)
    void emitStats()

    // Gửi lịch sử chat gần đây cho người vừa vào
    socket.emit('chat:history', chatBuffer)

    socket.on('chat:send', async ({ text }: { text: string }) => {
      try {
        const t = (text || '').trim()
        if (!t) return
        const now = Date.now()
        if (now - (lastChatAt.get(userId) ?? 0) < 1500) {
          socket.emit('chat:error', { error: 'Gửi chậm lại một chút' }); return
        }
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true, username: true } })
        if (!user || user.status !== 'ACTIVE') {
          socket.emit('chat:error', { error: 'Tài khoản chưa được duyệt' }); return
        }
        lastChatAt.set(userId, now)
        pushChat(user.username, t.slice(0, 200), userId)
      } catch { /* bỏ qua */ }
    })

    socket.on('chat:delete', ({ id }: { id: string }) => {
      if (socket.data.role !== 'ADMIN') return
      const idx = chatBuffer.findIndex(m => m.id === id)
      if (idx >= 0) chatBuffer.splice(idx, 1)
      io.emit('chat:remove', { id })
    })

    socket.on('bet:place', async (data: { roundId: string; choice: string; amount: string }) => {
      try {
        // Check user status
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } })
        if (user?.status !== 'ACTIVE') {
          socket.emit('bet:error', { error: 'Tài khoản chưa được duyệt' })
          return
        }

        const choice = data.choice as Choice
        if (!['T', 'X'].includes(choice)) {
          socket.emit('bet:error', { error: 'Lựa chọn không hợp lệ' })
          return
        }
        const amount = BigInt(data.amount)
        const bet = await placeBet(userId, data.roundId, choice, amount)

        const updated = await prisma.user.findUnique({ where: { id: userId }, select: { energy: true } })
        if (updated) {
          io.to(`user:${userId}`).emit('user:energy:update', { energy: updated.energy.toString() })
        }

        socket.emit('bet:confirmed', { choice: bet.choice, amount: bet.amount.toString() })

        broadcastNewBet(bet as unknown as CreatedBet)
      } catch (err: unknown) {
        socket.emit('bet:error', { error: err instanceof Error ? err.message : 'Đặt cược thất bại' })
      }
    })

    socket.on('bet:cancel', async (data: { betId: string }) => {
      try {
        const bet = await cancelBet(userId, data.betId)
        const updated = await prisma.user.findUnique({ where: { id: userId }, select: { energy: true } })
        if (updated) {
          io.to(`user:${userId}`).emit('user:energy:update', { energy: updated.energy.toString() })
        }
        io.emit('bet:feed:remove', { betId: bet.id, roundId: bet.roundId })
        socket.emit('bet:cancel:confirmed', { betId: bet.id, amount: bet.amount.toString() })
        void emitStats()
      } catch (err: unknown) {
        socket.emit('bet:error', { error: err instanceof Error ? err.message : 'Hủy thất bại' })
      }
    })

    socket.on('disconnect', () => {
      const n = (onlineUsers.get(userId) ?? 1) - 1
      if (n <= 0) onlineUsers.delete(userId)
      else onlineUsers.set(userId, n)
      void emitStats()
    })
  })

  return io
}

export function getIo(): Server {
  if (!io) throw new Error('Socket.io not initialized')
  return io
}

export function emitRoundState(round: object): void {
  io?.emit('round:state', round)
}

export function emitRoundResult(payload: { roundId: string; result: string; coefficient: string }): void {
  io?.emit('round:result', payload)
}

export function emitEnergyUpdate(userId: string, energy: string): void {
  io?.to(`user:${userId}`).emit('user:energy:update', { energy })
}

export function emitCountdown(payload: { roundId: string; seconds: number }): void {
  io?.emit('round:countdown', payload)
}
