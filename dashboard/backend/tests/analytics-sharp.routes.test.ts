/**
 * Integration tests for Analytics Sharp Money Routes
 * Tests all 4 endpoints: /live, /game/:gameId, /contrarian, /stats
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
    sharpMoneyIndicator: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

jest.mock('../src/services/sharp-indicator.service', () => ({
  sharpIndicatorService: {
    getLatestIndicators: jest.fn(),
    getIndicatorsForGame: jest.fn(),
    findContrarianOpportunities: jest.fn(),
    getStats: jest.fn(),
  },
}));

import app from '../src/app';
import { prisma } from '../src/config/database';
import { sharpIndicatorService } from '../src/services/sharp-indicator.service';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockService = sharpIndicatorService as jest.Mocked<typeof sharpIndicatorService>;

const sampleGame = {
  id: 'game-1',
  homeTeamName: 'Lakers',
  awayTeamName: 'Celtics',
  commenceTime: new Date('2026-05-20T19:00:00Z'),
  status: 'scheduled',
  sport: { key: 'basketball_nba', name: 'NBA' },
};

describe('Analytics Sharp Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /api/analytics/sharp/live ────────────────────────────────────────
  describe('GET /api/analytics/sharp/live', () => {
    it('returns latest sharp indicators with defaults', async () => {
      const indicators = [
        { gameId: 'game-1', marketType: 'h2h', sharpSide: 'home', sharpConfidence: 7 },
      ];
      mockService.getLatestIndicators.mockResolvedValue(indicators as any);

      const res = await request(app).get('/api/analytics/sharp/live');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.indicators).toEqual(indicators);
      expect(res.body.data.count).toBe(1);
      expect(mockService.getLatestIndicators).toHaveBeenCalledWith(20);
    });

    it('accepts custom limit', async () => {
      mockService.getLatestIndicators.mockResolvedValue([] as any);

      await request(app).get('/api/analytics/sharp/live?limit=5');

      expect(mockService.getLatestIndicators).toHaveBeenCalledWith(5);
    });

    it('clamps limit to [1, 100]', async () => {
      mockService.getLatestIndicators.mockResolvedValue([] as any);

      await request(app).get('/api/analytics/sharp/live?limit=999');
      expect(mockService.getLatestIndicators).toHaveBeenCalledWith(100);

      await request(app).get('/api/analytics/sharp/live?limit=-1');
      expect(mockService.getLatestIndicators).toHaveBeenCalledWith(1);
    });

    it('returns 500 when service throws', async () => {
      mockService.getLatestIndicators.mockRejectedValue(new Error('DB error') as never);

      const res = await request(app).get('/api/analytics/sharp/live');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Failed to fetch sharp indicators');
    });
  });

  // ─── GET /api/analytics/sharp/game/:gameId ────────────────────────────────
  describe('GET /api/analytics/sharp/game/:gameId', () => {
    it('returns sharp indicators for a known game', async () => {
      const indicators = [
        { gameId: 'game-1', marketType: 'h2h', sharpSide: 'home', sharpConfidence: 8 },
      ];
      (mockPrisma.game.findUnique as jest.Mock).mockResolvedValue(sampleGame as any);
      mockService.getIndicatorsForGame.mockResolvedValue(indicators as any);

      const res = await request(app).get('/api/analytics/sharp/game/game-1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.game.id).toBe('game-1');
      expect(res.body.data.game.matchup).toBe('Celtics @ Lakers');
      expect(res.body.data.game.sport).toBe('NBA');
      expect(res.body.data.indicators).toEqual(indicators);
      expect(mockService.getIndicatorsForGame).toHaveBeenCalledWith('game-1');
    });

    it('returns 404 when game is not found', async () => {
      (mockPrisma.game.findUnique as jest.Mock).mockResolvedValue(null as any);

      const res = await request(app).get('/api/analytics/sharp/game/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Game not found');
    });

    it('returns 500 when DB throws', async () => {
      (mockPrisma.game.findUnique as jest.Mock).mockRejectedValue(new Error('DB error') as never);

      const res = await request(app).get('/api/analytics/sharp/game/game-1');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Failed to fetch game indicators');
    });
  });

  // ─── GET /api/analytics/sharp/contrarian ──────────────────────────────────
  describe('GET /api/analytics/sharp/contrarian', () => {
    it('returns contrarian opportunities with default parameters', async () => {
      const opportunities = [
        { gameId: 'game-2', maxConfidence: 7, homeTeamName: 'Heat', awayTeamName: 'Knicks' },
      ];
      mockService.findContrarianOpportunities.mockResolvedValue(opportunities as any);

      const res = await request(app).get('/api/analytics/sharp/contrarian');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.opportunities).toEqual(opportunities);
      expect(res.body.data.count).toBe(1);
      expect(res.body.data.minConfidence).toBe(6);
      expect(mockService.findContrarianOpportunities).toHaveBeenCalledWith(6, 20);
    });

    it('accepts custom minConfidence and limit', async () => {
      mockService.findContrarianOpportunities.mockResolvedValue([] as any);

      await request(app).get('/api/analytics/sharp/contrarian?minConfidence=8&limit=10');

      expect(mockService.findContrarianOpportunities).toHaveBeenCalledWith(8, 10);
    });

    it('clamps minConfidence to [1, 10]', async () => {
      mockService.findContrarianOpportunities.mockResolvedValue([] as any);

      await request(app).get('/api/analytics/sharp/contrarian?minConfidence=20');
      expect(mockService.findContrarianOpportunities).toHaveBeenCalledWith(10, 20);

      // Note: parseInt('0') || 6 = 6 (0 is falsy, falls back to default 6)
      await request(app).get('/api/analytics/sharp/contrarian?minConfidence=0');
      expect(mockService.findContrarianOpportunities).toHaveBeenCalledWith(6, 20);
    });

    it('returns 500 when service throws', async () => {
      mockService.findContrarianOpportunities.mockRejectedValue(new Error('DB error') as never);

      const res = await request(app).get('/api/analytics/sharp/contrarian');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Failed to fetch contrarian opportunities');
    });
  });

  // ─── GET /api/analytics/sharp/stats ──────────────────────────────────────
  describe('GET /api/analytics/sharp/stats', () => {
    it('returns sharp stats with default 24-hour window', async () => {
      const stats = { totalIndicators: 12, steamMoves: 4, avgConfidence: 6.5 };
      mockService.getStats.mockResolvedValue(stats as any);

      const res = await request(app).get('/api/analytics/sharp/stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalIndicators).toBe(12);
      expect(res.body.data.period).toBe('Last 24 hours');
      expect(mockService.getStats).toHaveBeenCalledWith(24);
    });

    it('accepts custom hoursBack', async () => {
      mockService.getStats.mockResolvedValue({} as any);

      await request(app).get('/api/analytics/sharp/stats?hoursBack=48');

      expect(mockService.getStats).toHaveBeenCalledWith(48);
    });

    it('clamps hoursBack to [1, 168]', async () => {
      mockService.getStats.mockResolvedValue({} as any);

      await request(app).get('/api/analytics/sharp/stats?hoursBack=999');
      expect(mockService.getStats).toHaveBeenCalledWith(168);

      // Note: parseInt('0') || 24 = 24 (0 is falsy, falls back to default 24)
      await request(app).get('/api/analytics/sharp/stats?hoursBack=0');
      expect(mockService.getStats).toHaveBeenCalledWith(24);
    });

    it('returns 500 when service throws', async () => {
      mockService.getStats.mockRejectedValue(new Error('DB error') as never);

      const res = await request(app).get('/api/analytics/sharp/stats');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Failed to fetch sharp stats');
    });
  });
});
