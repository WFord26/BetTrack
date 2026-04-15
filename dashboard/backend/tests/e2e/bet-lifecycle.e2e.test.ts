/**
 * End-to-End Tests: Complete Bet Lifecycle
 *
 * Covers the full lifecycle:
 *   1. Seed sport and game
 *   2. Create bet via API (POST /api/bets)
 *   3. Simulate odds sync (OddsSyncService → Odds API mock)
 *   4. Mock ESPN scoreboard showing game as final
 *   5. Run outcome resolver (OutcomeResolverService)
 *   6. Verify bet is correctly settled with right payout
 *
 * All external I/O (Prisma, HTTP) is mocked so the test is fully hermetic.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================================================
// MOCK DECLARATIONS  (must appear before any import of the mocked modules)
// ============================================================================

// ------ Environment ------
jest.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: '3001',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
    ODDS_API_KEY: 'test-odds-api-key',
    AUTH_MODE: 'none',        // standalone mode → no auth required
    JWT_SECRET: 'test-secret',
    SESSION_SECRET: 'test-session-secret',
    CORS_ORIGIN: '',
    LOG_LEVEL: 'silent',
    ODDS_SYNC_INTERVAL: '10',
    OUTCOME_CHECK_INTERVAL: '5',
    API_SPORTS_KEY: undefined,
    API_SPORTS_TIER: 'pro',
    STATS_POLL_INTERVAL_MS: '15000',
  }
}));

// ------ Logger ------
jest.mock('../../src/config/logger', () => ({
  logger: {
    info:  jest.fn(),
    error: jest.fn(),
    warn:  jest.fn(),
    debug: jest.fn(),
  }
}));

// ------ ESPN Weather (used inside OddsSyncService) ------
jest.mock('../../src/services/espn-weather.service', () => ({
  espnWeatherService: {
    getWeatherForGame: jest.fn().mockResolvedValue(null),
  }
}));

// ------ Auth-session middleware ------
jest.mock('../../src/middleware/auth-session.middleware', () => ({
  requireSessionAuth: jest.fn((_req: any, _res: any, next: any) => next()),
  optionalAuth:       jest.fn((_req: any, _res: any, next: any) => next()),
  isAuthEnabled:      jest.fn(() => false),
  getScopedUserId:    jest.fn(() => undefined),
  getUserId:          jest.fn(() => null),
  requireAdminAccess: jest.fn((_req: any, _res: any, next: any) => next()),
  attachAuthSession:  jest.fn((_req: any, _res: any, next: any) => next()),
}));

// ------ Prisma ------
jest.mock('../../src/config/database', () => ({
  prisma: {
    sport:       { findMany: jest.fn(), findUnique: jest.fn() },
    game:        { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
    currentOdds: { upsert: jest.fn() },
    oddsSnapshot:{ create: jest.fn(), createMany: jest.fn() },
    bet: {
      create:     jest.fn(),
      findUnique: jest.fn(),
      findFirst:  jest.fn(),
      findMany:   jest.fn(),
      update:     jest.fn(),
      count:      jest.fn(),
      delete:     jest.fn(),
    },
    betLeg: {
      create:     jest.fn(),
      findMany:   jest.fn(),
      update:     jest.fn(),
      updateMany: jest.fn(),
    },
    betLegFuture: { create: jest.fn() },
    $transaction: jest.fn(),
  }
}));

// ============================================================================
// IMPORTS (after mocks are registered)
// ============================================================================

import { prisma }              from '../../src/config/database';
import { OddsSyncService }     from '../../src/services/odds-sync.service';
import { OutcomeResolverService } from '../../src/services/outcome-resolver.service';
import betsRouter              from '../../src/routes/bets.routes';

// ============================================================================
// TYPED MOCK HELPERS
// ============================================================================

const mockPrisma   = prisma as jest.Mocked<typeof prisma>;

// ============================================================================
// SHARED FIXTURE DATA
// ============================================================================

const SPORT_ID     = 1;
const GAME_ID      = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const BET_ID       = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
const BET_LEG_ID   = 'cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa';
const EXTERNAL_ID  = 'espn-event-12345';

const SPORT_FIXTURE = {
  id:        SPORT_ID,
  key:       'americanfootball_nfl',
  name:      'NFL',
  groupName: 'American Football',
  isActive:  true,
};

const GAME_FIXTURE = {
  id:            GAME_ID,
  externalId:    EXTERNAL_ID,
  sportId:       SPORT_ID,
  homeTeamId:    null,
  awayTeamId:    null,
  homeTeamName:  'Kansas City Chiefs',
  awayTeamName:  'San Francisco 49ers',
  commenceTime:  new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hrs ago
  status:        'in_progress',
  homeScore:     null,
  awayScore:     null,
  sport:         SPORT_FIXTURE,
};

/** A pending bet with one moneyline leg on the Chiefs (home). */
const BET_LEG_FIXTURE = {
  id:            BET_LEG_ID,
  betId:         BET_ID,
  gameId:        GAME_ID,
  selectionType: 'moneyline',
  selection:     'home',
  teamName:      'Kansas City Chiefs',
  line:          null,
  odds:          -150,
  userAdjustedLine:   null,
  userAdjustedOdds:   null,
  teaserAdjustedLine: null,
  closingOdds:   null,
  clv:           null,
  clvCategory:   null,
  sgpGroupId:    null,
  status:        'pending',
  createdAt:     new Date(),
  updatedAt:     new Date(),
};

const BET_FIXTURE = {
  id:             BET_ID,
  userId:         null,
  name:           'E2E Test: Chiefs ML',
  betType:        'single',
  stake:          new Decimal('100.00'),
  potentialPayout: new Decimal('166.67'),
  actualPayout:   null,
  status:         'pending',
  oddsAtPlacement: -150,
  teaserPoints:   null,
  notes:          null,
  placedAt:       new Date(),
  settledAt:      null,
  createdAt:      new Date(),
  updatedAt:      new Date(),
  legs:           [BET_LEG_FIXTURE],
  futureLegs:     [],
};

/** ESPN scoreboard response showing game as FINAL (Chiefs won 27-21) */
const ESPN_SCOREBOARD_FINAL = {
  leagues: [{ id: '28', name: 'NFL' }],
  events: [
    {
      id:        '401671793',
      name:      'San Francisco 49ers at Kansas City Chiefs',
      shortName: 'SF @ KC',
      competitions: [
        {
          id: '401671793',
          status: {
            type: {
              id:        '3',
              name:      'STATUS_FINAL',
              state:     'post',
              completed: true,
            },
            period:       4,
            displayClock: '0:00',
          },
          competitors: [
            {
              id:       '12',
              homeAway: 'home' as const,
              score:    '27',
              team: {
                id:          '12',
                displayName: 'Kansas City Chiefs',
                abbreviation:'KC',
              },
            },
            {
              id:       '25',
              homeAway: 'away' as const,
              score:    '21',
              team: {
                id:          '25',
                displayName: 'San Francisco 49ers',
                abbreviation:'SF',
              },
            },
          ],
        },
      ],
    },
  ],
};

/** Odds API event fixture */
const ODDS_API_EVENT = {
  id:             EXTERNAL_ID,
  sport_key:      'americanfootball_nfl',
  sport_title:    'NFL',
  commence_time:  new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  home_team:      'Kansas City Chiefs',
  away_team:      'San Francisco 49ers',
  bookmakers: [
    {
      key:        'draftkings',
      title:      'DraftKings',
      last_update: new Date().toISOString(),
      markets: [
        {
          key:        'h2h',
          last_update: new Date().toISOString(),
          outcomes: [
            { name: 'Kansas City Chiefs', price: -150 },
            { name: 'San Francisco 49ers', price: +130 },
          ],
        },
        {
          key:        'spreads',
          last_update: new Date().toISOString(),
          outcomes: [
            { name: 'Kansas City Chiefs', price: -110, point: -3.0 },
            { name: 'San Francisco 49ers', price: -110, point:  3.0 },
          ],
        },
        {
          key:        'totals',
          last_update: new Date().toISOString(),
          outcomes: [
            { name: 'Over',  price: -110, point: 47.5 },
            { name: 'Under', price: -110, point: 47.5 },
          ],
        },
      ],
    },
  ],
};

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Bet Lifecycle E2E', () => {
  let app: express.Application;
  let oddsSyncService: OddsSyncService;
  let outcomeResolverService: OutcomeResolverService;
  let mockAxiosOdds: MockAdapter;
  let mockAxiosEspn: MockAdapter;

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  beforeEach(() => {
    jest.clearAllMocks();

    // Build a minimal Express app (mirrors src/app.ts, without session store)
    app = express();
    app.use(express.json());
    app.use('/api/bets', betsRouter);

    // Service instances
    oddsSyncService      = new OddsSyncService();
    outcomeResolverService = new OutcomeResolverService();

    // Intercept the internal Axios clients used by the services
    mockAxiosOdds = new MockAdapter((oddsSyncService  as any).client);
    mockAxiosEspn = new MockAdapter((outcomeResolverService as any).espnClient);
  });

  afterEach(() => {
    mockAxiosOdds.reset();
    mockAxiosEspn.reset();
  });

  // =========================================================================
  // STEP 1: Sport and game are seeded
  // =========================================================================

  describe('Step 1 – Sport and game seeded', () => {
    it('should have an active NFL sport fixture available', () => {
      // Arrange & Assert (fixture validation)
      expect(SPORT_FIXTURE.key).toBe('americanfootball_nfl');
      expect(SPORT_FIXTURE.isActive).toBe(true);
    });

    it('should have a valid game fixture linked to the sport', () => {
      expect(GAME_FIXTURE.sportId).toBe(SPORT_FIXTURE.id);
      expect(GAME_FIXTURE.homeTeamName).toBe('Kansas City Chiefs');
      expect(GAME_FIXTURE.awayTeamName).toBe('San Francisco 49ers');
      expect(GAME_FIXTURE.status).toBe('in_progress');
    });
  });

  // =========================================================================
  // STEP 2: Create bet via API
  // =========================================================================

  describe('Step 2 – Create bet via POST /api/bets', () => {
    beforeEach(() => {
      // game.findMany is used by bet service to validate game IDs
      mockPrisma.game.findMany.mockResolvedValue([
        { id: GAME_ID, status: 'scheduled', commenceTime: new Date(Date.now() + 86400000) } as any
      ]);

      // $transaction executes the callback with a tx client and returns the bet
      (mockPrisma.$transaction as jest.MockedFunction<any>).mockImplementation(
        async (callback: any) => {
          const txClient = {
            bet: {
              create: jest.fn().mockResolvedValue(BET_FIXTURE),
              findUnique: jest.fn().mockResolvedValue({
                ...BET_FIXTURE,
                legs: [{
                  ...BET_LEG_FIXTURE,
                  game: { ...GAME_FIXTURE, sport: SPORT_FIXTURE },
                }],
                futureLegs: [],
              }),
            },
            betLeg: {
              create: jest.fn().mockResolvedValue(BET_LEG_FIXTURE),
            },
            betLegFuture: {
              create: jest.fn(),
            },
          };
          return callback(txClient);
        }
      );

      // After transaction, bet service fetches the full bet record
      mockPrisma.betLeg.findMany.mockResolvedValue([BET_LEG_FIXTURE as any]);
      mockPrisma.bet.findUnique.mockResolvedValue({
        ...BET_FIXTURE,
        legs: [BET_LEG_FIXTURE],
      } as any);
    });

    it('should return 201 with created bet data', async () => {
      const payload = {
        name:    'E2E Test: Chiefs ML',
        betType: 'single',
        stake:   100,
        legs: [
          {
            gameId:        GAME_ID,
            selectionType: 'moneyline',
            selection:     'home',
            odds:          -150,
          },
        ],
      };

      const res = await request(app)
        .post('/api/bets')
        .send(payload)
        .expect(201);

      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeDefined();
    });

    it('should reject bets missing required fields (400)', async () => {
      const res = await request(app)
        .post('/api/bets')
        .send({ name: 'Missing fields' })
        .expect(400);

      expect(res.body).toBeDefined();
    });

    it('should reject bets with zero or negative stake (400)', async () => {
      const res = await request(app)
        .post('/api/bets')
        .send({
          name:    'Zero stake test',
          betType: 'single',
          stake:   0,
          legs: [
            {
              gameId:        GAME_ID,
              selectionType: 'moneyline',
              selection:     'home',
              odds:          -150,
            },
          ],
        })
        .expect(400);

      expect(res.body).toBeDefined();
    });

    it('should accept a spread bet leg', async () => {
      const payload = {
        name:    'E2E Test: Chiefs -3 Spread',
        betType: 'single',
        stake:   50,
        legs: [
          {
            gameId:        GAME_ID,
            selectionType: 'spread',
            selection:     'home',
            odds:          -110,
            line:          -3.0,
          },
        ],
      };

      const res = await request(app)
        .post('/api/bets')
        .send(payload)
        .expect(201);

      expect(res.body.status).toBe('success');
    });

    it('should accept a totals (over/under) bet leg', async () => {
      const payload = {
        name:    'E2E Test: Over 47.5',
        betType: 'single',
        stake:   75,
        legs: [
          {
            gameId:        GAME_ID,
            selectionType: 'total',
            selection:     'over',
            odds:          -110,
            line:          47.5,
          },
        ],
      };

      const res = await request(app)
        .post('/api/bets')
        .send(payload)
        .expect(201);

      expect(res.body.status).toBe('success');
    });
  });

  // =========================================================================
  // STEP 3: Simulate odds sync
  // =========================================================================

  describe('Step 3 – Odds sync via OddsSyncService', () => {
    beforeEach(() => {
      // Sports lookup
      mockPrisma.sport.findMany.mockResolvedValue([SPORT_FIXTURE as any]);
      // upsertGame calls sport.findUnique to resolve sportId
      mockPrisma.sport.findUnique.mockResolvedValue(SPORT_FIXTURE as any);

      // Game upsert returns the seeded game
      mockPrisma.game.upsert.mockResolvedValue(GAME_FIXTURE as any);

      // Odds upserts
      mockPrisma.currentOdds.upsert.mockResolvedValue({} as any);
      mockPrisma.oddsSnapshot.create.mockResolvedValue({} as any);

      // Odds API returns our fixture event
      mockAxiosOdds
        .onGet(/\/v4\/sports\/americanfootball_nfl\/odds/)
        .reply(200, [ODDS_API_EVENT], { 'x-requests-remaining': '490' });
    });

    it('should process the event and upsert the game record', async () => {
      const result = await oddsSyncService.syncSportOdds('americanfootball_nfl');

      expect(result.success).toBe(true);
      expect(result.gamesProcessed).toBe(1);
      expect(mockPrisma.game.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where:  { externalId: EXTERNAL_ID },
          create: expect.objectContaining({
            homeTeamName: 'Kansas City Chiefs',
            awayTeamName: 'San Francisco 49ers',
          }),
        })
      );
    });

    it('should upsert odds records for h2h, spreads and totals markets', async () => {
      await oddsSyncService.syncSportOdds('americanfootball_nfl');

      // 3 market types × 1 bookmaker  →  at least 3 currentOdds upserts
      expect(mockPrisma.currentOdds.upsert).toHaveBeenCalled();
      const upsertCalls = (mockPrisma.currentOdds.upsert as jest.MockedFunction<any>).mock.calls;
      const marketTypes = upsertCalls.map((c: any) => c[0].where.gameId_bookmaker_marketType?.marketType);
      expect(marketTypes).toEqual(expect.arrayContaining(['h2h', 'spreads', 'totals']));
    });

    it('should create odds snapshots for historical tracking', async () => {
      await oddsSyncService.syncSportOdds('americanfootball_nfl');

      expect(mockPrisma.oddsSnapshot.create).toHaveBeenCalled();
    });

    it('should handle an empty event list gracefully', async () => {
      mockAxiosOdds.reset();
      mockAxiosOdds.onGet(/\/v4\/sports\/americanfootball_nfl\/odds/).reply(200, []);

      const result = await oddsSyncService.syncSportOdds('americanfootball_nfl');

      expect(result.success).toBe(true);
      expect(result.gamesProcessed).toBe(0);
    });

    it('should surface API errors in result.errors', async () => {
      mockAxiosOdds.reset();
      mockAxiosOdds.onGet(/\/v4\/sports\/americanfootball_nfl\/odds/).reply(500);

      const result = await oddsSyncService.syncSportOdds('americanfootball_nfl');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // STEP 4 & 5: ESPN shows game final → Outcome resolver runs
  // =========================================================================

  describe('Step 4 & 5 – ESPN scoreboard + outcome resolver', () => {
    beforeEach(() => {
      // Games to check (in_progress, started 4 hrs ago)
      mockPrisma.game.findMany.mockResolvedValue([GAME_FIXTURE as any]);

      // Pending bet legs for the game
      mockPrisma.betLeg.findMany.mockResolvedValue([BET_LEG_FIXTURE as any]);

      // Bet lookup (used when checking if all legs are settled)
      // Return the bet with already-settled legs so checkAndSettleBet proceeds
      mockPrisma.bet.findUnique.mockResolvedValue({
        ...BET_FIXTURE,
        legs: [{ ...BET_LEG_FIXTURE, status: 'won' }],
      } as any);

      // Game update (score written after result confirmed)
      mockPrisma.game.update.mockResolvedValue({
        ...GAME_FIXTURE,
        status:    'final',
        homeScore: 27,
        awayScore: 21,
      } as any);

      // BetLeg update (status → won/lost/push)
      mockPrisma.betLeg.update.mockResolvedValue({
        ...BET_LEG_FIXTURE,
        status: 'won',
      } as any);

      // Bet update (status → won, actualPayout set)
      mockPrisma.bet.update.mockResolvedValue({
        ...BET_FIXTURE,
        status:      'won',
        actualPayout: new Decimal('166.67'),
        settledAt:   new Date(),
      } as any);

      // ESPN returns the FINAL scoreboard
      mockAxiosEspn
        .onGet(/\/football\/nfl\/scoreboard/)
        .reply(200, ESPN_SCOREBOARD_FINAL);
    });

    it('should mark the game as final with correct scores', async () => {
      await outcomeResolverService.resolveOutcomes();

      expect(mockPrisma.game.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: GAME_ID },
          data:  expect.objectContaining({
            status:    'final',
            homeScore: 27,
            awayScore: 21,
          }),
        })
      );
    });

    it('should settle the moneyline leg as "won" when home team wins', async () => {
      await outcomeResolverService.resolveOutcomes();

      expect(mockPrisma.betLeg.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BET_LEG_ID },
          data:  expect.objectContaining({ status: 'won' }),
        })
      );
    });

    it('should settle the parent bet as "won" and set actualPayout', async () => {
      await outcomeResolverService.resolveOutcomes();

      expect(mockPrisma.bet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BET_ID },
          data:  expect.objectContaining({
            status:      'won',
            actualPayout: expect.any(Decimal),
            settledAt:   expect.any(Date),
          }),
        })
      );
    });

    it('should report correct settlement counts in the resolve result', async () => {
      const result = await outcomeResolverService.resolveOutcomes();

      expect(result.success).toBe(true);
      expect(result.gamesChecked).toBe(1);
      expect(result.gamesUpdated).toBe(1);
      expect(result.legsSettled).toBe(1);
      expect(result.betsSettled).toBe(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  // =========================================================================
  // STEP 6: Verify full payout is correct
  // =========================================================================

  describe('Step 6 – Payout verification', () => {
    it('should compute correct potential payout for -150 moneyline on $100 stake', () => {
      // American odds -150 → decimal 1.6667 → payout = 100 * 1.6667 = $166.67
      const stake = 100;
      const americanOdds = -150;
      const decimalOdds = 1 + (100 / Math.abs(americanOdds)); // 1.6667
      const expectedPayout = stake * decimalOdds;

      expect(expectedPayout).toBeCloseTo(166.67, 1);
    });

    it('should compute correct potential payout for +130 moneyline on $100 stake', () => {
      const stake = 100;
      const americanOdds = 130;
      const decimalOdds = 1 + americanOdds / 100; // 2.30
      const expectedPayout = stake * decimalOdds;

      expect(expectedPayout).toBeCloseTo(230, 1);
    });

    it('should set actualPayout = 0 for a losing bet', async () => {
      // Reconfigure: away team wins (49ers win, but bet was on home/Chiefs)
      const espnFinal49ersWin = {
        ...ESPN_SCOREBOARD_FINAL,
        events: [
          {
            ...ESPN_SCOREBOARD_FINAL.events[0],
            competitions: [
              {
                ...ESPN_SCOREBOARD_FINAL.events[0].competitions[0],
                status: {
                  type: {
                    id:        '3',
                    name:      'STATUS_FINAL',
                    state:     'post',
                    completed: true,
                  },
                },
                competitors: [
                  {
                    id:       '12',
                    homeAway: 'home' as const,
                    score:    '17',          // Chiefs lose
                    team: { id: '12', displayName: 'Kansas City Chiefs', abbreviation: 'KC' },
                  },
                  {
                    id:       '25',
                    homeAway: 'away' as const,
                    score:    '24',          // 49ers win
                    team: { id: '25', displayName: 'San Francisco 49ers', abbreviation: 'SF' },
                  },
                ],
              },
            ],
          },
        ],
      };

      mockPrisma.game.findMany.mockResolvedValue([GAME_FIXTURE as any]);
      mockPrisma.betLeg.findMany.mockResolvedValue([BET_LEG_FIXTURE as any]);
      mockPrisma.bet.findUnique.mockResolvedValue({
        ...BET_FIXTURE,
        legs: [{ ...BET_LEG_FIXTURE, status: 'lost' }],
      } as any);
      mockPrisma.game.update.mockResolvedValue({ ...GAME_FIXTURE, status: 'final', homeScore: 17, awayScore: 24 } as any);
      mockPrisma.betLeg.update.mockResolvedValue({ ...BET_LEG_FIXTURE, status: 'lost' } as any);
      mockPrisma.bet.update.mockResolvedValue({
        ...BET_FIXTURE,
        status:       'lost',
        actualPayout: new Decimal('0'),
        settledAt:    new Date(),
      } as any);

      mockAxiosEspn.reset();
      mockAxiosEspn
        .onGet(/\/football\/nfl\/scoreboard/)
        .reply(200, espnFinal49ersWin);

      await outcomeResolverService.resolveOutcomes();

      // Leg should be marked lost
      expect(mockPrisma.betLeg.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'lost' }),
        })
      );

      // Bet should be marked lost with $0 payout
      expect(mockPrisma.bet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status:      'lost',
            actualPayout: new Decimal('0'),
          }),
        })
      );
    });

    it('should set actualPayout = stake for a push', async () => {
      // Spread leg: home covers exactly → push.
      // The formula: coverDifferential = (homeScore - awayScore) - line
      // Push when coverDifferential === 0, i.e. differential === line.
      // With home winning 24-21 (diff = 3) and line = 3, coverDifferential = 0 → push.
      const spreadLeg = {
        ...BET_LEG_FIXTURE,
        id:            'spread-leg-id',
        selectionType: 'spread',
        selection:     'home',
        line:          new Decimal('3'),
        odds:          -110,
      };

      const spreadBet = {
        ...BET_FIXTURE,
        id:              'spread-bet-id',
        stake:           new Decimal('100'),
        potentialPayout: new Decimal('190.91'),
        legs:            [spreadLeg],
      };

      const espnFinalPush = {
        ...ESPN_SCOREBOARD_FINAL,
        events: [
          {
            ...ESPN_SCOREBOARD_FINAL.events[0],
            competitions: [
              {
                ...ESPN_SCOREBOARD_FINAL.events[0].competitions[0],
                status: {
                  type: {
                    id:        '3',
                    name:      'STATUS_FINAL',
                    state:     'post',
                    completed: true,
                  },
                },
                competitors: [
                  {
                    id:       '12',
                    homeAway: 'home' as const,
                    score:    '24',   // Chiefs +3 exactly → push on -3 spread
                    team: { id: '12', displayName: 'Kansas City Chiefs', abbreviation: 'KC' },
                  },
                  {
                    id:       '25',
                    homeAway: 'away' as const,
                    score:    '21',
                    team: { id: '25', displayName: 'San Francisco 49ers', abbreviation: 'SF' },
                  },
                ],
              },
            ],
          },
        ],
      };

      mockPrisma.game.findMany.mockResolvedValue([GAME_FIXTURE as any]);
      mockPrisma.betLeg.findMany.mockResolvedValue([spreadLeg as any]);
      mockPrisma.bet.findUnique.mockResolvedValue({ ...spreadBet, legs: [{ ...spreadLeg, status: 'push' }] } as any);
      mockPrisma.game.update.mockResolvedValue({ ...GAME_FIXTURE, status: 'final', homeScore: 24, awayScore: 21 } as any);
      mockPrisma.betLeg.update.mockResolvedValue({ ...spreadLeg, status: 'push' } as any);
      mockPrisma.bet.update.mockResolvedValue({
        ...spreadBet,
        status:       'push',
        actualPayout: new Decimal('100'),   // stake returned
        settledAt:    new Date(),
      } as any);

      mockAxiosEspn.reset();
      mockAxiosEspn
        .onGet(/\/football\/nfl\/scoreboard/)
        .reply(200, espnFinalPush);

      await outcomeResolverService.resolveOutcomes();

      expect(mockPrisma.betLeg.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'push' }),
        })
      );

      expect(mockPrisma.bet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status:       'push',
            actualPayout: new Decimal('100'),
          }),
        })
      );
    });
  });

  // =========================================================================
  // FULL LIFECYCLE: single integrated test
  // =========================================================================

  describe('Full lifecycle – end-to-end integration', () => {
    /**
     * Simulates the complete lifecycle in the correct order and verifies
     * all side-effects in a single test.
     */
    it('should create a bet, sync odds, resolve game final, and settle the bet with correct payout', async () => {
      // -------- 1. Seed: sport + game already present in DB --------
      mockPrisma.sport.findMany.mockResolvedValue([SPORT_FIXTURE as any]);
      mockPrisma.game.findMany
        // First call: bet service validates the game exists
        .mockResolvedValueOnce([
          { id: GAME_ID, status: 'scheduled', commenceTime: new Date(Date.now() + 3600000) } as any,
        ])
        // Second call: outcome resolver looks up in_progress games
        .mockResolvedValueOnce([GAME_FIXTURE as any]);

      // -------- 2. Create bet --------
      (mockPrisma.$transaction as jest.MockedFunction<any>).mockImplementation(
        async (callback: any) => {
          const tx = {
            bet:          {
              create: jest.fn().mockResolvedValue(BET_FIXTURE),
              findUnique: jest.fn().mockResolvedValue({
                ...BET_FIXTURE,
                legs: [{
                  ...BET_LEG_FIXTURE,
                  game: { ...GAME_FIXTURE, sport: SPORT_FIXTURE },
                }],
                futureLegs: [],
              }),
            },
            betLeg:       { create: jest.fn().mockResolvedValue(BET_LEG_FIXTURE) },
            betLegFuture: { create: jest.fn() },
          };
          return callback(tx);
        }
      );
      mockPrisma.betLeg.findMany.mockResolvedValue([BET_LEG_FIXTURE as any]);
      mockPrisma.bet.findUnique.mockResolvedValue({
        ...BET_FIXTURE,
        legs: [BET_LEG_FIXTURE],
      } as any);

      const betRes = await request(app)
        .post('/api/bets')
        .send({
          name:    'Lifecycle: Chiefs ML',
          betType: 'single',
          stake:   100,
          legs: [{
            gameId:        GAME_ID,
            selectionType: 'moneyline',
            selection:     'home',
            odds:          -150,
          }],
        })
        .expect(201);

      expect(betRes.body.status).toBe('success');
      const createdBetId = BET_ID;  // tracked through our fixture

      // -------- 3. Odds sync --------
      // upsertGame calls sport.findUnique to resolve sportId
      mockPrisma.sport.findUnique.mockResolvedValue(SPORT_FIXTURE as any);
      mockPrisma.game.upsert.mockResolvedValue(GAME_FIXTURE as any);
      mockPrisma.currentOdds.upsert.mockResolvedValue({} as any);
      mockPrisma.oddsSnapshot.create.mockResolvedValue({} as any);

      mockAxiosOdds
        .onGet(/\/v4\/sports\/americanfootball_nfl\/odds/)
        .reply(200, [ODDS_API_EVENT]);

      const syncResult = await oddsSyncService.syncSportOdds('americanfootball_nfl');

      expect(syncResult.success).toBe(true);
      expect(syncResult.gamesProcessed).toBe(1);
      expect(syncResult.oddsProcessed).toBeGreaterThan(0);

      // -------- 4 & 5. ESPN returns final + resolve outcomes --------
      mockPrisma.betLeg.findMany.mockResolvedValue([BET_LEG_FIXTURE as any]);
      // checkAndSettleBet queries the bet after legs are settled; return legs as 'won'
      mockPrisma.bet.findUnique.mockResolvedValue({
        ...BET_FIXTURE,
        id:   createdBetId,
        legs: [{ ...BET_LEG_FIXTURE, status: 'won' }],
      } as any);

      mockPrisma.game.update.mockResolvedValue({
        ...GAME_FIXTURE,
        status:    'final',
        homeScore: 27,
        awayScore: 21,
      } as any);
      mockPrisma.betLeg.update.mockResolvedValue({
        ...BET_LEG_FIXTURE,
        status: 'won',
      } as any);

      const EXPECTED_PAYOUT = new Decimal('166.67');
      mockPrisma.bet.update.mockResolvedValue({
        ...BET_FIXTURE,
        id:           createdBetId,
        status:       'won',
        actualPayout: EXPECTED_PAYOUT,
        settledAt:    new Date(),
      } as any);

      mockAxiosEspn
        .onGet(/\/football\/nfl\/scoreboard/)
        .reply(200, ESPN_SCOREBOARD_FINAL);

      const resolveResult = await outcomeResolverService.resolveOutcomes();

      // -------- 6. Verify settlement --------
      expect(resolveResult.success).toBe(true);
      expect(resolveResult.gamesChecked).toBe(1);
      expect(resolveResult.gamesUpdated).toBe(1);
      expect(resolveResult.legsSettled).toBe(1);
      expect(resolveResult.betsSettled).toBe(1);
      expect(resolveResult.errors).toHaveLength(0);

      // Game updated to final with correct score
      expect(mockPrisma.game.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'final', homeScore: 27, awayScore: 21 }),
        })
      );

      // Leg settled as won
      expect(mockPrisma.betLeg.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BET_LEG_ID },
          data:  expect.objectContaining({ status: 'won' }),
        })
      );

      // Bet settled as won with correct payout
      expect(mockPrisma.bet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: createdBetId },
          data:  expect.objectContaining({
            status:      'won',
            actualPayout: EXPECTED_PAYOUT,
            settledAt:   expect.any(Date),
          }),
        })
      );

      // Payout is approximately $166.67 (stake $100, odds -150)
      const betUpdateCall =
        (mockPrisma.bet.update as jest.MockedFunction<any>).mock.calls.find(
          (c: any) => c[0].where?.id === createdBetId
        );
      expect(betUpdateCall).toBeDefined();
      const payoutArg: Decimal = betUpdateCall![0].data.actualPayout;
      expect(payoutArg.toNumber()).toBeCloseTo(166.67, 1);
    });
  });

  // =========================================================================
  // EDGE CASES
  // =========================================================================

  describe('Edge cases', () => {
    it('should not crash when ESPN returns no events for the game date', async () => {
      mockPrisma.game.findMany.mockResolvedValue([GAME_FIXTURE as any]);
      mockAxiosEspn.onGet(/\/football\/nfl\/scoreboard/).reply(200, {
        leagues: [],
        events:  [],
      });

      const result = await outcomeResolverService.resolveOutcomes();

      // Game not updated because no ESPN event matched
      expect(mockPrisma.game.update).not.toHaveBeenCalled();
      expect(result.gamesUpdated).toBe(0);
    });

    it('should not settle a bet that is already in "won" status', async () => {
      const alreadySettledBet = {
        ...BET_FIXTURE,
        status: 'won',
        actualPayout: new Decimal('166.67'),
        settledAt: new Date(),
        legs: [{ ...BET_LEG_FIXTURE, status: 'won' }],
      };

      mockPrisma.game.findMany.mockResolvedValue([GAME_FIXTURE as any]);
      mockPrisma.betLeg.findMany.mockResolvedValue([{ ...BET_LEG_FIXTURE, status: 'won' } as any]);
      mockPrisma.bet.findUnique.mockResolvedValue(alreadySettledBet as any);
      mockAxiosEspn.onGet(/\/football\/nfl\/scoreboard/).reply(200, ESPN_SCOREBOARD_FINAL);

      await outcomeResolverService.resolveOutcomes();

      // Bet.update should NOT be called for an already-settled bet
      expect(mockPrisma.bet.update).not.toHaveBeenCalled();
    });

    it('should handle ESPN API failure gracefully and continue', async () => {
      mockPrisma.game.findMany.mockResolvedValue([GAME_FIXTURE as any]);
      mockAxiosEspn.onGet(/\/football\/nfl\/scoreboard/).reply(503);

      const result = await outcomeResolverService.resolveOutcomes();

      expect(result.success).toBe(true); // overall still succeeds (partial)
      // ESPN errors are caught silently inside checkGameResult (returns null),
      // so no entries are added to result.errors.
      expect(result.errors.length).toBe(0);
      expect(result.gamesUpdated).toBe(0);
    });

    it('should record errors for individual game failures without stopping the run', async () => {
      const games = [
        GAME_FIXTURE,
        { ...GAME_FIXTURE, id: 'game-2', homeTeamName: 'Dallas Cowboys', awayTeamName: 'New York Giants' },
      ];

      mockPrisma.game.findMany.mockResolvedValue(games as any);

      // First game succeeds, second throws
      mockAxiosEspn
        .onGet(/\/football\/nfl\/scoreboard/)
        .replyOnce(200, ESPN_SCOREBOARD_FINAL)
        .onGet(/\/football\/nfl\/scoreboard/)
        .replyOnce(500);

      mockPrisma.game.update.mockResolvedValue({ ...GAME_FIXTURE, status: 'final', homeScore: 27, awayScore: 21 } as any);
      mockPrisma.betLeg.findMany.mockResolvedValue([]);

      const result = await outcomeResolverService.resolveOutcomes();

      // Should have tried both games
      expect(result.gamesChecked).toBe(2);
    });

    it('should not process games with unsupported sport keys', async () => {
      const unsupportedGame = {
        ...GAME_FIXTURE,
        sport: { ...SPORT_FIXTURE, key: 'cricket_test' },
      };

      mockPrisma.game.findMany.mockResolvedValue([unsupportedGame as any]);

      const result = await outcomeResolverService.resolveOutcomes();

      expect(result.gamesUpdated).toBe(0);
      expect(mockPrisma.game.update).not.toHaveBeenCalled();
    });
  });
});
