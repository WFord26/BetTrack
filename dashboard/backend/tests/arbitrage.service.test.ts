/**
 * Unit tests for the arbitrage detection maths and service.
 *
 * Covers: calculateOptimalStakes, buildStakePlan, detectTwoWayArbitrage
 * (including the line compatibility check the original spec omitted),
 * detectMiddle, estimateMiddleProbability, assessRisk, sameLegs, and
 * scanForArbitrage against a mocked Prisma client.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../src/config/database', () => ({
  prisma: {
    game: { findMany: jest.fn() },
    oddsSnapshot: { findMany: jest.fn() },
    bookmakerAnalytics: { findMany: jest.fn() },
    arbitrageOpportunity: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}));

jest.mock('../src/config/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import {
  ArbitrageService,
  OddsRow,
  assessRisk,
  buildStakePlan,
  calculateOptimalStakes,
  detectMiddle,
  detectTwoWayArbitrage,
  estimateMiddleProbability,
  linesAreCompatible,
  lineGap,
  normalCdf,
  sameLegs,
  toOddsRow,
} from '../src/services/arbitrage.service';
import { prisma } from '../src/config/database';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

const NOW = new Date('2026-08-15T18:00:00Z');

function row(overrides: Partial<OddsRow> & { bookmaker: string; marketType: string }): OddsRow {
  return {
    homePrice: null,
    awayPrice: null,
    homeSpread: null,
    homeSpreadPrice: null,
    awaySpread: null,
    awaySpreadPrice: null,
    totalLine: null,
    overPrice: null,
    underPrice: null,
    lastUpdated: NOW,
    ...overrides,
  } as OddsRow;
}

describe('arbitrage maths', () => {
  // ─── calculateOptimalStakes ───────────────────────────────────────────────
  describe('calculateOptimalStakes', () => {
    it('splits an even two-way market in half', () => {
      const stakes = calculateOptimalStakes([100, -100], 1000);
      expect(stakes[0]).toBeCloseTo(500, 1);
      expect(stakes[1]).toBeCloseTo(500, 1);
    });

    it('returns the same amount on every leg of a real arbitrage', () => {
      // +120 / -105 is a genuine arb: 0.4545 + 0.5122 = 0.9667
      const odds = [120, -105];
      const stakes = calculateOptimalStakes(odds, 1000);

      const returnA = stakes[0] * (1 + 120 / 100);
      const returnB = stakes[1] * (1 + 100 / 105);

      expect(returnA).toBeCloseTo(returnB, 0);
      expect(stakes[0] + stakes[1]).toBeCloseTo(1000, 0);
    });

    it('handles three legs', () => {
      const stakes = calculateOptimalStakes([250, 300, 400], 900);
      expect(stakes).toHaveLength(3);
      expect(stakes.reduce((a, b) => a + b, 0)).toBeCloseTo(900, 0);
    });

    it('rejects an empty leg list', () => {
      expect(() => calculateOptimalStakes([], 100)).toThrow(/at least one leg/i);
    });

    it('rejects a non positive stake', () => {
      expect(() => calculateOptimalStakes([-110, 120], 0)).toThrow(/positive/i);
    });
  });

  // ─── buildStakePlan ───────────────────────────────────────────────────────
  describe('buildStakePlan', () => {
    it('reports a positive guaranteed profit for a true arbitrage', () => {
      const plan = buildStakePlan([120, -105], 1000);

      expect(plan.isArbitrage).toBe(true);
      expect(plan.totalImpliedProbability).toBeLessThan(1);
      expect(plan.guaranteedProfit).toBeGreaterThan(0);
      // 1/0.9667 - 1 ≈ 3.45%
      expect(plan.profitPercentage).toBeGreaterThan(3);
      expect(plan.profitPercentage).toBeLessThan(4);
    });

    it('reports a loss for a normal vigged market', () => {
      const plan = buildStakePlan([-110, -110], 1000);

      expect(plan.isArbitrage).toBe(false);
      expect(plan.totalImpliedProbability).toBeGreaterThan(1);
      expect(plan.guaranteedProfit).toBeLessThan(0);
    });
  });

  // ─── normal distribution helpers ──────────────────────────────────────────
  describe('normalCdf and estimateMiddleProbability', () => {
    it('is 0.5 at the mean and symmetric', () => {
      expect(normalCdf(0)).toBeCloseTo(0.5, 4);
      expect(normalCdf(1) + normalCdf(-1)).toBeCloseTo(1, 3);
    });

    it('gives a wider gap a higher hit probability', () => {
      const narrow = estimateMiddleProbability(-3, 3, 13.5);
      const wide = estimateMiddleProbability(-7, 7, 13.5);
      expect(wide).toBeGreaterThan(narrow);
    });

    it('returns zero for an inverted or empty window', () => {
      expect(estimateMiddleProbability(5, 5, 13.5)).toBe(0);
      expect(estimateMiddleProbability(5, 1, 13.5)).toBe(0);
    });
  });

  // ─── line compatibility ───────────────────────────────────────────────────
  describe('linesAreCompatible', () => {
    it('accepts complementary spreads', () => {
      expect(linesAreCompatible('spreads', -3.5, 3.5)).toBe(true);
    });

    it('accepts a spread gap in the bettor favour', () => {
      expect(linesAreCompatible('spreads', -2.5, 3.5)).toBe(true);
      expect(lineGap('spreads', -2.5, 3.5)).toBeCloseTo(1, 5);
    });

    it('rejects a spread gap against the bettor', () => {
      expect(linesAreCompatible('spreads', -4.5, 3.5)).toBe(false);
    });

    it('requires the over line at or below the under line', () => {
      expect(linesAreCompatible('totals', 45.5, 47.5)).toBe(true);
      expect(linesAreCompatible('totals', 47.5, 45.5)).toBe(false);
    });

    it('always accepts moneyline, which has no line', () => {
      expect(linesAreCompatible('h2h', null, null)).toBe(true);
    });
  });

  // ─── detectTwoWayArbitrage ────────────────────────────────────────────────
  describe('detectTwoWayArbitrage', () => {
    it('finds a moneyline arbitrage across two books', () => {
      const rows = [
        row({ bookmaker: 'bookA', marketType: 'h2h', homePrice: 120, awayPrice: -160 }),
        row({ bookmaker: 'bookB', marketType: 'h2h', homePrice: -150, awayPrice: -105 }),
      ];

      const result = detectTwoWayArbitrage(rows, 'h2h', {
        homeTeamName: 'Lakers',
        awayTeamName: 'Celtics',
        totalStake: 1000,
      });

      expect(result).not.toBeNull();
      expect(result!.arbType).toBe('two-way');
      expect(result!.legs.map((l) => l.bookmaker)).toEqual(['bookA', 'bookB']);
      expect(result!.legs[0].odds).toBe(120);
      expect(result!.legs[1].odds).toBe(-105);
      expect(result!.profitPercentage).toBeGreaterThan(3);
      expect(result!.expectedProfit).toBeGreaterThan(0);
    });

    it('returns null for a normally vigged market', () => {
      const rows = [
        row({ bookmaker: 'bookA', marketType: 'h2h', homePrice: -110, awayPrice: -110 }),
        row({ bookmaker: 'bookB', marketType: 'h2h', homePrice: -112, awayPrice: -108 }),
      ];

      expect(detectTwoWayArbitrage(rows, 'h2h')).toBeNull();
    });

    it('will not pair two prices from the same bookmaker', () => {
      const rows = [
        row({ bookmaker: 'bookA', marketType: 'h2h', homePrice: 120, awayPrice: -105 }),
      ];

      expect(detectTwoWayArbitrage(rows, 'h2h')).toBeNull();
    });

    it('rejects a spread pair whose lines leave a gap against the bettor', () => {
      // Best prices look like an arb, but -6.5 / +3.5 loses on any margin of 4 to 6.
      const rows = [
        row({
          bookmaker: 'bookA',
          marketType: 'spreads',
          homeSpread: -6.5,
          homeSpreadPrice: 120,
        }),
        row({
          bookmaker: 'bookB',
          marketType: 'spreads',
          awaySpread: 3.5,
          awaySpreadPrice: -105,
        }),
      ];

      expect(detectTwoWayArbitrage(rows, 'spreads')).toBeNull();
    });

    it('accepts a spread pair on complementary lines', () => {
      const rows = [
        row({
          bookmaker: 'bookA',
          marketType: 'spreads',
          homeSpread: -3.5,
          homeSpreadPrice: 120,
        }),
        row({
          bookmaker: 'bookB',
          marketType: 'spreads',
          awaySpread: 3.5,
          awaySpreadPrice: -105,
        }),
      ];

      const result = detectTwoWayArbitrage(rows, 'spreads', { totalStake: 1000 });

      expect(result).not.toBeNull();
      expect(result!.legs[0].line).toBe(-3.5);
      expect(result!.legs[1].line).toBe(3.5);
    });

    it('rejects a totals pair where the over line sits above the under line', () => {
      const rows = [
        row({ bookmaker: 'bookA', marketType: 'totals', totalLine: 48.5, overPrice: 120 }),
        row({ bookmaker: 'bookB', marketType: 'totals', totalLine: 44.5, underPrice: -105 }),
      ];

      expect(detectTwoWayArbitrage(rows, 'totals')).toBeNull();
    });

    it('picks the best pairing when more than two books are available', () => {
      const rows = [
        row({ bookmaker: 'bookA', marketType: 'h2h', homePrice: 110, awayPrice: -160 }),
        row({ bookmaker: 'bookB', marketType: 'h2h', homePrice: 130, awayPrice: -150 }),
        row({ bookmaker: 'bookC', marketType: 'h2h', homePrice: -150, awayPrice: -102 }),
      ];

      const result = detectTwoWayArbitrage(rows, 'h2h');

      expect(result).not.toBeNull();
      expect(result!.legs[0].bookmaker).toBe('bookB');
      expect(result!.legs[1].bookmaker).toBe('bookC');
    });

    it('reports the age of the oldest leg in the pair', () => {
      const rows = [
        row({
          bookmaker: 'bookA',
          marketType: 'h2h',
          homePrice: 120,
          lastUpdated: new Date(Date.now() - 400 * 1000),
        }),
        row({
          bookmaker: 'bookB',
          marketType: 'h2h',
          awayPrice: -105,
          lastUpdated: new Date(Date.now() - 60 * 1000),
        }),
      ];

      const result = detectTwoWayArbitrage(rows, 'h2h');

      expect(result).not.toBeNull();
      expect(result!.oddsSnapshotAge).toBeGreaterThanOrEqual(395);
    });
  });

  // ─── detectMiddle ─────────────────────────────────────────────────────────
  describe('detectMiddle', () => {
    it('finds a spread middle and reports the winning window', () => {
      const rows = [
        row({
          bookmaker: 'bookA',
          marketType: 'spreads',
          homeSpread: -2.5,
          homeSpreadPrice: -110,
        }),
        row({
          bookmaker: 'bookB',
          marketType: 'spreads',
          awaySpread: 6.5,
          awaySpreadPrice: -110,
        }),
      ];

      const result = detectMiddle(rows, 'spreads', {
        sportKey: 'americanfootball_nfl',
        totalStake: 1000,
      });

      expect(result).not.toBeNull();
      expect(result!.arbType).toBe('middle');
      // Both legs win when the home margin lands strictly between 2.5 and 6.5.
      expect(result!.middleGapLow).toBeCloseTo(2.5, 5);
      expect(result!.middleGapHigh).toBeCloseTo(6.5, 5);
      expect(result!.middleProbability!).toBeGreaterThan(0.1);
      expect(result!.expectedProfit).toBeGreaterThan(0);
    });

    it('finds a totals middle', () => {
      const rows = [
        row({ bookmaker: 'bookA', marketType: 'totals', totalLine: 44.5, overPrice: -110 }),
        row({ bookmaker: 'bookB', marketType: 'totals', totalLine: 48.5, underPrice: -110 }),
      ];

      const result = detectMiddle(rows, 'totals', { sportKey: 'americanfootball_nfl' });

      expect(result).not.toBeNull();
      expect(result!.middleGapLow).toBeCloseTo(44.5, 5);
      expect(result!.middleGapHigh).toBeCloseTo(48.5, 5);
    });

    it('ignores a gap narrower than the minimum', () => {
      const rows = [
        row({
          bookmaker: 'bookA',
          marketType: 'spreads',
          homeSpread: -3,
          homeSpreadPrice: -110,
        }),
        row({
          bookmaker: 'bookB',
          marketType: 'spreads',
          awaySpread: 3.5,
          awaySpreadPrice: -110,
        }),
      ];

      expect(detectMiddle(rows, 'spreads', { sportKey: 'americanfootball_nfl' })).toBeNull();
    });

    it('ignores a gap the wrong way round', () => {
      const rows = [
        row({
          bookmaker: 'bookA',
          marketType: 'spreads',
          homeSpread: -6.5,
          homeSpreadPrice: -110,
        }),
        row({
          bookmaker: 'bookB',
          marketType: 'spreads',
          awaySpread: 2.5,
          awaySpreadPrice: -110,
        }),
      ];

      expect(detectMiddle(rows, 'spreads', { sportKey: 'americanfootball_nfl' })).toBeNull();
    });
  });

  // ─── assessRisk ───────────────────────────────────────────────────────────
  describe('assessRisk', () => {
    const base = {
      profitPercentage: 2,
      oddsSnapshotAge: 60,
      oddsDrift: 1,
      minutesToStart: 240,
      bookmakers: ['bookA', 'bookB'],
      limitProfiles: {},
    };

    it('rates a fresh, modest opportunity as low risk', () => {
      const result = assessRisk(base);
      expect(result.riskLevel).toBe('low');
      expect(result.limitRisk).toBe(false);
    });

    it('flags a stale snapshot', () => {
      const result = assessRisk({ ...base, oddsSnapshotAge: 600 });
      expect(result.riskLevel).toBe('medium');
      expect(result.factors.join(' ')).toMatch(/stale/i);
    });

    it('flags fast moving odds', () => {
      const result = assessRisk({ ...base, oddsDrift: 9 });
      expect(result.riskLevel).toBe('medium');
      expect(result.factors.join(' ')).toMatch(/fast moving/i);
    });

    it('flags suspiciously high profit as high risk and does not downgrade it', () => {
      const result = assessRisk({ ...base, profitPercentage: 25, minutesToStart: 5 });
      expect(result.riskLevel).toBe('high');
      expect(result.factors.join(' ')).toMatch(/suspicious/i);
    });

    it('flags proximity to start time', () => {
      const result = assessRisk({ ...base, minutesToStart: 5 });
      expect(result.riskLevel).toBe('medium');
      expect(result.factors.join(' ')).toMatch(/start time/i);
    });

    it('treats both legs at the same book as a limit risk', () => {
      const result = assessRisk({ ...base, bookmakers: ['bookA', 'bookA'] });
      expect(result.limitRisk).toBe(true);
    });

    it('treats a restrictive limit profile as a limit risk', () => {
      const result = assessRisk({ ...base, limitProfiles: { bookA: 'low' } });
      expect(result.limitRisk).toBe(true);
    });

    it('treats a large edge as a limit risk', () => {
      const result = assessRisk({ ...base, profitPercentage: 6 });
      expect(result.limitRisk).toBe(true);
    });
  });

  // ─── sameLegs / toOddsRow ─────────────────────────────────────────────────
  describe('sameLegs', () => {
    const legs = [
      { side: 'home', bookmaker: 'bookA', odds: 120, line: null },
      { side: 'away', bookmaker: 'bookB', odds: -105, line: null },
    ];

    it('matches identical leg sets regardless of order', () => {
      expect(sameLegs(legs, [legs[1], legs[0]])).toBe(true);
    });

    it('does not match when a price changed', () => {
      expect(sameLegs(legs, [legs[0], { ...legs[1], odds: -110 }])).toBe(false);
    });

    it('does not match non arrays', () => {
      expect(sameLegs(null, legs)).toBe(false);
    });
  });

  describe('toOddsRow', () => {
    it('converts Prisma Decimal-like values to numbers', () => {
      const converted = toOddsRow({
        bookmaker: 'bookA',
        marketType: 'spreads',
        homePrice: null,
        awayPrice: null,
        homeSpread: { toString: () => '-3.5' },
        homeSpreadPrice: -110,
        awaySpread: { toString: () => '3.5' },
        awaySpreadPrice: -110,
        totalLine: null,
        overPrice: null,
        underPrice: null,
        lastUpdated: NOW.toISOString(),
      });

      expect(converted.homeSpread).toBe(-3.5);
      expect(converted.awaySpread).toBe(3.5);
      expect(converted.lastUpdated).toBeInstanceOf(Date);
    });
  });
});

// ─── Service level ──────────────────────────────────────────────────────────

describe('ArbitrageService', () => {
  let service: ArbitrageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ArbitrageService();

    (mockPrisma.arbitrageOpportunity.updateMany as jest.Mock).mockResolvedValue({ count: 0 } as any);
    (mockPrisma.bookmakerAnalytics.findMany as jest.Mock).mockResolvedValue([] as any);
    (mockPrisma.oddsSnapshot.findMany as jest.Mock).mockResolvedValue([] as any);
    (mockPrisma.arbitrageOpportunity.findFirst as jest.Mock).mockResolvedValue(null as any);
    (mockPrisma.arbitrageOpportunity.create as jest.Mock).mockImplementation(
      async (args: any) => ({ id: 'arb-1', ...args.data })
    );
    (mockPrisma.arbitrageOpportunity.update as jest.Mock).mockImplementation(
      async (args: any) => ({ id: args.where.id, ...args.data })
    );
  });

  const gameWithArb = {
    id: 'game-1',
    homeTeamName: 'Lakers',
    awayTeamName: 'Celtics',
    commenceTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
    sport: { key: 'basketball_nba' },
    currentOdds: [
      {
        bookmaker: 'bookA',
        marketType: 'h2h',
        homePrice: 120,
        awayPrice: -160,
        homeSpread: null,
        homeSpreadPrice: null,
        awaySpread: null,
        awaySpreadPrice: null,
        totalLine: null,
        overPrice: null,
        underPrice: null,
        lastUpdated: new Date(),
      },
      {
        bookmaker: 'bookB',
        marketType: 'h2h',
        homePrice: -150,
        awayPrice: -105,
        homeSpread: null,
        homeSpreadPrice: null,
        awaySpread: null,
        awaySpreadPrice: null,
        totalLine: null,
        overPrice: null,
        underPrice: null,
        lastUpdated: new Date(),
      },
    ],
  };

  it('creates an opportunity when a game has an arbitrage', async () => {
    (mockPrisma.game.findMany as jest.Mock).mockResolvedValue([gameWithArb] as any);

    const result = await service.scanForArbitrage();

    expect(result.gamesScanned).toBe(1);
    expect(result.opportunitiesFound).toBe(1);
    expect(result.opportunitiesCreated).toBe(1);
    expect(mockPrisma.arbitrageOpportunity.create).toHaveBeenCalledTimes(1);

    const created = (mockPrisma.arbitrageOpportunity.create as jest.Mock).mock.calls[0][0] as any;
    expect(created.data.arbType).toBe('two-way');
    expect(created.data.marketType).toBe('h2h');
    expect(created.data.legs).toHaveLength(2);
    expect(created.data.riskLevel).toBeDefined();
  });

  it('skips games with only one bookmaker', async () => {
    (mockPrisma.game.findMany as jest.Mock).mockResolvedValue([
      { ...gameWithArb, currentOdds: [gameWithArb.currentOdds[0]] },
    ] as any);

    const result = await service.scanForArbitrage();

    expect(result.gamesScanned).toBe(0);
    expect(result.opportunitiesFound).toBe(0);
    expect(mockPrisma.arbitrageOpportunity.create).not.toHaveBeenCalled();
  });

  it('refreshes rather than duplicates an unchanged opportunity', async () => {
    (mockPrisma.game.findMany as jest.Mock).mockResolvedValue([gameWithArb] as any);
    (mockPrisma.arbitrageOpportunity.findFirst as jest.Mock).mockResolvedValue({
      id: 'existing-1',
      legs: [
        { side: 'home', bookmaker: 'bookA', odds: 120, line: null },
        { side: 'away', bookmaker: 'bookB', odds: -105, line: null },
      ],
    } as any);

    const result = await service.scanForArbitrage();

    expect(result.opportunitiesCreated).toBe(0);
    expect(result.opportunitiesRefreshed).toBe(1);
    expect(mockPrisma.arbitrageOpportunity.create).not.toHaveBeenCalled();
    expect(mockPrisma.arbitrageOpportunity.update).toHaveBeenCalled();
  });

  it('expires an active row whose prices no longer match', async () => {
    (mockPrisma.game.findMany as jest.Mock).mockResolvedValue([gameWithArb] as any);
    (mockPrisma.arbitrageOpportunity.findFirst as jest.Mock).mockResolvedValue({
      id: 'existing-1',
      legs: [
        { side: 'home', bookmaker: 'bookA', odds: 145, line: null },
        { side: 'away', bookmaker: 'bookB', odds: -105, line: null },
      ],
    } as any);

    const result = await service.scanForArbitrage();

    expect(result.opportunitiesCreated).toBe(1);
    const updateCall = (mockPrisma.arbitrageOpportunity.update as jest.Mock).mock.calls[0][0] as any;
    expect(updateCall.data.status).toBe('expired');
  });

  it('expires opportunities past their TTL', async () => {
    (mockPrisma.arbitrageOpportunity.updateMany as jest.Mock).mockResolvedValue({ count: 3 } as any);

    const expired = await service.expireStaleOpportunities();

    expect(expired).toBe(3);
    const args = (mockPrisma.arbitrageOpportunity.updateMany as jest.Mock).mock.calls[0][0] as any;
    expect(args.where.status).toBe('active');
    expect(args.data.status).toBe('expired');
  });

  it('marks an opportunity as taken', async () => {
    (mockPrisma.arbitrageOpportunity.findUnique as jest.Mock).mockResolvedValue({
      id: 'arb-1',
    } as any);

    await service.markTaken('arb-1', 'user-1', 42.5);

    const args = (mockPrisma.arbitrageOpportunity.update as jest.Mock).mock.calls[0][0] as any;
    expect(args.data.status).toBe('taken');
    expect(args.data.userId).toBe('user-1');
    expect(args.data.actualProfit).toBe(42.5);
    expect(args.data.takenAt).toBeInstanceOf(Date);
  });

  it('returns null when marking an unknown opportunity as taken', async () => {
    (mockPrisma.arbitrageOpportunity.findUnique as jest.Mock).mockResolvedValue(null as any);

    await expect(service.markTaken('missing')).resolves.toBeNull();
    expect(mockPrisma.arbitrageOpportunity.update).not.toHaveBeenCalled();
  });
});
