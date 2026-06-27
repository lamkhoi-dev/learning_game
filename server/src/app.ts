import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { rateLimit } from 'express-rate-limit'
import { createProxyMiddleware } from 'http-proxy-middleware'
import authRoutes from './routes/auth.routes'
import gameRoutes from './routes/game.routes'
import adminRoutes from './routes/admin.routes'
import settingsRoutes from './routes/settings.routes'
import { errorMiddleware } from './middleware/error.middleware'

const NEXT_DEV_URL = process.env.NEXT_DEV_URL ?? 'http://localhost:3000'

// Proxy mọi request không phải /api hay /socket.io sang Next dev server.
// Nhờ đó chỉ cần 1 ngrok tunnel (cổng 4000) cho cả frontend + backend + websocket.
export const nextProxy = createProxyMiddleware({
  target: NEXT_DEV_URL,
  changeOrigin: true,
  ws: true,
})

export function createApp() {
  const app = express()

  const allowedOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:3000')
    .split(',').map(s => s.trim())

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      const ok = allowedOrigins.includes(origin) || origin.includes('ngrok')
      ok ? cb(null, true) : cb(new Error('CORS blocked'))
    },
    credentials: true,
  }))
  // Chỉ parse body / cookie / rate-limit cho /api (proxy Next phải giữ nguyên stream)
  app.use('/api', express.json())
  app.use('/api', cookieParser())
  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 2000 : 5000,
    standardHeaders: true,
    legacyHeaders: false,
  }))

  app.use('/api/auth', authRoutes)
  app.use('/api/game', gameRoutes)
  app.use('/api/admin', adminRoutes)
  app.use('/api/settings', settingsRoutes)

  app.get('/api/health', (_req, res) => res.json({ ok: true }))

  app.use('/api', errorMiddleware)

  // Tất cả request còn lại (trang, asset, _next, HMR) → Next dev server
  app.use(nextProxy)

  return app
}
