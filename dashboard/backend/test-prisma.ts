import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    await prisma.$connect()
    console.log('✓ Prisma connected successfully!')
    
    const result = await prisma.$queryRaw`SELECT current_database(), current_schema()`
    console.log('Query result:', result)
  } catch (error) {
    console.error('✗ Prisma connection failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
