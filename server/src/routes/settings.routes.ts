import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// Public: header lấy tên thương hiệu (không cần đăng nhập)
router.get('/', async (_req, res: Response): Promise<void> => {
  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  res.json({ brandName: settings?.brandName ?? 'VOID PROTOCOL' })
})

export default router
