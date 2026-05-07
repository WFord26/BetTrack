/**
 * Integration tests for Bets Routes
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';

// Mock session-store before any imports that trigger redis
jest.mock('../src/services/session-store.service', () => ({
  initializeSessionStore: jest.fn(),
  shutdownSessionStore: jest.fn(),
  getSessionStore: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
  })),
  sessionStore: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
  },
}));

// Mock auth-session middleware to bypass auth checks
jest.mock('../src/middleware/auth-session.middleware', () => ({
  requireSessionAuth: jest.fn((_req: any, _res: any, next: any) => next()),
  optionalAuth: jest.fn((_req: any, _res: any, next: any) => next()),
  isAuthEnabled: jest.fn(() => false),
  getScopedUserId: jest.fn(() => undefined),
  getUserId: jest.fn(() => null),
  requireAdminAccess: jest.fn((_req: any, _res: any, next: any) => next()),
  attachAuthSession: jest.fn((_req: any, _res: any, next: any) => next()),
}));

// Mock Prisma FIRST
jest.mock('../src/config/database', () => ({
  prisma: {
    bet: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    betLeg: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    betLegFuture: {
      create: jest.fn(),
    },
    game: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
    $transaction: jest.fn(),
  },
}));

// Mock betService
jest.mock('../src/services/bet.service', () => ({
  betService: {
    createBet: jest.fn(),
    getBets: jest.fn(),
    getBetById: jest.fn(),
    updateBet: jest.fn(),
    settleBet: jest.fn(),
    cancelBet: jest.fn(),
    getStats: jest.fn(),
  },
}));

import app from '../src/app';
import { betService } from '../src/services/bet.service';

const mockBetService = betService as jest.Mocked<typeof betService>;

const sampleBet = {
  id: 'bet-uuid-1',
  name: 'Lakers ML',
  betType: 'single',
  stake: '100.00',
  potentialPayout: '190.91',
  oddsAtPlacement: -110,
  status: 'pending',
  teaserPoints: null,
  notes: null,
  userId: null,
  placedAt: new Date().toISOString(),
  settledAt: null,
  actualPayout: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  legs: [],
};

describe('GET /api/bets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with bets list', async () => {
    mockBetService.getBets.mockResolvedValue({
      bets: [sampleBet],
      total: 1,
      limit: 50,
      offset: 0,
    } as any);

    const res = await request(app).get('/api/bets');

    expect(res.status).toBe(200);
    expect(res.body.bets).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('filters by status query param', async () => {
    mockBetService.getBets.mockResolvedValue({
      bets: [],
      total: 0,
      limit: 50,
      offset: 0,
    } as any);

    const res = await request(app).get('/api/bets?status=pending');

    expect(res.status).toBe(200);
    expect(mockBetService.getBets).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' })
    );
  });

  it('filters by betType query param', async () => {
    mockBetService.getBets.mockResolvedValue({
      bets: [],
      total: 0,
      limit: 50,
      offset: 0,
    } as any);

    await request(app).get('/api/bets?betType=parlay');

    expect(mockBetService.getBets).toHaveBeenCalledWith(
      expect.objectContaining({ betType: 'parlay' })
    );
  });
});

describe('GET /api/bets/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with stats data', async () => {
    const statsData = {
      totalBets: 10,
      wonBets: 6,
      lostBets: 3,
      pendingBets: 1,
      winRate: 66.67,
      totalStake: '1000.00',
      totalPayout: '1200.00',
      roi: 20,
    };

    mockBetService.getStats.mockResolvedValue(statsData as any);

    const res = await request(app).get('/api/bets/stats');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toMatchObject({ totalBets: 10 });
  });
});

describe('GET /api/bets/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with bet by id', async () => {
    mockBetService.getBetById.mockResolvedValue(sampleBet as any);

    const res = await request(app).get('/api/bets/00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(200);
  });

  it('returns 404 when bet is not found', async () => {
    mockBetService.getBetById.mockResolvedValue(null as any);

    const res = await request(app).get('/api/bets/00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(404);
  });

  it('returns 400 when id is not a valid UUID', async () => {
    const res = await request(app).get('/api/bets/not-a-uuid');

    expect(res.status).toBe(400);
  });
});

describe('POST /api/bets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a bet and returns 201', async () => {
    mockBetService.createBet.mockResolvedValue(sampleBet as any);

    const res = await request(app)
      .post('/api/bets')
      .send({
        name: 'Lakers ML',
        betType: 'single',
        stake: 100,
        legs: [
          {
            gameId: '00000000-0000-0000-0000-000000000001',
            selectionType: 'moneyline',
            selection: 'home',
            odds: -110,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/bets')
      .send({ betType: 'single' }); // Missing name, stake, legs

    expect(res.status).toBe(400);
  });

  it('returns 400 when stake is negative', async () => {
    const res = await request(app)
      .post('/api/bets')
      .send({
        name: 'Test',
        betType: 'single',
        stake: -10,
        legs: [
          {
            gameId: '00000000-0000-0000-0000-000000000001',
            selectionType: 'moneyline',
            selection: 'home',
            odds: -110,
          },
        ],
      });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/bets/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes a bet and returns 204', async () => {
    mockBetService.cancelBet.mockResolvedValue(undefined as any);

    const res = await request(app).delete('/api/bets/00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(204);
  });
});
