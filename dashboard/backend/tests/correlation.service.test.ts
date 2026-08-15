/**
 * Unit tests for bet-leg correlation detection, true-odds calculation, and
 * parlay analysis. Covers all four correlation types, the SGP-aware
 * flagging logic, and the hedging finder against a mocked Prisma client.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../src/config/database', () => ({
  prisma: {
    betLeg: { findMany: jest.fn(), findUnique: jest.fn() },
    bet: { findUnique: jest.fn() },
    game: { findMany: jest.fn() },
    currentOdds: { findMany: jest.fn() },
    parlayAnalysis: { create: jest.fn(), findMany: jest.fn() },
  },
}));

jest.mock('../src/config/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import {
  CorrelationLeg,
  correlationService,
  correlationPenalty,
  detectDerivativeCorrelation,
  detectInverseCorrelation,
  detectSameGameCorrelation,
  detectTemporalCorrelation,
  recommendationForRisk,
  riskLevelForFlags,
} from '../src/services/correlation.service';
import { prisma } from '../src/config/database';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

const GAME_A = 'game-a';
const GAME_B = 'game-b';

function leg(overrides: Partial<CorrelationLeg> & { id: string; gameId: string }): CorrelationLeg {
  return {
    selectionType: 'moneyline',
    selection: 'home',
    teamName: null,
    line: null,
    odds: -110,
    sgpGroupId: null,
    game: { commenceTime: new Date('2026-08-16T18:00:00Z') },
    ...overrides,
  } as CorrelationLeg;
}

describe('correlation detectors', () => {
  describe('detectSameGameCorrelation', () => {
    it('flags a spread + total pair on the same game', () => {
      const a = leg({ id: '1', gameId: GAME_A, selectionType: 'spread', selection: 'home', line: -7 });
      const b = leg({ id: '2', gameId: GAME_A, selectionType: 'total', selection: 'over', line: 48.5 });

      const result = detectSameGameCorrelation(a, b);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('same-game');
      expect(result?.score).toBeCloseTo(0.85);
    });

    it('does not flag legs from different games', () => {
      const a = leg({ id: '1', gameId: GAME_A, selectionType: 'spread' });
      const b = leg({ id: '2', gameId: GAME_B, selectionType: 'total' });
      expect(detectSameGameCorrelation(a, b)).toBeNull();
    });

    it('does not flag a moneyline + spread pair (not spread+total)', () => {
      const a = leg({ id: '1', gameId: GAME_A, selectionType: 'moneyline' });
      const b = leg({ id: '2', gameId: GAME_A, selectionType: 'spread' });
      expect(detectSameGameCorrelation(a, b)).toBeNull();
    });
  });

  describe('detectDerivativeCorrelation', () => {
    it('flags moneyline + small spread on the same side of the same game', () => {
      const a = leg({ id: '1', gameId: GAME_A, selectionType: 'moneyline', selection: 'home' });
      const b = leg({ id: '2', gameId: GAME_A, selectionType: 'spread', selection: 'home', line: -2.5 });

      const result = detectDerivativeCorrelation(a, b);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('derivative');
      expect(result?.score).toBeCloseTo(0.9);
    });

    it('does not flag when the spread is large (not really derivative)', () => {
      const a = leg({ id: '1', gameId: GAME_A, selectionType: 'moneyline', selection: 'home' });
      const b = leg({ id: '2', gameId: GAME_A, selectionType: 'spread', selection: 'home', line: -9.5 });
      expect(detectDerivativeCorrelation(a, b)).toBeNull();
    });

    it('does not flag when the moneyline and spread are on opposite sides', () => {
      const a = leg({ id: '1', gameId: GAME_A, selectionType: 'moneyline', selection: 'home' });
      const b = leg({ id: '2', gameId: GAME_A, selectionType: 'spread', selection: 'away', line: 2.5 });
      expect(detectDerivativeCorrelation(a, b)).toBeNull();
    });
  });

  describe('detectInverseCorrelation', () => {
    it('flags opposite moneyline sides of the same game as mutually exclusive', () => {
      const a = leg({ id: '1', gameId: GAME_A, selectionType: 'moneyline', selection: 'home' });
      const b = leg({ id: '2', gameId: GAME_A, selectionType: 'moneyline', selection: 'away' });

      const result = detectInverseCorrelation(a, b);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('inverse');
      expect(result?.score).toBe(-1.0);
    });

    it('does not flag the same side on both legs', () => {
      const a = leg({ id: '1', gameId: GAME_A, selectionType: 'moneyline', selection: 'home' });
      const b = leg({ id: '2', gameId: GAME_A, selectionType: 'moneyline', selection: 'home' });
      expect(detectInverseCorrelation(a, b)).toBeNull();
    });
  });

  describe('detectTemporalCorrelation', () => {
    it('flags the same team in two games within 48 hours', () => {
      const a = leg({
        id: '1',
        gameId: GAME_A,
        teamName: 'Lakers',
        game: { commenceTime: new Date('2026-08-16T18:00:00Z') },
      });
      const b = leg({
        id: '2',
        gameId: GAME_B,
        teamName: 'Lakers',
        game: { commenceTime: new Date('2026-08-17T18:00:00Z') },
      });

      const result = detectTemporalCorrelation(a, b);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('temporal');
    });

    it('does not flag games more than 48 hours apart', () => {
      const a = leg({
        id: '1',
        gameId: GAME_A,
        teamName: 'Lakers',
        game: { commenceTime: new Date('2026-08-16T18:00:00Z') },
      });
      const b = leg({
        id: '2',
        gameId: GAME_B,
        teamName: 'Lakers',
        game: { commenceTime: new Date('2026-08-20T18:00:00Z') },
      });
      expect(detectTemporalCorrelation(a, b)).toBeNull();
    });

    it('does not flag different teams', () => {
      const a = leg({ id: '1', gameId: GAME_A, teamName: 'Lakers' });
      const b = leg({ id: '2', gameId: GAME_B, teamName: 'Celtics' });
      expect(detectTemporalCorrelation(a, b)).toBeNull();
    });
  });
});

describe('correlationPenalty', () => {
  it('lowers decimal odds for positive correlation, up to 30%', () => {
    expect(correlationPenalty(1.0)).toBeCloseTo(0.7);
    expect(correlationPenalty(0.5)).toBeCloseTo(0.85);
  });

  it('raises decimal odds for negative correlation, up to 20%', () => {
    expect(correlationPenalty(-1.0)).toBeCloseTo(1.2);
    expect(correlationPenalty(-0.5)).toBeCloseTo(1.1);
  });

  it('is a no-op at zero', () => {
    expect(correlationPenalty(0)).toBe(1.0);
  });
});

describe('riskLevelForFlags / recommendationForRisk', () => {
  it('is high risk with an inverse flag, regardless of score magnitude', () => {
    const flags = [{ betLeg1Id: '1', betLeg2Id: '2', type: 'inverse' as const, score: -1.0 }];
    expect(riskLevelForFlags(flags)).toBe('high');
    expect(recommendationForRisk('high', true)).toBe('reject');
  });

  it('is medium risk just above the flag threshold', () => {
    const flags = [{ betLeg1Id: '1', betLeg2Id: '2', type: 'temporal' as const, score: 0.4 }];
    expect(riskLevelForFlags(flags)).toBe('medium');
    expect(recommendationForRisk('medium', false)).toBe('warning');
  });

  it('is high risk above 0.6', () => {
    const flags = [{ betLeg1Id: '1', betLeg2Id: '2', type: 'derivative' as const, score: 0.9 }];
    expect(riskLevelForFlags(flags)).toBe('high');
  });

  it('is low risk with no flags', () => {
    expect(riskLevelForFlags([])).toBe('low');
    expect(recommendationForRisk('low', false)).toBe('approve');
  });
});

describe('correlationService.analyzeCorrelation', () => {
  it('returns null for independent legs', () => {
    const a = leg({ id: '1', gameId: GAME_A, selectionType: 'moneyline', selection: 'home' });
    const b = leg({ id: '2', gameId: GAME_B, selectionType: 'total', selection: 'over' });
    expect(correlationService.analyzeCorrelation(a, b)).toBeNull();
  });

  it('prioritizes inverse over other detectors when applicable', () => {
    const a = leg({ id: '1', gameId: GAME_A, selectionType: 'moneyline', selection: 'home' });
    const b = leg({ id: '2', gameId: GAME_A, selectionType: 'moneyline', selection: 'away' });
    const result = correlationService.analyzeCorrelation(a, b);
    expect(result?.type).toBe('inverse');
  });
});

describe('correlationService.analyzeLegPair', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const legRows = [
    { id: 'leg-1', gameId: GAME_A, selectionType: 'moneyline', selection: 'home', teamName: null, line: null, odds: -110, sgpGroupId: null, game: { commenceTime: new Date() } },
    { id: 'leg-2', gameId: GAME_A, selectionType: 'moneyline', selection: 'away', teamName: null, line: null, odds: -110, sgpGroupId: null, game: { commenceTime: new Date() } },
  ];

  it('skips the ownership check and returns the correlation when no userId is provided (no-auth mode)', async () => {
    (mockPrisma.betLeg.findMany as jest.Mock).mockResolvedValueOnce(legRows);

    const result = await correlationService.analyzeLegPair('leg-1', 'leg-2');

    expect(result?.type).toBe('inverse');
    expect(mockPrisma.betLeg.findMany).toHaveBeenCalledTimes(1);
  });

  it('allows the analysis when both legs belong to the caller', async () => {
    (mockPrisma.betLeg.findMany as jest.Mock)
      .mockResolvedValueOnce([
        { id: 'leg-1', bet: { userId: 'user-1' } },
        { id: 'leg-2', bet: { userId: 'user-1' } },
      ])
      .mockResolvedValueOnce(legRows);

    const result = await correlationService.analyzeLegPair('leg-1', 'leg-2', 'user-1');

    expect(result?.type).toBe('inverse');
    expect(mockPrisma.betLeg.findMany).toHaveBeenCalledTimes(2);
  });

  it('rejects with a not-found error when one leg belongs to a different user', async () => {
    (mockPrisma.betLeg.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'leg-1', bet: { userId: 'user-1' } },
      { id: 'leg-2', bet: { userId: 'someone-else' } },
    ]);

    await expect(correlationService.analyzeLegPair('leg-1', 'leg-2', 'user-1')).rejects.toThrow(
      'not found'
    );
    // The ownership check should short-circuit before the second, data-bearing fetch.
    expect(mockPrisma.betLeg.findMany).toHaveBeenCalledTimes(1);
  });

  it('rejects with a not-found error when a leg does not exist at all', async () => {
    (mockPrisma.betLeg.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'leg-1', bet: { userId: 'user-1' } },
    ]);

    await expect(correlationService.analyzeLegPair('leg-1', 'missing', 'user-1')).rejects.toThrow(
      'not found'
    );
  });
});

describe('correlationService.calculateTrueOdds', () => {
  it('matches the plain parlay product when legs are independent', () => {
    const legs = [
      leg({ id: '1', gameId: GAME_A, odds: -110 }),
      leg({ id: '2', gameId: GAME_B, odds: -110 }),
    ];
    // -110/-110 parlay ≈ +264
    expect(correlationService.calculateTrueOdds(legs)).toBeCloseTo(264, -1);
  });

  it('produces worse (lower) true odds for a positively correlated pair', () => {
    const independentLegs = [
      leg({ id: '1', gameId: GAME_A, selectionType: 'moneyline', selection: 'home', odds: -110 }),
      leg({ id: '2', gameId: GAME_B, selectionType: 'moneyline', selection: 'home', odds: -110 }),
    ];
    const correlatedLegs = [
      leg({ id: '1', gameId: GAME_A, selectionType: 'spread', selection: 'home', line: -7, odds: -110 }),
      leg({ id: '2', gameId: GAME_A, selectionType: 'total', selection: 'over', line: 48.5, odds: -110 }),
    ];

    const independentTrueOdds = correlationService.calculateTrueOdds(independentLegs);
    const correlatedTrueOdds = correlationService.calculateTrueOdds(correlatedLegs);

    expect(correlatedTrueOdds).toBeLessThan(independentTrueOdds);
  });
});

describe('correlationService.analyzeDraftSlip', () => {
  it('rejects a parlay with mutually exclusive legs', async () => {
    const legs = [
      { gameId: GAME_A, selectionType: 'moneyline' as const, selection: 'home' as const, odds: -110 },
      { gameId: GAME_A, selectionType: 'moneyline' as const, selection: 'away' as const, odds: -110 },
    ];
    const result = await correlationService.analyzeDraftSlip(legs, new Map());

    expect(result.recommendation).toBe('reject');
    expect(result.riskLevel).toBe('high');
    expect(result.correlationFlags).toHaveLength(1);
    expect(result.correlationFlags[0].type).toBe('inverse');
  });

  it('approves independent legs across different games', async () => {
    const legs = [
      { gameId: GAME_A, selectionType: 'moneyline' as const, selection: 'home' as const, odds: -110 },
      { gameId: GAME_B, selectionType: 'moneyline' as const, selection: 'away' as const, odds: -110 },
    ];
    const result = await correlationService.analyzeDraftSlip(legs, new Map());

    expect(result.recommendation).toBe('approve');
    expect(result.riskLevel).toBe('low');
    expect(result.correlationFlags).toHaveLength(0);
  });

  it('treats legs sharing an sgpGroupId as expected rather than flagged', async () => {
    const legs = [
      { gameId: GAME_A, selectionType: 'spread' as const, selection: 'home' as const, odds: -110, line: -7, sgpGroupId: 'sgp-1' },
      { gameId: GAME_A, selectionType: 'total' as const, selection: 'over' as const, odds: -110, line: 48.5, sgpGroupId: 'sgp-1' },
    ];
    const result = await correlationService.analyzeDraftSlip(legs, new Map());

    // Known SGP pairing is surfaced as priced correlation, not a mistake flag.
    expect(result.correlationFlags).toHaveLength(0);
    expect(result.recommendation).toBe('approve');
  });

  it('throws for fewer than 2 legs', async () => {
    await expect(
      correlationService.analyzeDraftSlip(
        [{ gameId: GAME_A, selectionType: 'moneyline', selection: 'home', odds: -110 }],
        new Map()
      )
    ).rejects.toThrow('at least 2 legs');
  });
});

describe('correlationService.analyzeParlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads a placed bet, analyzes its legs, and persists history for an authenticated user', async () => {
    const betLegs = [
      { id: 'leg-1', gameId: GAME_A, selectionType: 'moneyline', selection: 'home', teamName: null, line: null, odds: -110, sgpGroupId: null, game: { commenceTime: new Date() } },
      { id: 'leg-2', gameId: GAME_A, selectionType: 'moneyline', selection: 'away', teamName: null, line: null, odds: -110, sgpGroupId: null, game: { commenceTime: new Date() } },
    ];

    (mockPrisma.bet.findUnique as jest.Mock).mockResolvedValue({
      id: 'bet-1',
      userId: 'user-1',
      legs: betLegs,
    } as any);
    (mockPrisma.parlayAnalysis.create as jest.Mock).mockResolvedValue({} as any);

    const result = await correlationService.analyzeParlay('bet-1');

    expect(result.recommendation).toBe('reject');
    expect(mockPrisma.parlayAnalysis.create).toHaveBeenCalledTimes(1);
  });

  it('throws when the bet does not exist', async () => {
    (mockPrisma.bet.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(correlationService.analyzeParlay('missing')).rejects.toThrow('not found');
  });

  it('throws when the bet has fewer than 2 legs', async () => {
    (mockPrisma.bet.findUnique as jest.Mock).mockResolvedValue({ id: 'bet-1', userId: 'user-1', legs: [{ id: 'leg-1' }] } as any);
    await expect(correlationService.analyzeParlay('bet-1')).rejects.toThrow('at least 2 legs');
  });
});

describe('correlationService.findHedgingOpportunities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns opposite-side pre-game odds sorted by guaranteed profit', async () => {
    (mockPrisma.betLeg.findUnique as jest.Mock).mockResolvedValue({
      id: 'leg-1',
      gameId: GAME_A,
      selectionType: 'moneyline',
      selection: 'home',
      odds: -150,
    } as any);
    (mockPrisma.currentOdds.findMany as jest.Mock).mockResolvedValue([
      { bookmaker: 'bookA', marketType: 'h2h', homePrice: 130, awayPrice: 140 },
      { bookmaker: 'bookB', marketType: 'h2h', homePrice: 125, awayPrice: 160 },
    ] as any);

    const options = await correlationService.findHedgingOpportunities('leg-1');

    expect(options).toHaveLength(2);
    expect(options[0].selection).toBe('away');
    // Higher payout hedge odds (+160) should produce a smaller required stake / better profit than +140.
    expect(options[0].bookmaker).toBe('bookB');
  });

  it('returns an empty array for non-moneyline legs', async () => {
    (mockPrisma.betLeg.findUnique as jest.Mock).mockResolvedValue({
      id: 'leg-1',
      gameId: GAME_A,
      selectionType: 'spread',
      selection: 'home',
      odds: -110,
    } as any);

    const options = await correlationService.findHedgingOpportunities('leg-1');
    expect(options).toEqual([]);
  });

  it('throws when the leg does not exist', async () => {
    (mockPrisma.betLeg.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(correlationService.findHedgingOpportunities('missing')).rejects.toThrow('not found');
  });

  it('returns opportunities when the leg belongs to the caller', async () => {
    (mockPrisma.betLeg.findUnique as jest.Mock).mockResolvedValue({
      id: 'leg-1',
      gameId: GAME_A,
      selectionType: 'moneyline',
      selection: 'home',
      odds: -150,
      bet: { userId: 'user-1' },
    } as any);
    (mockPrisma.currentOdds.findMany as jest.Mock).mockResolvedValue([]);

    const options = await correlationService.findHedgingOpportunities('leg-1', 'user-1');
    expect(options).toEqual([]);
  });

  it('rejects with a not-found error when the leg belongs to a different user', async () => {
    (mockPrisma.betLeg.findUnique as jest.Mock).mockResolvedValue({
      id: 'leg-1',
      gameId: GAME_A,
      selectionType: 'moneyline',
      selection: 'home',
      odds: -150,
      bet: { userId: 'someone-else' },
    } as any);

    await expect(correlationService.findHedgingOpportunities('leg-1', 'user-1')).rejects.toThrow(
      'not found'
    );
  });
});
