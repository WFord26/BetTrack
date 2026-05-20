/**
 * Integration tests for Bookmaker Analytics Routes
 * Tests all 7 endpoints: /rankings, /sharp, /compare, /best-value/:sport,
 * /movement/:bookmaker, /:bookmaker, /:bookmaker/outliers
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';

// Mock session-store
jest.mock('../src/services/session-store.service', () => ({
  initializeSessionStore: jest.fn(),
  shutdownSessionStore: jest.fn(),
  getSessionStore: jest.fn(() => ({
    get: jest.fn(), set: jest.fn(), delete: jest.fn(), clear: jest.fn(),
  })),
  sessionStore: {
    get: jest.fn(), set: jest.fn(), delete: jest.fn(), clear: jest.fn(),
  },
}));

// Bypass auth
jest.mock('../src/middleware/auth-session.middleware', () => ({
  requireSessionAuth: jest.fn((_req: any, _res: any, next: any) => next()),
  optionalAuth: jest.fn((_req: any, _res: any, next: any) => next()),
  isAuthEnabled: jest.fn(() => false),
  getScopedUserId: jest.fn(() => undefined),
  getUserId: jest.fn(() => null),
  requireAdminAccess: jest.fn((_req: any, _res: any, next: any) => next()),
  attachAuthSession: jest.fn((_req: any, _res: any, next: any) => next()),
}));

// Mock Prisma
jest.mock('../src/config/database', () => ({
  prisma: {
    bookmakerAnalytics: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    bookmakerMovementEvent: {
      findMany: jest.fn(),
    },
  },
}));

// Mock bookmakerAnalyticsService
jest.mock('../src/services/bookmaker-analytics.service', () => ({
  bookmakerAnalyticsService: {
    rankBookmakers: jest.fn(),
    calculateBookmakerMetrics: jest.fn(),
    runBatchCalculation: jest.fn(),
  },
}));

// Mock marketConsensusService
jest.mock('../src/services/market-consensus.service', () => ({
  marketConsensusService: {
    getBookmakerOutlierStats: jest.fn(),
  },
}));

import app from '../src/app';
import { prisma } from '../src/config/database';
import { bookmakerAnalyticsService } from '../src/services/bookmaker-analytics.service';
import { marketConsensusService } from '../src/services/market-consensus.service';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockService = bookmakerAnalyticsService as jest.Mocked<typeof bookmakerAnalyticsService>;
const mockConsensusService = marketConsensusService as jest.Mocked<typeof marketConsensusService>;

const sampleRow = {
  id: 'abc-123',
  bookmaker: 'draftkings',
  averageCLVOffered: null,
  bestOddsFrequency: '45.00',
  marginVsConsensus: '1.20',
  outlierFrequency: '5.00',
  firstMoverFrequency: '30.00',
  lineMovementLag: 45,
  sharpBookRating: 8,
  marketEfficiency: '78.00',
  sportsCovered: ['basketball_nba', 'americanfootball_nfl'],
  marketsCovered: ['h2h', 'spreads'],
  uptimePercentage: null,
  oddsUpdateFrequency: 300,
  averageOddsAge: 120,
  limitProfile: 'high',
  estimatedMaxBet: '5000.00',
  accountLimitReports: 0,
  totalGamesOffered: 12,
  totalMarketsOffered: 24,
  averageMargin: '1.20',
  userRating: null,
  userReviewCount: 0,
  recommendationScore: null,
  calculatedAt: new Date('2026-05-19T02:00:00.000Z'),
  updatedAt: new Date('2026-05-19T02:00:00.000Z'),
};

describe('GET /api/analytics/bookmakers/rankings', () => {
  it('returns ranked list with default criteria', async () => {
    mockService.rankBookmakers.mockResolvedValue([sampleRow] as any);

    const res = await request(app).get('/api/analytics/bookmakers/rankings');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rankings).toHaveLength(1);
    expect(res.body.data.criteria).toBe('recommendation');
  });

  it('returns empty array when no bookmakers exist', async () => {
    mockService.rankBookmakers.mockResolvedValue([]);

    const res = await request(app).get('/api/analytics/bookmakers/rankings?criteria=sharpness');

    expect(res.status).toBe(200);
    expect(res.body.data.rankings).toHaveLength(0);
    expect(res.body.data.criteria).toBe('sharpness');
  });
});

describe('GET /api/analytics/bookmakers/sharp', () => {
  it('returns bookmakers with sharpBookRating >= 8', async () => {
    mockPrisma.bookmakerAnalytics.findMany.mockResolvedValue([sampleRow] as any);

    const res = await request(app).get('/api/analytics/bookmakers/sharp');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns empty array when no sharp bookmakers exist', async () => {
    mockPrisma.bookmakerAnalytics.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/analytics/bookmakers/sharp');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe('GET /api/analytics/bookmakers/compare', () => {
  it('returns matched rows for the requested bookmakers', async () => {
    mockPrisma.bookmakerAnalytics.findMany.mockResolvedValue([sampleRow] as any);

    const res = await request(app).get('/api/analytics/bookmakers/compare?books=draftkings,fanduel');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 400 when books param is missing', async () => {
    const res = await request(app).get('/api/analytics/bookmakers/compare');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/books/i);
  });

  it('returns empty array when no bookmakers match', async () => {
    mockPrisma.bookmakerAnalytics.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/analytics/bookmakers/compare?books=unknownbook');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe('GET /api/analytics/bookmakers/best-value/:sport', () => {
  it('returns bookmakers covering the given sport', async () => {
    mockPrisma.bookmakerAnalytics.findMany.mockResolvedValue([sampleRow] as any);

    const res = await request(app).get('/api/analytics/bookmakers/best-value/basketball_nba');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns empty array when no bookmakers cover the sport', async () => {
    mockPrisma.bookmakerAnalytics.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/analytics/bookmakers/best-value/baseball_mlb');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe('GET /api/analytics/bookmakers/movement/:bookmaker', () => {
  it('returns movement summary for the given bookmaker', async () => {
    mockPrisma.bookmakerMovementEvent.findMany.mockResolvedValue([
      { firstMover: 'draftkings', movementSize: '2.50', followers: [{ bookmaker: 'fanduel', lagSeconds: 20 }], detectedAt: new Date() },
    ] as any);

    const res = await request(app).get('/api/analytics/bookmakers/movement/draftkings');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.bookmaker).toBe('draftkings');
    expect(res.body.data.totalFirstMoves).toBe(1);
    expect(res.body.data.followerBooks).toContain('fanduel');
  });

  it('returns zero counts when no events exist', async () => {
    mockPrisma.bookmakerMovementEvent.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/analytics/bookmakers/movement/unknownbook');

    expect(res.status).toBe(200);
    expect(res.body.data.totalFirstMoves).toBe(0);
    expect(res.body.data.followerBooks).toHaveLength(0);
  });
});

describe('GET /api/analytics/bookmakers/:bookmaker', () => {
  it('returns persisted analytics row when it exists', async () => {
    mockPrisma.bookmakerAnalytics.findUnique.mockResolvedValue(sampleRow as any);

    const res = await request(app).get('/api/analytics/bookmakers/draftkings');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.bookmaker).toBe('draftkings');
    expect(res.body.data.recommendationScore).toBeNull();
  });

  it('returns 404 when no analytics row exists yet', async () => {
    mockPrisma.bookmakerAnalytics.findUnique.mockResolvedValue(null as any);

    const res = await request(app).get('/api/analytics/bookmakers/newbook');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/No analytics data yet/);
  });
});

describe('GET /api/analytics/bookmakers/:bookmaker/outliers', () => {
  it('returns outlier stats for the given bookmaker', async () => {
    mockConsensusService.getBookmakerOutlierStats.mockResolvedValue({
      bookmaker: 'draftkings',
      totalRecords: 50,
      outlierCount: 5,
      outlierRate: 10,
      avgDeviation: 1.2,
    } as any);

    const res = await request(app).get('/api/analytics/bookmakers/draftkings/outliers');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.outlierRate).toBe(10);
    expect(res.body.data.days).toBe(30);
  });

  it('respects custom days param', async () => {
    mockConsensusService.getBookmakerOutlierStats.mockResolvedValue({
      bookmaker: 'fanduel', totalRecords: 20, outlierCount: 2, outlierRate: 10, avgDeviation: 0.9,
    } as any);

    const res = await request(app).get('/api/analytics/bookmakers/fanduel/outliers?days=7');

    expect(res.status).toBe(200);
    expect(res.body.data.days).toBe(7);
  });
});
