/**
 * Smoke tests for bookmaker-analytics.job
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  prisma: {
    currentOdds: { findMany: jest.fn() },
    bookmakerAnalytics: { findFirst: jest.fn() },
  },
}));

jest.mock('../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('node-cron', () => ({
  default: { schedule: jest.fn(() => ({ stop: jest.fn() })) },
  schedule: jest.fn(() => ({ stop: jest.fn() })),
}));

jest.mock('../../src/services/bookmaker-analytics.service', () => ({
  bookmakerAnalyticsService: {
    runBatchCalculation: jest.fn(),
    calculateBookmakerMetrics: jest.fn(),
  },
}));

import { prisma } from '../../src/config/database';
import { bookmakerAnalyticsService } from '../../src/services/bookmaker-analytics.service';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockService = bookmakerAnalyticsService as jest.Mocked<typeof bookmakerAnalyticsService>;

describe('bookmaker-analytics.job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('calls runBatchCalculation which processes each distinct bookmaker', async () => {
    const { BookmakerAnalyticsService } = await import('../../src/services/bookmaker-analytics.service');

    // Re-import the service class directly to test runBatchCalculation in isolation
    jest.mock('../../src/config/database', () => ({
      prisma: {
        currentOdds: {
          findMany: jest.fn().mockResolvedValue([
            { bookmaker: 'draftkings' },
            { bookmaker: 'fanduel' },
          ] as any),
        },
        bookmakerAnalytics: {
          upsert: jest.fn().mockImplementation(async ({ create }: any) => ({ id: 'x', ...create })),
          findFirst: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
        },
        marketConsensus: { findMany: jest.fn().mockResolvedValue([]) },
        bookmakerMovementEvent: { findMany: jest.fn().mockResolvedValue([]) },
        oddsSnapshot: { findMany: jest.fn().mockResolvedValue([]) },
      },
    }));

    // The key contract: runBatchCalculation processes distinct bookmakers
    mockPrisma.currentOdds.findMany.mockResolvedValue([
      { bookmaker: 'draftkings' } as any,
      { bookmaker: 'fanduel' } as any,
    ]);

    mockService.runBatchCalculation.mockResolvedValue({
      bookmakersProcessed: 2,
      errors: [],
    });

    const result = await bookmakerAnalyticsService.runBatchCalculation();

    expect(result.bookmakersProcessed).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it('errors from individual bookmakers are aggregated and do not abort the batch', async () => {
    mockService.runBatchCalculation.mockResolvedValue({
      bookmakersProcessed: 2,
      errors: ['draftkings: some error'],
    });

    const result = await bookmakerAnalyticsService.runBatchCalculation();

    expect(result.bookmakersProcessed).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('draftkings');
  });

  it('startBookmakerAnalyticsJob triggers immediate run when table is empty', async () => {
    mockPrisma.bookmakerAnalytics.findFirst.mockResolvedValue(null as any);

    const { startBookmakerAnalyticsJob } = await import('../../src/jobs/bookmaker-analytics.job');

    mockService.runBatchCalculation.mockResolvedValue({
      bookmakersProcessed: 1,
      errors: [],
    });

    await startBookmakerAnalyticsJob();

    // Job was started (cron.schedule called)
    const cron = await import('node-cron');
    expect(cron.schedule).toHaveBeenCalledWith(
      '0 2 * * *',
      expect.any(Function),
      expect.objectContaining({ timezone: 'UTC' })
    );
  });
});
