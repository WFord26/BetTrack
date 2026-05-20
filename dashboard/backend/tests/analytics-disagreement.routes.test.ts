/**
 * Integration tests for Analytics Disagreement Routes
 * Tests all 4 endpoints: /live, /game/:gameId, /trends, /bookmaker/:bookmaker
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
    marketConsensus: { findMany: jest.fn() },
  },
}));

jest.mock('../src/services/market-consensus.service', () => ({
  marketConsensusService: {
    findHighDisagreement: jest.fn(),
    getDisagreementForGame: jest.fn(),
    getDisagreementHistory: jest.fn(),
    getBookmakerOutlierStats: jest.fn(),
  },
}));

import app from '../src/app';
import { marketConsensusService } from '../src/services/market-consensus.service';

const mockService = marketConsensusService as jest.Mocked<typeof marketConsensusService>;

describe('Analytics Disagreement Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /api/analytics/disagreement/live ─────────────────────────────────
  describe('GET /api/analytics/disagreement/live', () => {
    it('returns high-disagreement games with defaults', async () => {
      const games = [
        { gameId: 'g1', score: 80, homeTeamName: 'Lakers', awayTeamName: 'Celtics' },
      ];
      mockService.findHighDisagreement.mockResolvedValue(games as any);

      const res = await request(app).get('/api/analytics/disagreement/live');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.games).toEqual(games);
      expect(res.body.data.threshold).toBe(60);
      expect(res.body.data.count).toBe(1);
      expect(mockService.findHighDisagreement).toHaveBeenCalledWith(60, 20);
    });

    it('accepts custom threshold and limit query params', async () => {
      mockService.findHighDisagreement.mockResolvedValue([] as any);

      const res = await request(app)
        .get('/api/analytics/disagreement/live?threshold=75&limit=5');

      expect(res.status).toBe(200);
      expect(res.body.data.threshold).toBe(75);
      expect(mockService.findHighDisagreement).toHaveBeenCalledWith(75, 5);
    });

    it('clamps threshold to [1, 100]', async () => {
      mockService.findHighDisagreement.mockResolvedValue([] as any);

      await request(app).get('/api/analytics/disagreement/live?threshold=200');
      expect(mockService.findHighDisagreement).toHaveBeenCalledWith(100, 20);

      // Note: parseInt('0') || 60 = 60 (0 is falsy, falls back to default 60)
      await request(app).get('/api/analytics/disagreement/live?threshold=0');
      expect(mockService.findHighDisagreement).toHaveBeenCalledWith(60, 20);
    });

    it('clamps limit to [1, 100]', async () => {
      mockService.findHighDisagreement.mockResolvedValue([] as any);

      await request(app).get('/api/analytics/disagreement/live?limit=500');
      expect(mockService.findHighDisagreement).toHaveBeenCalledWith(60, 100);

      // Note: parseInt('-5') = -5, Math.max(1, -5) = 1
      await request(app).get('/api/analytics/disagreement/live?limit=-5');
      expect(mockService.findHighDisagreement).toHaveBeenCalledWith(60, 1);
    });

    it('returns 500 when service throws', async () => {
      mockService.findHighDisagreement.mockRejectedValue(new Error('DB error') as never);

      const res = await request(app).get('/api/analytics/disagreement/live');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Failed to fetch disagreement data');
    });
  });

  // ─── GET /api/analytics/disagreement/game/:gameId ─────────────────────────
  describe('GET /api/analytics/disagreement/game/:gameId', () => {
    it('returns consensus breakdown for a game', async () => {
      const consensus = [
        { marketType: 'h2h', disagreementScore: 72, outlierCount: 2 },
      ];
      mockService.getDisagreementForGame.mockResolvedValue(consensus as any);

      const res = await request(app).get('/api/analytics/disagreement/game/game-123');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(consensus);
      expect(mockService.getDisagreementForGame).toHaveBeenCalledWith('game-123');
    });

    it('returns 500 when service throws', async () => {
      mockService.getDisagreementForGame.mockRejectedValue(new Error('DB error') as never);

      const res = await request(app).get('/api/analytics/disagreement/game/game-123');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Failed to fetch game disagreement');
    });
  });

  // ─── GET /api/analytics/disagreement/trends ──────────────────────────────
  describe('GET /api/analytics/disagreement/trends', () => {
    it('returns 400 when gameId is missing', async () => {
      const res = await request(app).get('/api/analytics/disagreement/trends');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('gameId query param is required');
    });

    it('returns historical disagreement data for a game', async () => {
      const history = [{ timestamp: '2026-05-01', score: 65 }];
      mockService.getDisagreementHistory.mockResolvedValue(history as any);

      const res = await request(app)
        .get('/api/analytics/disagreement/trends?gameId=game-456');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(history);
      expect(mockService.getDisagreementHistory).toHaveBeenCalledWith('game-456', undefined);
    });

    it('passes marketType filter to service', async () => {
      mockService.getDisagreementHistory.mockResolvedValue([] as any);

      await request(app)
        .get('/api/analytics/disagreement/trends?gameId=game-456&marketType=h2h');

      expect(mockService.getDisagreementHistory).toHaveBeenCalledWith('game-456', 'h2h');
    });

    it('returns 500 when service throws', async () => {
      mockService.getDisagreementHistory.mockRejectedValue(new Error('DB error') as never);

      const res = await request(app)
        .get('/api/analytics/disagreement/trends?gameId=game-456');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Failed to fetch disagreement trends');
    });
  });

  // ─── GET /api/analytics/disagreement/bookmaker/:bookmaker ─────────────────
  describe('GET /api/analytics/disagreement/bookmaker/:bookmaker', () => {
    it('returns bookmaker outlier stats with default 30 days', async () => {
      const stats = { outlierFrequency: 12.5, totalGames: 80 };
      mockService.getBookmakerOutlierStats.mockResolvedValue(stats as any);

      const res = await request(app)
        .get('/api/analytics/disagreement/bookmaker/draftkings');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(stats);
      expect(mockService.getBookmakerOutlierStats).toHaveBeenCalledWith('draftkings', 30);
    });

    it('accepts custom days parameter', async () => {
      mockService.getBookmakerOutlierStats.mockResolvedValue({} as any);

      await request(app)
        .get('/api/analytics/disagreement/bookmaker/fanduel?days=14');

      expect(mockService.getBookmakerOutlierStats).toHaveBeenCalledWith('fanduel', 14);
    });

    it('clamps days to [1, 365]', async () => {
      mockService.getBookmakerOutlierStats.mockResolvedValue({} as any);

      await request(app)
        .get('/api/analytics/disagreement/bookmaker/bet365?days=1000');
      expect(mockService.getBookmakerOutlierStats).toHaveBeenCalledWith('bet365', 365);

      // Note: parseInt('0') || 30 = 30 (0 is falsy, falls back to default 30)
      await request(app)
        .get('/api/analytics/disagreement/bookmaker/bet365?days=0');
      expect(mockService.getBookmakerOutlierStats).toHaveBeenCalledWith('bet365', 30);
    });

    it('returns 500 when service throws', async () => {
      mockService.getBookmakerOutlierStats.mockRejectedValue(new Error('DB error') as never);

      const res = await request(app)
        .get('/api/analytics/disagreement/bookmaker/draftkings');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Failed to fetch bookmaker stats');
    });
  });
});
