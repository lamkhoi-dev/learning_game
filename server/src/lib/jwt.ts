import jwt from 'jsonwebtoken'

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET!
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET!

export interface TokenPayload {
  userId: string
  role: string
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: '15m' })
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId }, REFRESH_SECRET, { expiresIn: '7d' })
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as TokenPayload
}

export function verifyRefreshToken(token: string): { userId: string } {
  return jwt.verify(token, REFRESH_SECRET) as { userId: string }
}
