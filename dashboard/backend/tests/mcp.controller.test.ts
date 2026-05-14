/**
 * Integration tests for MCP Controller / Routes (M9)
 *
 * Covers:
 *  1. Multi-tenant isolation — two API keys see only their own bets/stats
 *  2. Permission enforcement — read vs write keys
 *  3. Validation errors — bad odds, missing fields
 *  4. Date-window correctness for /games/with-exposure
 *  5. quick-create userId attribution
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Prevent redis / session-store from initialising during tests
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Bypass session auth (MCP routes use apiKeyAuth, not sessions)
// ---------------------------------------------------------------------------
jest.mock('../src/middleware/auth-session.middleware', () => ({
  requireSessionAuth: jest.fn((_req: any, _res: any, next: any) => next()),
  optionalAuth: jest.fn((_req: any, _res: any, next: any) => next()),
  isAuthEnabled: jest.fn(() => false),
  getScopedUserId: jest.fn(() => undefined),
  getUserId: jest.fn(() => null),
  requireAdminAccess: jest.fn((_req: any, _res: any, next: any) => next()),
  attachAuthSession: jest.fn((_req: any, _res: any, next: any) => next()),
}));

// ---------------------------------------------------------------------------
// Control the API key context injected into req.apiKey
// This lets each test set the userId and permissions independently.
// ---------------------------------------------------------------------------
let mockApiKeyContext: {
  id: string;
  userId: string | null;
  name: string;
  permissions: Record<string, boolean>;
} = {
  id: 'key-id-1',
  userId: 'user-a',
  name: 'Test Key',
  permissions: { read: true, write: true, bets: true, stats: true }
};

jest.mock('../src/middleware/api-key-auth', () => ({
  apiKeyAuth: jest.fn((req: any, _res: any, next: any) => {
    req.apiKey = mockApiKeyContext;
    next();
  }),
  requirePermission: jest.fn((permission: string) => (req: any, res: any, next: any) => {
    const perms = req.apiKey?.permissions ?? {};
    if (!perms[permission]) {
      return res.status(403).json({
        success: false,
        error: `Permission '${permission}' required`
      });
    }
    next();
  }),
}));

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------
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
    betLegFuture: { create: jest.fn() },
    game: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    currentOdds: {
      findMany: jest.fn(),
    },
    team: {
      findMany: jest.fn(),
    },
    adminSettings: {
      upsert: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
    $transaction: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock betService
// ---------------------------------------------------------------------------
jest.mock('../src/services/bet.service', () => ({
  betService: {
    createBet: jest.fn(),
    getBets: jest.fn(),
    getStats: jest.fn(),
    updateBet: jest.fn(),
    settleBet: jest.fn(),
  },
}));

import app from '../src/app';
import { betService } from '../src/services/bet.service';
import { prisma } from '../src/config/database';

const mockBetService = betService as jest.Mocked<typeof betService>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const makeBet = (overrides: Record<string, unknown> = {}) => ({
  id: 'bet-uuid-1',
  name: 'Lakers ML',
  betType: 'single',
  stake: { toNumber: () => 100 },
  potentialPayout: { toNumber: () => 190.91 },
  oddsAtPlacement: -110,
  status: 'pending',
  placedAt: new Date(),
  settledAt: null,
  actualPayout: null,
  teaserPoints: null,
  notes: null,
  userId: 'user-a',
  legs: [],
  ...overrides,
});

const paginatedBets = (bets: ReturnType<typeof makeBet>[]) => ({
  bets,
  total: bets.length,
  limit: 100,
  offset: 0,
});

const defaultStats = {
  totalBets: 5,
  wonBets: 3,
  lostBets: 2,
  pushBets: 0,
  pendingBets: 0,
  winRate: 60,
  totalStaked: 500,
  totalPayout: 600,
  netProfit: 100,
  roi: 20,
  byBetType: {},
  bySport: {},
};

const defaultAdminSettings = {
  id: 'singleton',
  riskHighThreshold: 1000,
  riskModerateThreshold: 500,
  winRateLow: 45,
  winRateHigh: 55,
  updatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// Suite 1: Multi-tenant data isolation
// ---------------------------------------------------------------------------
describe('MCP multi-tenant isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to a full-permission user-a context
    mockApiKeyContext = {
      id: 'key-id-1',
      userId: 'user-a',
      name: 'User A Key',
      permissions: { read: true, write: true, bets: true, stats: true }
    };
  });

  it('GET /api/mcp/bets/active passes userId=user-a to betService', async () => {
    mockBetService.getBets.mockResolvedValue(paginatedBets([makeBet()]) as any);

    const res = await request(app)
      .get('/api/mcp/bets/active')
      .set('Authorization', 'Bearer sk_user_a_key');

    expect(res.status).toBe(200);
    expect(mockBetService.getBets).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-a', status: 'pending' })
    );
  });

  it('GET /api/mcp/bets/active passes userId=user-b when key belongs to user-b', async () => {
    mockApiKeyContext = {
      id: 'key-id-2',
      userId: 'user-b',
      name: 'User B Key',
      permissions: { read: true, write: true, bets: true, stats: true }
    };
    mockBetService.getBets.mockResolvedValue(paginatedBets([]) as any);

    await request(app)
      .get('/api/mcp/bets/active')
      .set('Authorization', 'Bearer sk_user_b_key');

    expect(mockBetService.getBets).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-b' })
    );
  });

  it('GET /api/mcp/bets/summary scopes stats to calling userId', async () => {
    mockBetService.getBets.mockResolvedValue(paginatedBets([]) as any);
    mockBetService.getStats.mockResolvedValue(defaultStats as any);

    await request(app)
      .get('/api/mcp/bets/summary')
      .set('Authorization', 'Bearer sk_user_a_key');

    // Every getStats call must include the userId
    const statsCalls = mockBetService.getStats.mock.calls as unknown[][];
    expect(statsCalls.length).toBeGreaterThan(0);
    statsCalls.forEach(([filters]: any) => {
      expect(filters).toMatchObject({ userId: 'user-a' });
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Permission enforcement
// ---------------------------------------------------------------------------
describe('MCP permission enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/mcp/bets/active returns 403 when bets permission is false', async () => {
    mockApiKeyContext = {
      id: 'key-id-3',
      userId: 'user-a',
      name: 'Read-only Key',
      permissions: { read: true, write: false, bets: false, stats: true }
    };

    const res = await request(app)
      .get('/api/mcp/bets/active')
      .set('Authorization', 'Bearer sk_readonly_key');

    expect(res.status).toBe(403);
  });

  it('POST /api/mcp/bets/quick-create returns 403 when write permission is false', async () => {
    mockApiKeyContext = {
      id: 'key-id-4',
      userId: 'user-a',
      name: 'No-write Key',
      permissions: { read: true, write: false, bets: true, stats: true }
    };

    const res = await request(app)
      .post('/api/mcp/bets/quick-create')
      .set('Authorization', 'Bearer sk_nowrite_key')
      .send({
        game_id: '550e8400-e29b-41d4-a716-446655440000',
        selection_type: 'moneyline',
        selection: 'home',
        stake: 10,
        odds: -110
      });

    expect(res.status).toBe(403);
  });

  it('GET /api/mcp/bets/summary returns 403 when stats permission is false', async () => {
    mockApiKeyContext = {
      id: 'key-id-5',
      userId: 'user-a',
      name: 'No-stats Key',
      permissions: { read: true, write: true, bets: true, stats: false }
    };

    const res = await request(app)
      .get('/api/mcp/bets/summary')
      .set('Authorization', 'Bearer sk_nostats_key');

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Validation errors
// ---------------------------------------------------------------------------
describe('MCP validation errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiKeyContext = {
      id: 'key-id-1',
      userId: 'user-a',
      name: 'Test Key',
      permissions: { read: true, write: true, bets: true, stats: true }
    };
  });

  it('POST /api/mcp/bets/quick-create returns 400 for invalid American odds (odds=50)', async () => {
    const res = await request(app)
      .post('/api/mcp/bets/quick-create')
      .set('Authorization', 'Bearer sk_test_key')
      .send({
        game_id: '550e8400-e29b-41d4-a716-446655440000',
        selection_type: 'moneyline',
        selection: 'home',
        stake: 10,
        odds: 50  // invalid — must be ≥ +100 or ≤ -100
      });

    expect(res.status).toBe(400);
  });

  it('POST /api/mcp/bets/quick-create returns 400 when game_id is missing', async () => {
    const res = await request(app)
      .post('/api/mcp/bets/quick-create')
      .set('Authorization', 'Bearer sk_test_key')
      .send({
        selection_type: 'moneyline',
        selection: 'home',
        stake: 10,
        odds: -110
        // game_id intentionally omitted
      });

    expect(res.status).toBe(400);
  });

  it('POST /api/mcp/bets/quick-create returns 400 when game_id is not a UUID', async () => {
    const res = await request(app)
      .post('/api/mcp/bets/quick-create')
      .set('Authorization', 'Bearer sk_test_key')
      .send({
        game_id: 'not-a-uuid',
        selection_type: 'moneyline',
        selection: 'home',
        stake: 10,
        odds: -110
      });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Suite 4: Date-window correctness for /games/with-exposure
// ---------------------------------------------------------------------------
describe('MCP /games/with-exposure date window', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiKeyContext = {
      id: 'key-id-1',
      userId: 'user-a',
      name: 'Test Key',
      permissions: { read: true, write: true, bets: true, stats: true }
    };
  });

  it('includes games that started earlier today', async () => {
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

    const gameEarlierToday = {
      id: 'game-uuid-1',
      homeTeamName: 'Lakers',
      awayTeamName: 'Celtics',
      sport: { name: 'NBA', key: 'basketball_nba' },
      commenceTime: twoHoursAgo,
      status: 'in_progress',
      homeScore: null,
      awayScore: null,
      betLegs: []
    };

    (mockPrisma.game.findMany as jest.Mock).mockResolvedValue([gameEarlierToday] as any);

    const res = await request(app)
      .get('/api/mcp/games/with-exposure')
      .set('Authorization', 'Bearer sk_test_key');

    expect(res.status).toBe(200);
    expect(res.body.data.games).toHaveLength(1);
    expect(res.body.data.games[0].id).toBe('game-uuid-1');

    // Verify the date range passed to Prisma starts at today midnight (not now)
    const whereArg = (mockPrisma.game.findMany as jest.Mock).mock.calls[0][0] as any;
    const gte: Date = whereArg.where.commenceTime.gte;
    expect(gte.getHours()).toBe(0);
    expect(gte.getMinutes()).toBe(0);
    expect(gte.getSeconds()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 5: quick-create userId attribution
// ---------------------------------------------------------------------------
describe('MCP quick-create userId attribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiKeyContext = {
      id: 'key-id-1',
      userId: 'user-a',
      name: 'Test Key',
      permissions: { read: true, write: true, bets: true, stats: true }
    };
  });

  it('passes userId from API key to betService.createBet', async () => {
    const mockGame = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      homeTeamName: 'Lakers',
      awayTeamName: 'Celtics',
      sport: { name: 'NBA', key: 'basketball_nba' }
    };

    (mockPrisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame as any);
    mockBetService.createBet.mockResolvedValue(makeBet() as any);

    const res = await request(app)
      .post('/api/mcp/bets/quick-create')
      .set('Authorization', 'Bearer sk_test_key')
      .send({
        game_id: '550e8400-e29b-41d4-a716-446655440000',
        selection_type: 'moneyline',
        selection: 'home',
        stake: 10,
        odds: -110
      });

    expect(res.status).toBe(201);
    // betService.createBet(betData, userId) — userId must be 'user-a'
    expect(mockBetService.createBet).toHaveBeenCalledWith(
      expect.any(Object),
      'user-a'
    );
  });

  it('passes userId=undefined when API key has no associated user', async () => {
    mockApiKeyContext = {
      id: 'key-id-anon',
      userId: null,
      name: 'Anonymous Key',
      permissions: { read: true, write: true, bets: true, stats: true }
    };

    const mockGame = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      homeTeamName: 'Heat',
      awayTeamName: 'Warriors',
      sport: { name: 'NBA', key: 'basketball_nba' }
    };

    (mockPrisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame as any);
    mockBetService.createBet.mockResolvedValue(makeBet({ userId: null }) as any);

    await request(app)
      .post('/api/mcp/bets/quick-create')
      .set('Authorization', 'Bearer sk_anon_key')
      .send({
        game_id: '550e8400-e29b-41d4-a716-446655440000',
        selection_type: 'moneyline',
        selection: 'home',
        stake: 10,
        odds: -110
      });

    expect(mockBetService.createBet).toHaveBeenCalledWith(
      expect.any(Object),
      undefined
    );
  });
});
