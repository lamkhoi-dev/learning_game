import { Router, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { AuthRequest } from '../types'
import { getCurrentRound, getRounds } from '../services/round.service'
import { getUserBetForRound } from '../services/bet.service'
import { prisma } from '../lib/prisma'
import { getOnlineCount, getTotalBettors } from '../socket'

const router = Router()

router.use(authMiddleware)

// Thống kê chung: online + tổng số người đã đặt
router.get('/stats', async (_req, res: Response): Promise<void> => {
  res.json({ online: getOnlineCount(), totalBettors: await getTotalBettors() })
})

// Toàn bộ lệnh cược của 1 ván (user xem được — tên, chíp, giờ; betId để hủy)
router.get('/round/:id/bets', async (_req, res: Response): Promise<void> => {
  const bets = await prisma.bet.findMany({
    where: { roundId: _req.params.id },
    include: { user: { select: { username: true } } },
    orderBy: { createdAt: 'asc' },
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

router.get('/round/current', async (_req, res: Response): Promise<void> => {
  const round = await getCurrentRound()
  if (!round) {
    res.json(null)
    return
  }
  res.json({ ...round, coefficient: round.coefficient.toString() })
})

router.get('/round/:id/my-bet', async (req: AuthRequest, res: Response): Promise<void> => {
  const bet = await getUserBetForRound(req.user!.userId, req.params.id)
  if (!bet) {
    res.json(null)
    return
  }
  res.json({ ...bet, amount: bet.amount.toString(), payout: bet.payout.toString() })
})

router.get('/rounds', async (req, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const data = await getRounds(page, limit)
  res.json(data)
})

export default router
