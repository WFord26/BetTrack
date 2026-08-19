/**
 * Tests for team-stats-sync.job — the daily trigger behind `team_stats`.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const defaultEnv = {
  API_SPORTS_KEY: 'test-key',
  API_SPORTS_MIN_REMAINING: '500',
  TEAM_STATS_SYNC_CRON: '30 5 * * *',
  TEAM_STATS_SYNC_DELAY_MS: '250',
  TEAM_STATS_SYNC_SEASON: undefined as string | undefined,
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

const schedule = jest.fn((_expr: string, cb: () => Promise<void>) => {
  capturedCronCallback = cb;
  return { stop: jest.fn() };
});

jest.mock('node-cron', () => ({
  default: { schedule },
  schedule,
}));

const syncAllTeamSeasonStats = jest.fn();

jest.mock('../../src/services/stats-sync.service', () => ({
  StatsSyncService: jest.fn().mockImplementation(() => ({
    syncAllTeamSeasonStats,
  })),
}));

/** A single-sport result, as `syncAllTeamSeasonStats` returns them. */
function sportResult(overrides: Record<string, unknown> = {}) {
  return {
    sportKey: 'basketball_nba',
    season: 2025,
    teamsProcessed: 30,
    teamsUpdated: 30,
    teamsSkipped: 0,
    pausedDueToQuota: false,
    errors: [],
    ...overrides,
  };
}

describe('team-stats-sync.job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    capturedCronCallback = undefined;
    defaultEnv.TEAM_STATS_SYNC_SEASON = undefined;
    jest.doMock('../../src/config/env', () => ({ env: defaultEnv }));
  });

  it('does not schedule the job when API_SPORTS_KEY is unset', async () => {
    jest.doMock('../../src/config/env', () => ({
      env: { API_SPORTS_KEY: '', TEAM_STATS_SYNC_CRON: '30 5 * * *' },
    }));

    const { startTeamStatsSyncJob } = await import('../../src/jobs/team-stats-sync.job');

    expect(startTeamStatsSyncJob()).toBeNull();
    expect(schedule).not.toHaveBeenCalled();
  });

  it('schedules on the configured cron without syncing on startup', async () => {
    const { startTeamStatsSyncJob } = await import('../../src/jobs/team-stats-sync.job');
    startTeamStatsSyncJob();
    await new Promise(resolve => setImmediate(resolve));

    expect(schedule).toHaveBeenCalledWith('30 5 * * *', expect.any(Function), expect.anything());
    // A full pass costs one request per team, so a restart must not trigger one.
    expect(syncAllTeamSeasonStats).not.toHaveBeenCalled();
  });

  it('passes the quota floor and inter-request delay through to the service', async () => {
    syncAllTeamSeasonStats.mockResolvedValue([sportResult()]);

    const { startTeamStatsSyncJob } = await import('../../src/jobs/team-stats-sync.job');
    startTeamStatsSyncJob();
    await capturedCronCallback!();

    expect(syncAllTeamSeasonStats).toHaveBeenCalledWith({
      season: undefined,
      minimumRemainingRequests: 500,
      delayMs: 250,
    });
  });

  it('pins the season when TEAM_STATS_SYNC_SEASON is set', async () => {
    defaultEnv.TEAM_STATS_SYNC_SEASON = '2024';
    syncAllTeamSeasonStats.mockResolvedValue([sportResult()]);

    const { startTeamStatsSyncJob } = await import('../../src/jobs/team-stats-sync.job');
    startTeamStatsSyncJob();
    await capturedCronCallback!();

    expect(syncAllTeamSeasonStats).toHaveBeenCalledWith(
      expect.objectContaining({ season: 2024 })
    );
  });

  it('records the per-sport results in status', async () => {
    const results = [
      sportResult(),
      sportResult({ sportKey: 'icehockey_nhl', teamsProcessed: 32, teamsUpdated: 31, errors: ['boom'] }),
    ];
    syncAllTeamSeasonStats.mockResolvedValue(results);

    const { startTeamStatsSyncJob, getTeamStatsSyncStatus } = await import(
      '../../src/jobs/team-stats-sync.job'
    );
    startTeamStatsSyncJob();
    await capturedCronCallback!();

    const status = getTeamStatsSyncStatus();
    expect(status.isRunning).toBe(false);
    expect(status.lastRunTime).toBeInstanceOf(Date);
    expect(status.cronExpression).toBe('30 5 * * *');
    expect(status.lastResults).toEqual(results);
  });

  it('re-entrancy guard: a run already in progress skips overlapping triggers', async () => {
    let resolveFirstRun: (value: any) => void;
    syncAllTeamSeasonStats.mockReturnValueOnce(new Promise(resolve => {
      resolveFirstRun = resolve;
    }));

    const { startTeamStatsSyncJob } = await import('../../src/jobs/team-stats-sync.job');
    startTeamStatsSyncJob();

    const firstRun = capturedCronCallback!();
    await new Promise(resolve => setImmediate(resolve));
    await capturedCronCallback!();

    expect(syncAllTeamSeasonStats).toHaveBeenCalledTimes(1);

    resolveFirstRun!([sportResult()]);
    await firstRun;
  });

  it('survives a service that throws, leaving the job schedulable again', async () => {
    syncAllTeamSeasonStats.mockRejectedValue(new Error('upstream down'));

    const { startTeamStatsSyncJob, getTeamStatsSyncStatus } = await import(
      '../../src/jobs/team-stats-sync.job'
    );
    startTeamStatsSyncJob();
    await expect(capturedCronCallback!()).resolves.toBeUndefined();

    expect(getTeamStatsSyncStatus().isRunning).toBe(false);
  });
});
