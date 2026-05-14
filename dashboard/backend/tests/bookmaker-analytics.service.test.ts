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
    bookmakerAnalytics: {
      upsert: jest.fn(),
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
  });

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
      {
        gameId: 'game-3',
        marketType: 'totals',
        bestValueBookmaker: 'draftkings',
        outlierBookmakers: [],
        consensusLine: 45,
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
    expect(result.recommendationScore).toBeGreaterThan(1);
  });

  it('ranks bookmakers by requested criteria and defaults to recommendation', async () => {
    mockPrisma.bookmakerAnalytics.findMany.mockResolvedValue([] as any);

    await service.rankBookmakers('sharpness');
    expect(mockPrisma.bookmakerAnalytics.findMany).toHaveBeenLastCalledWith({
      orderBy: [{ sharpBookRating: 'desc' }, { firstMoverFrequency: 'desc' }],
      take: 50,
    });

    await service.rankBookmakers('not-a-real-criteria');
    expect(mockPrisma.bookmakerAnalytics.findMany).toHaveBeenLastCalledWith({
      orderBy: [{ recommendationScore: 'desc' }, { sharpBookRating: 'desc' }],
      take: 50,
    });
  });
});
