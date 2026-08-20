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

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('bookmaker-analytics.job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('records the batch outcome in job status after an immediate run', async () => {
    // Resolve prisma and the service from the live registry: beforeEach calls
    // resetModules, so the top-level imports point at a stale module instance.
    const livePrisma = (await import('../../src/config/database')).prisma as any;
    const liveService = (await import('../../src/services/bookmaker-analytics.service'))
      .bookmakerAnalyticsService as any;

    // Empty table => startBookmakerAnalyticsJob kicks off an immediate run
    livePrisma.bookmakerAnalytics.findFirst.mockResolvedValue(null);
    liveService.runBatchCalculation.mockResolvedValue({
      bookmakersProcessed: 3,
      errors: ['fanduel: boom'],
    });

    const job = await import('../../src/jobs/bookmaker-analytics.job');
    await job.startBookmakerAnalyticsJob();
    // executeBookmakerAnalytics is fired without await inside the job
    await new Promise((resolve) => setImmediate(resolve));

    const status = job.getBookmakerAnalyticsJobStatus();

    expect(liveService.runBatchCalculation).toHaveBeenCalled();
    expect(status.lastResult).toEqual({ bookmakersProcessed: 3, errors: ['fanduel: boom'] });
    expect(status.lastRunTime).toBeInstanceOf(Date);
    // The run must release its lock even when it reported errors
    expect(status.isRunning).toBe(false);
  });

  it('schedules the daily cron even when the table is already fresh', async () => {
    // Live registry instances — beforeEach calls resetModules, so the top-level
    // imports are stale by the time the job module is loaded.
    const livePrisma = (await import('../../src/config/database')).prisma as any;
    const liveService = (await import('../../src/services/bookmaker-analytics.service'))
      .bookmakerAnalyticsService as any;

    // Fresh row (well inside the 48h staleness threshold) => no immediate run
    livePrisma.bookmakerAnalytics.findFirst.mockResolvedValue({ calculatedAt: new Date() });
    liveService.runBatchCalculation.mockResolvedValue({ bookmakersProcessed: 1, errors: [] });

    const { startBookmakerAnalyticsJob } = await import('../../src/jobs/bookmaker-analytics.job');

    await startBookmakerAnalyticsJob();
    await new Promise((resolve) => setImmediate(resolve));

    expect(liveService.runBatchCalculation).not.toHaveBeenCalled();

    // Job was started (cron.schedule called)
    const cron = await import('node-cron');
    expect(cron.schedule).toHaveBeenCalledWith(
      '0 2 * * *',
      expect.any(Function),
      expect.objectContaining({ timezone: 'UTC' })
    );
  });
});
