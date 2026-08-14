/**
 * Tests for football-hourly-sync.job
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const defaultEnv = {
  API_SPORTS_KEY: 'test-key',
  API_SPORTS_MIN_REMAINING: '500',
  FOOTBALL_SYNC_CRON: '0 * * * *',
  FOOTBALL_SYNC_HOURS_BACK: '96',
  FOOTBALL_SYNC_HOURS_FORWARD: '72',
};

jest.mock('../../src/config/env', () => ({ env: defaultEnv }));

jest.mock('../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

let capturedCronCallback: (() => Promise<void>) | undefined;

jest.mock('node-cron', () => ({
  default: {
    schedule: jest.fn((_expr: string, cb: () => Promise<void>) => {
      capturedCronCallback = cb;
      return { stop: jest.fn() };
    }),
  },
  schedule: jest.fn((_expr: string, cb: () => Promise<void>) => {
    capturedCronCallback = cb;
    return { stop: jest.fn() };
  }),
}));

const syncFootballHourlyWindow = jest.fn();

jest.mock('../../src/services/stats-sync.service', () => ({
  StatsSyncService: jest.fn().mockImplementation(() => ({
    syncFootballHourlyWindow,
  })),
}));

describe('football-hourly-sync.job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    capturedCronCallback = undefined;
    // Reset in case a previous test overrode this module's mock via doMock.
    jest.doMock('../../src/config/env', () => ({ env: defaultEnv }));
  });

  it('does not schedule the job when API_SPORTS_KEY is unset', async () => {
    jest.doMock('../../src/config/env', () => ({
      env: { API_SPORTS_KEY: '', FOOTBALL_SYNC_CRON: '0 * * * *' },
    }));

    const { startFootballHourlySyncJob } = await import('../../src/jobs/football-hourly-sync.job');
    const task = startFootballHourlySyncJob();

    expect(task).toBeNull();
    const cron = await import('node-cron');
    expect(cron.schedule).not.toHaveBeenCalled();
  });

  it('records a successful run covering both NFL and NCAAF in status', async () => {
    syncFootballHourlyWindow.mockResolvedValue({
      gamesProcessed: 24,
      gamesUpdated: 9,
      datesProcessed: 7,
      datesSkipped: 0,
      pausedDueToQuota: false,
      errors: [],
    });

    const { startFootballHourlySyncJob, getFootballHourlySyncStatus } = await import(
      '../../src/jobs/football-hourly-sync.job'
    );
    startFootballHourlySyncJob();
    await new Promise(resolve => setImmediate(resolve));

    const status = getFootballHourlySyncStatus();
    expect(status.lastResult.gamesUpdated).toBe(9);
    expect(syncFootballHourlyWindow).toHaveBeenCalledTimes(1);
  });

  it('re-entrancy guard: a run already in progress skips overlapping triggers', async () => {
    let resolveFirstRun: (value: any) => void;
    const firstRunPromise = new Promise(resolve => {
      resolveFirstRun = resolve;
    });
    syncFootballHourlyWindow.mockReturnValueOnce(firstRunPromise);

    const { startFootballHourlySyncJob } = await import('../../src/jobs/football-hourly-sync.job');
    startFootballHourlySyncJob();

    expect(capturedCronCallback).toBeDefined();
    await capturedCronCallback!();

    expect(syncFootballHourlyWindow).toHaveBeenCalledTimes(1);

    resolveFirstRun!({
      gamesProcessed: 1,
      gamesUpdated: 1,
      datesProcessed: 1,
      datesSkipped: 0,
      pausedDueToQuota: false,
      errors: [],
    });
    await new Promise(resolve => setImmediate(resolve));
  });

  it('records errors from a failed run without throwing', async () => {
    syncFootballHourlyWindow.mockResolvedValue({
      gamesProcessed: 3,
      gamesUpdated: 0,
      datesProcessed: 1,
      datesSkipped: 0,
      pausedDueToQuota: false,
      errors: ['Failed NFL sync for 2026-09-07: boom'],
    });

    const { startFootballHourlySyncJob, getFootballHourlySyncStatus } = await import(
      '../../src/jobs/football-hourly-sync.job'
    );
    startFootballHourlySyncJob();
    await new Promise(resolve => setImmediate(resolve));

    const status = getFootballHourlySyncStatus();
    expect(status.lastResult.errors).toHaveLength(1);
  });
});
