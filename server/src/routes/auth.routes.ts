import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { register, login } from '../services/auth.service'
import { verifyRefreshToken, signAccessToken } from '../lib/jwt'
import { prisma } from '../lib/prisma'
import { authMiddleware } from '../middleware/auth.middleware'
import { AuthRequest } from '../types'

const router = Router()

const registerSchema = z.object({
  username: z.string().min(3).max(30),
  phone: z.string().min(9).max(15),
  password: z.string().min(6),
})

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
})

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message })
    return
  }
  try {
    const { username, phone, password } = parsed.data
    const result = await register(username, phone, password)
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    res.json({ accessToken: result.accessToken, user: result.user })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed'
    res.status(400).json({ error: message })
  }
})

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  try {
    const result = await login(parsed.data.identifier, parsed.data.password)
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    res.json({ accessToken: result.accessToken, user: result.user })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed'
    res.status(401).json({ error: message })
  }
})

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.refreshToken
  if (!token) {
    res.status(401).json({ error: 'No refresh token' })
    return
  }
  try {
    const payload = verifyRefreshToken(token)
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true },
    })
    if (!user) {
      res.status(401).json({ error: 'User not found' })
      return
    }
    const accessToken = signAccessToken({ userId: user.id, role: user.role })
    res.json({ accessToken })
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' })
  }
})

router.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('refreshToken')
  res.status(204).send()
})

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, username: true, phone: true, energy: true, role: true, status: true },
    })
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    res.json({ ...user, energy: user.energy.toString() })
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

export default router
