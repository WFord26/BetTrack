/**
 * Tests for mlb-hourly-sync.job
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const defaultEnv = {
  API_SPORTS_KEY: 'test-key',
  API_SPORTS_MIN_REMAINING: '500',
  MLB_SYNC_CRON: '0 * * * *',
  MLB_SYNC_HOURS_BACK: '48',
  MLB_SYNC_HOURS_FORWARD: '24',
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

const syncMlbHourlyWindow = jest.fn();

jest.mock('../../src/services/stats-sync.service', () => ({
  StatsSyncService: jest.fn().mockImplementation(() => ({
    syncMlbHourlyWindow,
  })),
}));

describe('mlb-hourly-sync.job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    capturedCronCallback = undefined;
    // Reset in case a previous test overrode this module's mock via doMock.
    jest.doMock('../../src/config/env', () => ({ env: defaultEnv }));
  });

  it('does not schedule the job when API_SPORTS_KEY is unset', async () => {
    jest.doMock('../../src/config/env', () => ({
      env: { API_SPORTS_KEY: '', MLB_SYNC_CRON: '0 * * * *' },
    }));

    const { startMlbHourlySyncJob } = await import('../../src/jobs/mlb-hourly-sync.job');
    const task = startMlbHourlySyncJob();

    expect(task).toBeNull();
    const cron = await import('node-cron');
    expect(cron.schedule).not.toHaveBeenCalled();
  });

  it('records a successful run in status', async () => {
    syncMlbHourlyWindow.mockResolvedValue({
      gamesProcessed: 10,
      gamesUpdated: 4,
      datesProcessed: 3,
      datesSkipped: 0,
      pausedDueToQuota: false,
      errors: [],
    });

    const { startMlbHourlySyncJob, getMlbHourlySyncStatus } = await import('../../src/jobs/mlb-hourly-sync.job');
    startMlbHourlySyncJob();

    // The initial run fires synchronously inside startMlbHourlySyncJob; flush microtasks.
    await new Promise(resolve => setImmediate(resolve));

    const status = getMlbHourlySyncStatus();
    expect(status.lastResult.gamesUpdated).toBe(4);
    expect(syncMlbHourlyWindow).toHaveBeenCalledTimes(1);
  });

  it('re-entrancy guard: a run already in progress skips overlapping triggers', async () => {
    let resolveFirstRun: (value: any) => void;
    const firstRunPromise = new Promise(resolve => {
      resolveFirstRun = resolve;
    });
    syncMlbHourlyWindow.mockReturnValueOnce(firstRunPromise);

    const { startMlbHourlySyncJob } = await import('../../src/jobs/mlb-hourly-sync.job');
    startMlbHourlySyncJob();

    // First run is in flight (promise unresolved). Trigger the cron callback
    // again to simulate an overlapping scheduled tick.
    expect(capturedCronCallback).toBeDefined();
    await capturedCronCallback!();

    expect(syncMlbHourlyWindow).toHaveBeenCalledTimes(1);

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
    syncMlbHourlyWindow.mockResolvedValue({
      gamesProcessed: 2,
      gamesUpdated: 0,
      datesProcessed: 1,
      datesSkipped: 0,
      pausedDueToQuota: false,
      errors: ['Failed MLB sync for 2026-08-14: boom'],
    });

    const { startMlbHourlySyncJob, getMlbHourlySyncStatus } = await import('../../src/jobs/mlb-hourly-sync.job');
    startMlbHourlySyncJob();
    await new Promise(resolve => setImmediate(resolve));

    const status = getMlbHourlySyncStatus();
    expect(status.lastResult.errors).toHaveLength(1);
  });

  it('records quota-paused runs in status', async () => {
    syncMlbHourlyWindow.mockResolvedValue({
      gamesProcessed: 5,
      gamesUpdated: 5,
      datesProcessed: 1,
      datesSkipped: 2,
      pausedDueToQuota: true,
      requestsRemaining: 100,
      errors: [],
    });

    const { startMlbHourlySyncJob, getMlbHourlySyncStatus } = await import('../../src/jobs/mlb-hourly-sync.job');
    startMlbHourlySyncJob();
    await new Promise(resolve => setImmediate(resolve));

    const status = getMlbHourlySyncStatus();
    expect(status.lastResult.pausedDueToQuota).toBe(true);
    expect(status.lastResult.requestsRemaining).toBe(100);
  });
});
