import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', brandName: 'VOID PROTOCOL' },
  })
  console.log('Settings ready (brandName).')

  const existing = await prisma.user.findUnique({ where: { username: 'void_admin' } })
  if (existing) {
    console.log('Admin already exists, skipping seed.')
    return
  }

  const passwordHash = await bcrypt.hash('Admin@1234', 12)
  const admin = await prisma.user.create({
    data: {
      username: 'void_admin',
      phone: '0000000000',
      passwordHash,
      energy: BigInt(0),
      role: 'ADMIN',
    },
  })
  console.log(`Created admin: ${admin.username} (id: ${admin.id})`)
  console.log('Login: username=void_admin, password=Admin@1234')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
