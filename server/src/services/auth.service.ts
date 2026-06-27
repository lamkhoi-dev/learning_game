import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { signAccessToken, signRefreshToken } from '../lib/jwt'

function safeUser(user: { id: string; username: string; phone: string; energy: bigint; role: string; status: string }) {
  return { ...user, energy: user.energy.toString() }
}

export async function register(username: string, phone: string, password: string) {
  const existingUsername = await prisma.user.findUnique({ where: { username } })
  if (existingUsername) throw new Error('Username đã tồn tại')

  const existingPhone = await prisma.user.findUnique({ where: { phone } })
  if (existingPhone) throw new Error('Số điện thoại đã được đăng ký')

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { username, phone, passwordHash, status: 'PENDING' },
    select: { id: true, username: true, phone: true, energy: true, role: true, status: true },
  })

  // PENDING users get a token so they can check status, but game access is blocked
  const accessToken = signAccessToken({ userId: user.id, role: user.role })
  const refreshToken = signRefreshToken(user.id)
  return { accessToken, refreshToken, user: safeUser(user) }
}

export async function login(identifier: string, password: string) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: identifier }, { phone: identifier }] },
  })
  if (!user) throw new Error('Thông tin đăng nhập không đúng')

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) throw new Error('Thông tin đăng nhập không đúng')

  const accessToken = signAccessToken({ userId: user.id, role: user.role })
  const refreshToken = signRefreshToken(user.id)
  const { passwordHash: _, ...rest } = user
  return { accessToken, refreshToken, user: safeUser(rest) }
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, phone: true, energy: true, role: true, status: true },
  })
  if (!user) throw new Error('User không tồn tại')
  return safeUser(user)
}
