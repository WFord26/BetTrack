/**
 * Integration tests for the arbitrage analytics routes.
 * Covers /live, /history, /stats, /calculator, /:id and /:id/take.
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
    game: { findUnique: jest.fn(), findMany: jest.fn() },
    arbitrageOpportunity: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../src/services/arbitrage.service', () => {
  const actual: any = jest.requireActual('../src/services/arbitrage.service');
  return {
    ...actual,
    arbitrageService: {
      getLiveOpportunities: jest.fn(),
      getHistory: jest.fn(),
      getStats: jest.fn(),
      getById: jest.fn(),
      markTaken: jest.fn(),
    },
  };
});

import app from '../src/app';
import { arbitrageService } from '../src/services/arbitrage.service';

const mockService = arbitrageService as jest.Mocked<typeof arbitrageService>;

const sampleOpportunity = {
  id: 'arb-1',
  gameId: 'game-1',
  arbType: 'two-way',
  marketType: 'h2h',
  profitPercentage: '3.45',
  stake: '1000.00',
  expectedProfit: '34.50',
  legs: [
    { side: 'home', label: 'Lakers', bookmaker: 'bookA', odds: 120, line: null, stake: 458.6, toWin: 1008.9 },
    { side: 'away', label: 'Celtics', bookmaker: 'bookB', odds: -105, line: null, stake: 541.4, toWin: 1057.0 },
  ],
  riskLevel: 'low',
  riskFactors: [],
  limitRisk: false,
  oddsSnapshotAge: 120,
  status: 'active',
};

describe('Analytics Arbitrage Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /live ────────────────────────────────────────────────────────────
  describe('GET /api/analytics/arbitrage/live', () => {
    it('returns active opportunities with defaults', async () => {
      mockService.getLiveOpportunities.mockResolvedValue([sampleOpportunity] as any);

      const res = await request(app).get('/api/analytics/arbitrage/live');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(1);
      expect(mockService.getLiveOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 25 })
      );
    });

    it('passes through filters and clamps the limit', async () => {
      mockService.getLiveOpportunities.mockResolvedValue([] as any);

      const res = await request(app)
        .get('/api/analytics/arbitrage/live')
        .query({ limit: 500, minProfit: 2.5, arbType: 'middle', marketType: 'totals', maxSnapshotAge: 300 });

      expect(res.status).toBe(200);
      expect(mockService.getLiveOpportunities).toHaveBeenCalledWith({
        limit: 100,
        minProfit: 2.5,
        arbType: 'middle',
        marketType: 'totals',
        maxSnapshotAge: 300,
      });
    });

    it('ignores an unrecognised arbType', async () => {
      mockService.getLiveOpportunities.mockResolvedValue([] as any);

      await request(app).get('/api/analytics/arbitrage/live').query({ arbType: 'nonsense' });

      const args = mockService.getLiveOpportunities.mock.calls[0][0] as any;
      expect(args.arbType).toBeUndefined();
    });

    it('returns 500 when the service throws', async () => {
      mockService.getLiveOpportunities.mockRejectedValue(new Error('boom'));

      const res = await request(app).get('/api/analytics/arbitrage/live');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── GET /history ─────────────────────────────────────────────────────────
  describe('GET /api/analytics/arbitrage/history', () => {
    it('returns history with the default window', async () => {
      mockService.getHistory.mockResolvedValue([sampleOpportunity] as any);

      const res = await request(app).get('/api/analytics/arbitrage/history');

      expect(res.status).toBe(200);
      expect(res.body.data.period).toBe('Last 7 days');
      expect(mockService.getHistory).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50, daysBack: 7 })
      );
    });

    it('drops an invalid status filter', async () => {
      mockService.getHistory.mockResolvedValue([] as any);

      await request(app).get('/api/analytics/arbitrage/history').query({ status: 'bogus' });

      const args = mockService.getHistory.mock.calls[0][0] as any;
      expect(args.status).toBeUndefined();
    });
  });

  // ─── GET /stats ───────────────────────────────────────────────────────────
  describe('GET /api/analytics/arbitrage/stats', () => {
    it('returns stats', async () => {
      mockService.getStats.mockResolvedValue({ totalDetected: 12, activeNow: 2 } as any);

      const res = await request(app).get('/api/analytics/arbitrage/stats');

      expect(res.status).toBe(200);
      expect(res.body.data.totalDetected).toBe(12);
      expect(mockService.getStats).toHaveBeenCalledWith(
        expect.objectContaining({ daysBack: 30 })
      );
    });
  });

  // ─── POST /calculator ─────────────────────────────────────────────────────
  describe('POST /api/analytics/arbitrage/calculator', () => {
    it('returns a stake plan for a real arbitrage', async () => {
      const res = await request(app)
        .post('/api/analytics/arbitrage/calculator')
        .send({ odds: [120, -105], totalStake: 1000 });

      expect(res.status).toBe(200);
      expect(res.body.data.isArbitrage).toBe(true);
      expect(res.body.data.stakes).toHaveLength(2);
      expect(res.body.data.guaranteedProfit).toBeGreaterThan(0);
    });

    it('reports a vigged market as not an arbitrage', async () => {
      const res = await request(app)
        .post('/api/analytics/arbitrage/calculator')
        .send({ odds: [-110, -110], totalStake: 500 });

      expect(res.status).toBe(200);
      expect(res.body.data.isArbitrage).toBe(false);
      expect(res.body.data.guaranteedProfit).toBeLessThan(0);
    });

    it('rejects fewer than two legs', async () => {
      const res = await request(app)
        .post('/api/analytics/arbitrage/calculator')
        .send({ odds: [-110], totalStake: 500 });

      expect(res.status).toBe(400);
    });

    it('rejects zero odds', async () => {
      const res = await request(app)
        .post('/api/analytics/arbitrage/calculator')
        .send({ odds: [0, -110], totalStake: 500 });

      expect(res.status).toBe(400);
    });

    it('rejects a non positive stake', async () => {
      const res = await request(app)
        .post('/api/analytics/arbitrage/calculator')
        .send({ odds: [120, -105], totalStake: -10 });

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /:id ─────────────────────────────────────────────────────────────
  describe('GET /api/analytics/arbitrage/:id', () => {
    it('returns the opportunity', async () => {
      mockService.getById.mockResolvedValue(sampleOpportunity as any);

      const res = await request(app).get('/api/analytics/arbitrage/arb-1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('arb-1');
    });

    it('returns 404 when it does not exist', async () => {
      mockService.getById.mockResolvedValue(null as any);

      const res = await request(app).get('/api/analytics/arbitrage/missing');

      expect(res.status).toBe(404);
    });
  });

  // ─── POST /:id/take ───────────────────────────────────────────────────────
  describe('POST /api/analytics/arbitrage/:id/take', () => {
    it('marks the opportunity as taken', async () => {
      mockService.markTaken.mockResolvedValue({ ...sampleOpportunity, status: 'taken' } as any);

      const res = await request(app)
        .post('/api/analytics/arbitrage/arb-1/take')
        .send({ actualProfit: 33.1 });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('taken');
      expect(mockService.markTaken).toHaveBeenCalledWith('arb-1', undefined, 33.1);
    });

    it('returns 404 for an unknown opportunity', async () => {
      mockService.markTaken.mockResolvedValue(null as any);

      const res = await request(app).post('/api/analytics/arbitrage/missing/take').send({});

      expect(res.status).toBe(404);
    });
  });
});
