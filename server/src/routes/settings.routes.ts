import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// Public: header lấy tên thương hiệu + cấu hình video live (không cần đăng nhập)
router.get('/', async (_req, res: Response): Promise<void> => {
  const s = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  res.json({
    brandName: s?.brandName ?? 'VOID PROTOCOL',
    streamUrl: s?.streamUrl ?? '',
    streamType: s?.streamType ?? 'iframe',
    streamOn: s?.streamOn ?? false,
  })
})

export default router
