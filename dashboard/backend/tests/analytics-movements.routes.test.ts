/**
 * Integration tests for Analytics Line Movement Routes
 * Tests all 5 endpoints: /live, /game/:gameId, /history, /bookmaker/:bookmaker, /stats
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';

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

jest.mock('../src/middleware/auth-session.middleware', () => ({
  requireSessionAuth: jest.fn((_req: any, _res: any, next: any) => next()),
  optionalAuth: jest.fn((_req: any, _res: any, next: any) => next()),
  isAuthEnabled: jest.fn(() => false),
  getScopedUserId: jest.fn(() => undefined),
  getUserId: jest.fn(() => null),
  requireAdminAccess: jest.fn((_req: any, _res: any, next: any) => next()),
  attachAuthSession: jest.fn((_req: any, _res: any, next: any) => next()),
}));

jest.mock('../src/config/database', () => ({
  prisma: {
    game: { findUnique: jest.fn() },
    sport: { findUnique: jest.fn() },
    lineMovement: { findMany: jest.fn() },
  },
}));

jest.mock('../src/services/line-movement.service', () => ({
  LineMovementService: jest.fn().mockImplementation(() => ({
    getRecentMovements: jest.fn(),
    getMovementsByType: jest.fn(),
    getGameMovements: jest.fn(),
    getMovementStats: jest.fn(),
    detectMovements: jest.fn(),
  })),
}));

import app from '../src/app';
import { prisma } from '../src/config/database';
import { LineMovementService } from '../src/services/line-movement.service';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Get the mocked instance (created when routes module is loaded)
function getServiceInstance(): jest.Mocked<InstanceType<typeof LineMovementService>> {
  const MockClass = LineMovementService as jest.MockedClass<typeof LineMovementService>;
  return MockClass.mock.instances[0] as any;
}

const steamMove = {
  id: 'mv-1',
  gameId: 'game-1',
  marketType: 'h2h',
  movementType: 'steam',
  linesBefore: { draftkings: { homePrice: -110 } },
  linesAfter: { draftkings: { homePrice: -130 } },
  bookmakerCount: 4,
  averageMovement: { toNumber: () => 20 },
  timeToMove: 300,
  detectedAt: new Date('2026-05-19T10:00:00Z'),
};

const sampleGame = {
  id: 'game-1',
  homeTeamName: 'Lakers',
  awayTeamName: 'Celtics',
  commenceTime: new Date('2026-05-20T19:00:00Z'),
  sportId: 'basketball_nba',
};

describe('Analytics Line Movement Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /api/analytics/movements/live ──────────────────────────────────
  describe('GET /api/analytics/movements/live', () => {
    it('returns recent steam movements by default', async () => {
      const svc = getServiceInstance();
      svc.getMovementsByType.mockResolvedValue([steamMove] as any);

      const res = await request(app).get('/api/analytics/movements/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.movements).toHaveLength(1);
      expect(res.body.data.hoursBack).toBe(4);
      expect(res.body.data.movementType).toBe('steam');
    });

    it('returns all movements when movementType=all', async () => {
      const svc = getServiceInstance();
      svc.getRecentMovements.mockResolvedValue([steamMove] as any);

      const res = await request(app).get('/api/analytics/movements/live?movementType=all');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(svc.getRecentMovements).toHaveBeenCalledWith(4);
    });

    it('returns 400 for invalid movementType', async () => {
      const res = await request(app)
        .get('/api/analytics/movements/live?movementType=invalid');

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toMatch(/Invalid movementType/);
    });

    it('accepts custom limit and hoursBack', async () => {
      const svc = getServiceInstance();
      svc.getMovementsByType.mockResolvedValue([steamMove, steamMove, steamMove] as any);

      const res = await request(app)
        .get('/api/analytics/movements/live?limit=2&hoursBack=8&movementType=steam');

      expect(res.status).toBe(200);
      expect(res.body.data.movements).toHaveLength(2);
      expect(res.body.data.hoursBack).toBe(8);
      expect(svc.getMovementsByType).toHaveBeenCalledWith('steam', 8);
    });

    it('returns 500 when service throws', async () => {
      const svc = getServiceInstance();
      svc.getMovementsByType.mockRejectedValue(new Error('DB error') as never);

      const res = await request(app).get('/api/analytics/movements/live');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toBe('Failed to fetch movements');
    });
  });

  // ─── GET /api/analytics/movements/game/:gameId ──────────────────────────
  describe('GET /api/analytics/movements/game/:gameId', () => {
    it('returns movements for a known game', async () => {
      (mockPrisma.game.findUnique as jest.Mock).mockResolvedValue(sampleGame as any);
      (mockPrisma.sport.findUnique as jest.Mock).mockResolvedValue({ name: 'NBA' } as any);
      const svc = getServiceInstance();
      svc.getGameMovements.mockResolvedValue([steamMove] as any);

      const res = await request(app).get('/api/analytics/movements/game/game-1');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.game.id).toBe('game-1');
      expect(res.body.data.movements).toHaveLength(1);
      expect(svc.getGameMovements).toHaveBeenCalledWith('game-1', 50);
    });

    it('returns 404 when game is not found', async () => {
      (mockPrisma.game.findUnique as jest.Mock).mockResolvedValue(null as any);

      const res = await request(app).get('/api/analytics/movements/game/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toBe('Game not found');
    });

    it('returns 500 when DB throws', async () => {
      (mockPrisma.game.findUnique as jest.Mock).mockRejectedValue(new Error('fail') as never);

      const res = await request(app).get('/api/analytics/movements/game/game-1');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toBe('Failed to fetch movements');
    });
  });

  // ─── GET /api/analytics/movements/history ────────────────────────────────
  describe('GET /api/analytics/movements/history', () => {
    it('returns movement history with stats', async () => {
      const svc = getServiceInstance();
      const stats = { byType: { steam: 2, reverse: 1, gradual: 0, injury: 0, normal: 3 }, byMarket: { h2h: 3, spreads: 2, totals: 1 } };
      svc.getMovementStats.mockResolvedValue(stats as any);
      svc.getRecentMovements.mockResolvedValue([steamMove] as any);

      const res = await request(app).get('/api/analytics/movements/history');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.statistics).toEqual(stats);
      expect(res.body.data.hoursBack).toBe(24);
      expect(res.body.data.period).toBe('Last 24 hours');
    });

    it('filters by movementType when provided', async () => {
      const svc = getServiceInstance();
      svc.getMovementStats.mockResolvedValue({ byType: {}, byMarket: {} } as any);
      svc.getMovementsByType.mockResolvedValue([steamMove] as any);

      const res = await request(app)
        .get('/api/analytics/movements/history?movementType=steam&hoursBack=12');

      expect(res.status).toBe(200);
      expect(svc.getMovementsByType).toHaveBeenCalledWith('steam', 12);
    });

    it('returns 400 for invalid movementType in history', async () => {
      const svc = getServiceInstance();
      svc.getMovementStats.mockResolvedValue({ byType: {}, byMarket: {} } as any);

      const res = await request(app)
        .get('/api/analytics/movements/history?movementType=invalid');

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid movementType/);
    });

    it('groups movements by date', async () => {
      const svc = getServiceInstance();
      svc.getMovementStats.mockResolvedValue({ byType: {}, byMarket: {} } as any);
      const move1 = { ...steamMove, detectedAt: new Date('2026-05-19T10:00:00Z') };
      const move2 = { ...steamMove, detectedAt: new Date('2026-05-18T10:00:00Z') };
      svc.getRecentMovements.mockResolvedValue([move1, move2] as any);

      const res = await request(app).get('/api/analytics/movements/history');

      expect(res.status).toBe(200);
      expect(Object.keys(res.body.data.byDate)).toHaveLength(2);
    });

    it('returns 500 when service throws', async () => {
      const svc = getServiceInstance();
      svc.getMovementStats.mockRejectedValue(new Error('DB error') as never);

      const res = await request(app).get('/api/analytics/movements/history');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch history');
    });
  });

  // ─── GET /api/analytics/movements/bookmaker/:bookmaker ──────────────────
  describe('GET /api/analytics/movements/bookmaker/:bookmaker', () => {
    it('returns bookmaker movement impact stats', async () => {
      const movement = {
        ...steamMove,
        linesBefore: { draftkings: { homePrice: -110 }, fanduel: { homePrice: -115 } },
        linesAfter: { draftkings: { homePrice: -120 }, fanduel: { homePrice: -118 } },
        averageMovement: { toNumber: () => 8 },
      };
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue([movement] as any);

      const res = await request(app)
        .get('/api/analytics/movements/bookmaker/draftkings');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.bookmaker).toBe('draftkings');
      expect(res.body.data.hoursBack).toBe(24);
      expect(res.body.data.impactStats.totalMovements).toBe(1);
    });

    it('filters out movements without the bookmaker', async () => {
      const movement = {
        ...steamMove,
        linesBefore: { fanduel: { homePrice: -110 } },
        linesAfter: { fanduel: { homePrice: -120 } },
      };
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue([movement] as any);

      const res = await request(app)
        .get('/api/analytics/movements/bookmaker/draftkings');

      expect(res.status).toBe(200);
      expect(res.body.data.impactStats.totalMovements).toBe(0);
    });

    it('filters by marketType when provided', async () => {
      const movement = {
        ...steamMove,
        marketType: 'spreads',
        linesBefore: { draftkings: { homeSpread: -3.5 } },
        linesAfter: { draftkings: { homeSpread: -4 } },
      };
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue([movement] as any);

      const res = await request(app)
        .get('/api/analytics/movements/bookmaker/draftkings?marketType=h2h');

      expect(res.status).toBe(200);
      expect(res.body.data.impactStats.totalMovements).toBe(0);
    });

    it('returns 500 when DB throws', async () => {
      (mockPrisma.lineMovement.findMany as jest.Mock).mockRejectedValue(new Error('fail') as never);

      const res = await request(app)
        .get('/api/analytics/movements/bookmaker/draftkings');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch bookmaker movements');
    });
  });

  // ─── GET /api/analytics/movements/stats ─────────────────────────────────
  describe('GET /api/analytics/movements/stats', () => {
    it('returns movement statistics with defaults', async () => {
      const svc = getServiceInstance();
      const stats = { byType: { steam: 3, reverse: 1, gradual: 2, injury: 0, normal: 5 }, byMarket: { h2h: 4, spreads: 5, totals: 2 } };
      svc.getMovementStats.mockResolvedValue(stats as any);
      svc.getMovementsByType.mockResolvedValue([steamMove, steamMove, steamMove] as any);

      const res = await request(app).get('/api/analytics/movements/stats');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.period).toBe('Last 24 hours');
      expect(res.body.data.statistics).toEqual(stats);
      expect(res.body.data.steamMovesCount).toBe(3);
      expect(res.body.data.totalMovements).toBe(11);
    });

    it('accepts custom hoursBack', async () => {
      const svc = getServiceInstance();
      svc.getMovementStats.mockResolvedValue({ byType: { steam: 0, reverse: 0, gradual: 0, injury: 0, normal: 0 }, byMarket: {} } as any);
      svc.getMovementsByType.mockResolvedValue([] as any);

      await request(app).get('/api/analytics/movements/stats?hoursBack=48');

      expect(svc.getMovementStats).toHaveBeenCalledWith(48);
    });

    it('returns 500 when service throws', async () => {
      const svc = getServiceInstance();
      svc.getMovementStats.mockRejectedValue(new Error('DB error') as never);

      const res = await request(app).get('/api/analytics/movements/stats');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch statistics');
    });
  });
});
