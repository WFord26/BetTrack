import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BookmakerAnalyticsService } from '../src/services/bookmaker-analytics.service';

jest.mock('../src/config/database', () => ({
  prisma: {
    currentOdds: {
      findMany: jest.fn(),
    },
    marketConsensus: {
      findMany: jest.fn(),
    },
    bookmakerMovementEvent: {
      findMany: jest.fn(),
    },
    oddsSnapshot: {
      findMany: jest.fn(),
    },
    betLeg: {
      aggregate: jest.fn(),
    },
    bookmakerAnalytics: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    bookmakerReport: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { prisma } from '../src/config/database';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('BookmakerAnalyticsService', () => {
  let service: BookmakerAnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookmakerAnalyticsService();
    // Default: no BetLeg CLV data for any bookmaker
    (mockPrisma.betLeg as any).aggregate = jest.fn().mockResolvedValue({ _avg: { clv: null } });
    // Default: no user-submitted reports for any bookmaker
    mockPrisma.bookmakerReport.findMany.mockResolvedValue([] as any);
  });

  /** currentOdds rows spanning `gameCount` distinct games, which is what drives totalGamesOffered. */
  function oddsForGames(gameCount: number) {
    return Array.from({ length: gameCount }, (_, i) => ({
      gameId: `g${i}`,
      marketType: 'h2h',
      homePrice: -110,
      homeSpread: null,
      totalLine: null,
      game: { sport: { key: 'basketball_nba' } },
    }));
  }

  /** Wires up the minimum mocks for a metrics run over `gameCount` games. */
  function arrangeMetrics(gameCount: number) {
    mockPrisma.currentOdds.findMany.mockResolvedValue(oddsForGames(gameCount) as any);
    mockPrisma.marketConsensus.findMany.mockResolvedValue([] as any);
    mockPrisma.bookmakerMovementEvent.findMany.mockResolvedValue([] as any);
    mockPrisma.oddsSnapshot.findMany.mockResolvedValue([] as any);
    mockPrisma.bookmakerAnalytics.upsert.mockImplementation(async ({ create }: any) => ({
      id: 'x',
      ...create,
    }));
  }

  /** One OUTAGE report per (user, day) pair. */
  function outageReports(pairs: Array<[string, string]>) {
    return pairs.map(([userId, day]) => ({
      userId,
      reportType: 'OUTAGE',
      createdAt: new Date(`${day}T12:00:00.000Z`),
    }));
  }

  it('calculates and upserts bookmaker analytics metrics', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-14T11:00:00.000Z').getTime());

    mockPrisma.currentOdds.findMany.mockResolvedValue([
      {
        gameId: 'game-1',
        marketType: 'h2h',
        homePrice: -110,
        homeSpread: null,
        totalLine: null,
        game: { sport: { key: 'basketball_nba' } },
      },
      {
        gameId: 'game-2',
        marketType: 'spreads',
        homePrice: null,
        homeSpread: -3.5,
        totalLine: null,
        game: { sport: { key: 'americanfootball_nfl' } },
      },
    ] as any);

    mockPrisma.marketConsensus.findMany.mockResolvedValue([
      // Only rows matching the bookmaker's gameIds (game-1, game-2) and marketTypes (h2h, spreads)
      // game-3:totals would be filtered out at the DB layer (gameId not in offered set)
      {
        gameId: 'game-1',
        marketType: 'h2h',
        bestValueBookmaker: 'draftkings',
        outlierBookmakers: [],
        consensusLine: -112,
      },
      {
        gameId: 'game-2',
        marketType: 'spreads',
        bestValueBookmaker: 'fanduel',
        outlierBookmakers: [{ bookmaker: 'draftkings' }],
        consensusLine: -3,
      },
    ] as any);

    mockPrisma.bookmakerMovementEvent.findMany.mockResolvedValue([
      {
        firstMover: 'draftkings',
        followers: [{ bookmaker: 'fanduel', lagSeconds: 20 }],
      },
      {
        firstMover: 'pinnacle',
        followers: [{ bookmaker: 'draftkings', lagSeconds: 30 }],
      },
    ] as any);

    mockPrisma.oddsSnapshot.findMany.mockResolvedValue([
      { capturedAt: new Date('2026-05-14T10:00:00.000Z') },
      { capturedAt: new Date('2026-05-14T10:10:00.000Z') },
      { capturedAt: new Date('2026-05-14T10:20:00.000Z') },
    ] as any);

    mockPrisma.bookmakerAnalytics.upsert.mockImplementation(async ({ create }: any) => ({
      id: 'analytics-1',
      ...create,
    }));

    const result = await service.calculateBookmakerMetrics('  DraftKings  ');

    expect(mockPrisma.bookmakerAnalytics.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookmaker: 'draftkings' },
      })
    );

    expect(result.bookmaker).toBe('draftkings');
    expect(result.bestOddsFrequency.toString()).toBe('50');
    expect(result.outlierFrequency.toString()).toBe('50');
    expect(result.marginVsConsensus.toString()).toBe('1.25');
    expect(result.firstMoverFrequency.toString()).toBe('50');
    expect(result.lineMovementLag).toBe(30);
    expect(result.sportsCovered).toEqual(['americanfootball_nfl', 'basketball_nba']);
    expect(result.marketsCovered).toEqual(['h2h', 'spreads']);
    expect(result.limitProfile).toBe('medium');
    expect(result.totalGamesOffered).toBe(2);
    expect(result.totalMarketsOffered).toBe(2);
    // recommendationScore is computable when all primary inputs are present
    expect(result.recommendationScore).not.toBeNull();
    expect(result.recommendationScore).toBeGreaterThan(1);
    // averageCLVOffered is null until BetLeg.bookmaker column lands (Phase D)
    expect(result.averageCLVOffered).toBeNull();
    // uptimePercentage is null — no data source yet
    expect(result.uptimePercentage).toBeNull();
  });

  it('averageCLVOffered is null when no BetLeg.bookmaker data exists', async () => {
    // Need at least one odds row to pass the "bookmaker not found" guard
    mockPrisma.currentOdds.findMany.mockResolvedValue([
      { gameId: 'g1', marketType: 'h2h', homePrice: -110, homeSpread: null, totalLine: null, game: { sport: { key: 'basketball_nba' } } },
    ] as any);
    mockPrisma.marketConsensus.findMany.mockResolvedValue([] as any);
    mockPrisma.bookmakerMovementEvent.findMany.mockResolvedValue([] as any);
    mockPrisma.oddsSnapshot.findMany.mockResolvedValue([] as any);
    mockPrisma.bookmakerAnalytics.upsert.mockImplementation(async ({ create }: any) => ({ id: 'x', ...create }));

    const result = await service.calculateBookmakerMetrics('draftkings');
    expect(result.averageCLVOffered).toBeNull();
  });

  it('uptimePercentage stays null and accountLimitReports 0 when there are no reports', async () => {
    arrangeMetrics(1);
    // Rich snapshot data must not be mistaken for an uptime signal
    mockPrisma.oddsSnapshot.findMany.mockResolvedValue([
      { capturedAt: new Date('2026-05-14T10:00:00.000Z') },
      { capturedAt: new Date('2026-05-14T10:30:00.000Z') },
    ] as any);

    const result = await service.calculateBookmakerMetrics('draftkings');

    // null, not 0 — the UI distinguishes "no reports yet" from "100% reliable"
    expect(result.uptimePercentage).toBeNull();
    expect(result.accountLimitReports).toBe(0);
  });

  it('holds its calibration: 200 games and one outage reporter-day scores 95.0', async () => {
    arrangeMetrics(200);
    mockPrisma.bookmakerReport.findMany.mockResolvedValue(
      outageReports([['user-1', '2026-05-10']]) as any
    );

    const result = await service.calculateBookmakerMetrics('draftkings');

    // exposure = max(20, 200/10) = 20; rate = (1 + 0.05*20) / (20 + 20) = 0.05
    expect(result.uptimePercentage).toBe(95);
  });

  it('lowers uptimePercentage as outage reporter-days accumulate', async () => {
    arrangeMetrics(1000);
    mockPrisma.bookmakerReport.findMany.mockResolvedValue(
      outageReports([
        ['user-1', '2026-05-01'],
        ['user-2', '2026-05-02'],
        ['user-3', '2026-05-03'],
        ['user-4', '2026-05-04'],
        ['user-5', '2026-05-05'],
        ['user-6', '2026-05-06'],
        ['user-7', '2026-05-07'],
        ['user-8', '2026-05-08'],
        ['user-9', '2026-05-09'],
        ['user-10', '2026-05-10'],
      ]) as any
    );

    const result = await service.calculateBookmakerMetrics('draftkings');

    // exposure = 1000/10 = 100; rate = (10 + 1) / (100 + 20) = 0.091666…
    expect(result.uptimePercentage).toBe(90.83);
  });

  it('caps a single user at USER_DAY_CAP reporter-days', async () => {
    arrangeMetrics(200);
    // One user reporting on 12 separate days counts as 5, not 12
    mockPrisma.bookmakerReport.findMany.mockResolvedValue(
      outageReports(
        Array.from({ length: 12 }, (_, i) => [
          'spammer',
          `2026-05-${String(i + 1).padStart(2, '0')}`,
        ]) as Array<[string, string]>
      ) as any
    );

    const result = await service.calculateBookmakerMetrics('draftkings');

    // rate = (5 + 1) / (20 + 20) = 0.15 — bottoms out at 85, nowhere near 0
    expect(result.uptimePercentage).toBe(85);
  });

  it('counts multiple same-day reports from one user as a single reporter-day', async () => {
    arrangeMetrics(200);
    mockPrisma.bookmakerReport.findMany.mockResolvedValue(
      outageReports([
        ['user-1', '2026-05-10'],
        ['user-1', '2026-05-10'],
        ['user-1', '2026-05-10'],
      ]) as any
    );

    const result = await service.calculateBookmakerMetrics('draftkings');

    expect(result.uptimePercentage).toBe(95);
  });

  it('floors exposure so one report cannot zero a bookmaker that has gone dark', async () => {
    // A single game in the window: raw ratio would be 1 / (1/10) = 1000% → 0% uptime
    arrangeMetrics(1);
    mockPrisma.bookmakerReport.findMany.mockResolvedValue(
      outageReports([['user-1', '2026-05-10']]) as any
    );

    const result = await service.calculateBookmakerMetrics('draftkings');

    // exposure floors at 20, so it lands on the prior instead of collapsing
    expect(result.uptimePercentage).toBe(95);
  });

  it('raises accountLimitReports, counting each user once', async () => {
    arrangeMetrics(200);
    mockPrisma.bookmakerReport.findMany.mockResolvedValue([
      { userId: 'user-1', reportType: 'LIMIT_REDUCTION', createdAt: new Date('2026-05-01') },
      { userId: 'user-2', reportType: 'LIMIT_REDUCTION', createdAt: new Date('2026-05-02') },
      { userId: 'user-1', reportType: 'LIMIT_REDUCTION', createdAt: new Date('2026-05-03') },
      { userId: 'user-3', reportType: 'OUTAGE', createdAt: new Date('2026-05-04') },
    ] as any);

    const result = await service.calculateBookmakerMetrics('draftkings');

    // user-1 twice counts once; the OUTAGE row must not leak into the limit count
    expect(result.accountLimitReports).toBe(2);
  });

  it('writes accountLimitReports on the update branch, not just create', async () => {
    arrangeMetrics(200);
    mockPrisma.bookmakerReport.findMany.mockResolvedValue([
      { userId: 'user-1', reportType: 'LIMIT_REDUCTION', createdAt: new Date('2026-05-01') },
    ] as any);

    await service.calculateBookmakerMetrics('draftkings');

    const call = (mockPrisma.bookmakerAnalytics.upsert as any).mock.calls[0][0];
    expect(call.create.accountLimitReports).toBe(1);
    expect(call.update.accountLimitReports).toBe(1);
  });

  it('scopes the report query to the bookmaker and the lookback window', async () => {
    // The service reads `new Date()`, not Date.now(), so fake timers are required here
    jest.useFakeTimers().setSystemTime(new Date('2026-05-14T11:00:00.000Z'));
    arrangeMetrics(10);

    try {
      await service.calculateBookmakerMetrics('  DraftKings  ');

      expect(mockPrisma.bookmakerReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            bookmaker: 'draftkings',
            // LOOKBACK_DAYS = 30, matching the window the other metrics use
            createdAt: { gte: new Date('2026-04-14T11:00:00.000Z') },
          },
        })
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('recommendationScore is computed when all weighted inputs are present', async () => {
    mockPrisma.currentOdds.findMany.mockResolvedValue([
      { gameId: 'g1', marketType: 'h2h', homePrice: -110, homeSpread: null, totalLine: null, game: { sport: { key: 'basketball_nba' } } },
    ] as any);
    mockPrisma.marketConsensus.findMany.mockResolvedValue([
      { gameId: 'g1', marketType: 'h2h', bestValueBookmaker: 'draftkings', outlierBookmakers: [], consensusLine: -110 },
    ] as any);
    mockPrisma.bookmakerMovementEvent.findMany.mockResolvedValue([
      { firstMover: 'draftkings', followers: [] },
    ] as any);
    mockPrisma.oddsSnapshot.findMany.mockResolvedValue([] as any);
    mockPrisma.bookmakerAnalytics.upsert.mockImplementation(async ({ create }: any) => ({ id: 'x', ...create }));

    const result = await service.calculateBookmakerMetrics('draftkings');
    expect(result.recommendationScore).not.toBeNull();
    expect(typeof result.recommendationScore).toBe('number');
  });

  it('throws BOOKMAKER_NOT_FOUND when the bookmaker has no currentOdds rows', async () => {
    mockPrisma.currentOdds.findMany.mockResolvedValue([] as any);

    await expect(service.calculateBookmakerMetrics('ghostbook')).rejects.toMatchObject({
      message: 'bookmaker not found',
      code: 'BOOKMAKER_NOT_FOUND',
    });

    // Must not have attempted to write any analytics row
    expect(mockPrisma.bookmakerAnalytics.upsert).not.toHaveBeenCalled();
  });

  it('carries report signal onto every bookmaker in a batch run', async () => {
    // End-to-end over runBatchCalculation, which is what the daily job invokes.
    mockPrisma.currentOdds.findMany.mockImplementation((async (args: any) =>
      args?.distinct
        ? [{ bookmaker: 'draftkings' }, { bookmaker: 'fanduel' }]
        : oddsForGames(200)) as any);
    mockPrisma.marketConsensus.findMany.mockResolvedValue([] as any);
    mockPrisma.bookmakerMovementEvent.findMany.mockResolvedValue([] as any);
    mockPrisma.oddsSnapshot.findMany.mockResolvedValue([] as any);

    // draftkings has report signal; fanduel has none
    mockPrisma.bookmakerReport.findMany.mockImplementation((async (args: any) =>
      args.where.bookmaker === 'draftkings'
        ? [
            { userId: 'u1', reportType: 'OUTAGE', createdAt: new Date('2026-08-01T09:00:00.000Z') },
            {
              userId: 'u2',
              reportType: 'LIMIT_REDUCTION',
              createdAt: new Date('2026-08-02T09:00:00.000Z'),
            },
          ]
        : []) as any);

    const upserted: Record<string, any> = {};
    mockPrisma.bookmakerAnalytics.upsert.mockImplementation((async ({ where, create }: any) => {
      upserted[where.bookmaker] = create;
      return { id: where.bookmaker, ...create };
    }) as any);

    const result = await service.runBatchCalculation();

    expect(result.bookmakersProcessed).toBe(2);
    expect(result.errors).toHaveLength(0);

    // The reported book picks up both metrics this feature exists to populate
    expect(upserted.draftkings.accountLimitReports).toBe(1);
    expect(upserted.draftkings.uptimePercentage).toBe(95);

    // The unreported book keeps the "no signal yet" state
    expect(upserted.fanduel.accountLimitReports).toBe(0);
    expect(upserted.fanduel.uptimePercentage).toBeNull();
  });

  it('aggregates per-bookmaker errors without aborting the batch', async () => {
    mockPrisma.currentOdds.findMany.mockImplementation((async (args: any) => {
      if (args?.distinct) {
        return [{ bookmaker: 'draftkings' }, { bookmaker: 'ghostbook' }, { bookmaker: 'fanduel' }];
      }
      // ghostbook has no odds rows, so it throws BOOKMAKER_NOT_FOUND mid-batch
      return args.where.bookmaker === 'ghostbook' ? [] : oddsForGames(10);
    }) as any);
    mockPrisma.marketConsensus.findMany.mockResolvedValue([] as any);
    mockPrisma.bookmakerMovementEvent.findMany.mockResolvedValue([] as any);
    mockPrisma.oddsSnapshot.findMany.mockResolvedValue([] as any);
    mockPrisma.bookmakerAnalytics.upsert.mockImplementation((async ({ where, create }: any) => ({
      id: where.bookmaker,
      ...create,
    })) as any);

    const result = await service.runBatchCalculation();

    expect(result.bookmakersProcessed).toBe(3);
    expect(result.errors).toEqual(['ghostbook: bookmaker not found']);
    // The books after the failure still got written
    expect(mockPrisma.bookmakerAnalytics.upsert).toHaveBeenCalledTimes(2);
  });

  it('ranks bookmakers by requested criteria and defaults to recommendation', async () => {
    mockPrisma.bookmakerAnalytics.findMany.mockResolvedValue([] as any);

    await service.rankBookmakers('sharpness');
    expect(mockPrisma.bookmakerAnalytics.findMany).toHaveBeenLastCalledWith({
      orderBy: [{ sharpBookRating: 'desc' }, { firstMoverFrequency: 'desc' }],
      take: 50,
    });

    // nulls last, or unreported books would top "Most Reliable"
    await service.rankBookmakers('reliability');
    expect(mockPrisma.bookmakerAnalytics.findMany).toHaveBeenLastCalledWith({
      orderBy: [
        { uptimePercentage: { sort: 'desc', nulls: 'last' } },
        { marketEfficiency: 'desc' },
      ],
      take: 50,
    });

    await service.rankBookmakers('not-a-real-criteria');
    expect(mockPrisma.bookmakerAnalytics.findMany).toHaveBeenLastCalledWith({
      orderBy: [{ recommendationScore: 'desc' }, { sharpBookRating: 'desc' }],
      take: 50,
    });
  });
});
