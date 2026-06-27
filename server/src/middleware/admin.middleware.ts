import { Response, NextFunction } from 'express'
import { AuthRequest } from '../types'

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Forbidden: Admin only' })
    return
  }
  next()
}
