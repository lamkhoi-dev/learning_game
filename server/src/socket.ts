import { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import { verifyAccessToken } from './lib/jwt'
import { placeBet, cancelBet } from './services/bet.service'
import { prisma } from './lib/prisma'
import { Choice } from '@prisma/client'

let io: Server

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

        io.emit('bet:feed', {
          betId: bet.id,
          userId: userId,
          username: (bet as unknown as { user: { username: string } }).user.username,
          choice: bet.choice,
          amount: bet.amount.toString(),
          createdAt: bet.createdAt,
          roundId: data.roundId,
        })
        void emitStats()
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
