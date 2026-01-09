import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' }
  ]
});

prisma.$on('query', (e: any) => {
  logger.debug(`Query: ${e.query}`);
  logger.debug(`Duration: ${e.duration}ms`);
});

prisma.$on('error', (e: any) => {
  logger.error(`Database error: ${e.message}`);
});

prisma.$on('warn', (e: any) => {
  logger.warn(`Database warning: ${e.message}`);
});

export { prisma };
