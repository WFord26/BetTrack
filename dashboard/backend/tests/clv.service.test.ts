/**
 * Unit tests for CLV (Closing Line Value) Service
 *
 * Tests CLV calculation accuracy, closing line capture, and report generation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CLVService } from '../src/services/clv.service';
import { Decimal } from '@prisma/client/runtime/library';
import type { OddsSnapshot as OddsSnapshotRow } from '@prisma/client';

// Mock Prisma
jest.mock('../src/config/database', () => ({
  prisma: {
    betLeg: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    bet: {
      findFirst: jest.fn()
    },
    game: {
      findUnique: jest.fn(),
      findMany: jest.fn()
    },
    userCLVStats: {
      upsert: jest.fn()
    }
  }
}));

jest.mock('../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

import { prisma } from '../src/config/database';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('CLV Service', () => {
  let service: CLVService;

  beforeEach(() => {
    service = new CLVService();
    jest.clearAllMocks();
  });

  // ========================================================================
  // CLV CALCULATION
  // ========================================================================

  describe('calculateCLV', () => {
    it('should calculate positive CLV when closing odds move in bettor favor', async () => {
      // Bet placed at -110, closing line moved to -130 (line got worse for new bettors)
      // This means the bettor beat the closing line = positive CLV
      mockPrisma.betLeg.findUnique.mockResolvedValue({
        id: 'leg-1',
        odds: -110,        // opening odds at placement
        closingOdds: -130  // closing odds at game start
      } as any);

      mockPrisma.betLeg.update.mockResolvedValue({} as any);

      const clv = await service.calculateCLV('leg-1');

      expect(clv).not.toBeNull();
      // -110 implied: 110/210 = 0.5238
      // -130 implied: 130/230 = 0.5652
      // CLV = ((0.5652 - 0.5238) / 0.5238) * 100 ≈ 7.91%
      expect(clv!).toBeCloseTo(7.91, 0);
      expect(mockPrisma.betLeg.update).toHaveBeenCalledWith({
        where: { id: 'leg-1' },
        data: {
          clv: expect.any(Decimal),
          clvCategory: 'positive'
        }
      });
    });

    it('should calculate negative CLV when closing odds move against bettor', async () => {
      // Bet placed at -130, closing line moved to -110 (odds got better after placement)
      mockPrisma.betLeg.findUnique.mockResolvedValue({
        id: 'leg-2',
        odds: -130,
        closingOdds: -110
      } as any);

      mockPrisma.betLeg.update.mockResolvedValue({} as any);

      const clv = await service.calculateCLV('leg-2');

      expect(clv).not.toBeNull();
      // -130 implied: 130/230 = 0.5652
      // -110 implied: 110/210 = 0.5238
      // CLV = ((0.5238 - 0.5652) / 0.5652) * 100 ≈ -7.32%
      expect(clv!).toBeCloseTo(-7.32, 0);
      expect(mockPrisma.betLeg.update).toHaveBeenCalledWith({
        where: { id: 'leg-2' },
        data: {
          clv: expect.any(Decimal),
          clvCategory: 'negative'
        }
      });
    });

    it('should calculate neutral CLV when odds barely change', async () => {
      // Bet placed at -110, closing at -111 (negligible movement)
      mockPrisma.betLeg.findUnique.mockResolvedValue({
        id: 'leg-3',
        odds: -110,
        closingOdds: -111
      } as any);

      mockPrisma.betLeg.update.mockResolvedValue({} as any);

      const clv = await service.calculateCLV('leg-3');

      expect(clv).not.toBeNull();
      expect(Math.abs(clv!)).toBeLessThan(1);
      expect(mockPrisma.betLeg.update).toHaveBeenCalledWith({
        where: { id: 'leg-3' },
        data: {
          clv: expect.any(Decimal),
          clvCategory: 'neutral'
        }
      });
    });

    it('should handle positive American odds correctly', async () => {
      // Bet placed at +150, closing at +120 (line shortened = positive CLV)
      mockPrisma.betLeg.findUnique.mockResolvedValue({
        id: 'leg-4',
        odds: 150,
        closingOdds: 120
      } as any);

      mockPrisma.betLeg.update.mockResolvedValue({} as any);

      const clv = await service.calculateCLV('leg-4');

      expect(clv).not.toBeNull();
      // +150 implied: 100/250 = 0.40
      // +120 implied: 100/220 = 0.4545
      // CLV = ((0.4545 - 0.40) / 0.40) * 100 ≈ 13.64%
      expect(clv!).toBeGreaterThan(10);
      expect(clv!).toBeCloseTo(13.64, 0);
    });

    it('should handle mixed positive/negative odds transitions', async () => {
      // Bet placed at +110, closing at -110 (line flipped = strong positive CLV)
      mockPrisma.betLeg.findUnique.mockResolvedValue({
        id: 'leg-5',
        odds: 110,
        closingOdds: -110
      } as any);

      mockPrisma.betLeg.update.mockResolvedValue({} as any);

      const clv = await service.calculateCLV('leg-5');

      expect(clv).not.toBeNull();
      // +110 implied: 100/210 = 0.4762
      // -110 implied: 110/210 = 0.5238
      // CLV = ((0.5238 - 0.4762) / 0.4762) * 100 ≈ 10.0%
      expect(clv!).toBeGreaterThan(5);
    });

    it('should return null when bet leg has no closing odds', async () => {
      mockPrisma.betLeg.findUnique.mockResolvedValue({
        id: 'leg-6',
        odds: -110,
        closingOdds: null
      } as any);

      const clv = await service.calculateCLV('leg-6');

      expect(clv).toBeNull();
      expect(mockPrisma.betLeg.update).not.toHaveBeenCalled();
    });

    it('should return null when bet leg not found', async () => {
      mockPrisma.betLeg.findUnique.mockResolvedValue(null);

      const clv = await service.calculateCLV('nonexistent');

      expect(clv).toBeNull();
    });

    it('should handle even odds correctly', async () => {
      // Bet at +100 (even money), closing at -120
      mockPrisma.betLeg.findUnique.mockResolvedValue({
        id: 'leg-7',
        odds: 100,
        closingOdds: -120
      } as any);

      mockPrisma.betLeg.update.mockResolvedValue({} as any);

      const clv = await service.calculateCLV('leg-7');

      expect(clv).not.toBeNull();
      // +100 implied: 100/200 = 0.50
      // -120 implied: 120/220 = 0.5454
      // CLV is positive (line moved toward favorite)
      expect(clv!).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // CLOSING LINE CAPTURE
  // ========================================================================

  describe('captureClosingLine', () => {
    /**
     * Build a row shaped like the real `OddsSnapshot` model: one row per
     * bookmaker/market, prices in side-specific columns, no per-outcome rows.
     */
    const snapshot = (overrides: Partial<OddsSnapshotRow>): OddsSnapshotRow => ({
      id: 'snapshot-1',
      gameId: 'game-1',
      bookmaker: 'draftkings',
      marketType: 'h2h',
      homePrice: null,
      awayPrice: null,
      homeSpread: null,
      homeSpreadPrice: null,
      awaySpread: null,
      awaySpreadPrice: null,
      totalLine: null,
      overPrice: null,
      underPrice: null,
      capturedAt: new Date('2026-01-15T18:55:00Z'),
      movementType: null,
      movementSize: null,
      volumeIndicator: null,
      ...overrides
    });

    const betLeg = (overrides: Record<string, unknown>) => ({
      id: 'leg-1',
      gameId: 'game-1',
      status: 'pending',
      closingOdds: null,
      selectionType: 'moneyline',
      selection: 'home',
      line: null,
      bookmaker: null,
      ...overrides
    });

    it('should capture the home moneyline price from the most recent snapshot', async () => {
      mockPrisma.betLeg.findMany.mockResolvedValue([
        betLeg({ selectionType: 'moneyline', selection: 'home' })
      ] as any);

      mockPrisma.game.findUnique.mockResolvedValue({
        id: 'game-1',
        oddsSnapshots: [
          snapshot({
            marketType: 'h2h',
            homePrice: -130,
            awayPrice: 110,
            capturedAt: new Date('2026-01-15T18:50:00Z')
          }),
          snapshot({
            marketType: 'h2h',
            homePrice: -135,
            awayPrice: 115,
            capturedAt: new Date('2026-01-15T18:55:00Z')
          })
        ]
      } as any);

      mockPrisma.betLeg.update.mockResolvedValue({} as any);

      await service.captureClosingLine('game-1');

      expect(mockPrisma.betLeg.update).toHaveBeenCalledWith({
        where: { id: 'leg-1' },
        data: { closingOdds: -135 }
      });
    });

    it('should capture the away price for an away selection', async () => {
      mockPrisma.betLeg.findMany.mockResolvedValue([
        betLeg({ selectionType: 'moneyline', selection: 'away' })
      ] as any);

      mockPrisma.game.findUnique.mockResolvedValue({
        id: 'game-1',
        oddsSnapshots: [snapshot({ marketType: 'h2h', homePrice: -135, awayPrice: 115 })]
      } as any);

      mockPrisma.betLeg.update.mockResolvedValue({} as any);

      await service.captureClosingLine('game-1');

      expect(mockPrisma.betLeg.update).toHaveBeenCalledWith({
        where: { id: 'leg-1' },
        data: { closingOdds: 115 }
      });
    });

    it('should capture the spread price for the side the leg was taken on', async () => {
      mockPrisma.betLeg.findMany.mockResolvedValue([
        betLeg({ selectionType: 'spread', selection: 'away', line: new Decimal(3.5) })
      ] as any);

      mockPrisma.game.findUnique.mockResolvedValue({
        id: 'game-1',
        oddsSnapshots: [
          snapshot({
            marketType: 'spreads',
            homeSpread: new Decimal(-3.5),
            homeSpreadPrice: -110,
            awaySpread: new Decimal(3.5),
            awaySpreadPrice: -108
          })
        ]
      } as any);

      mockPrisma.betLeg.update.mockResolvedValue({} as any);

      await service.captureClosingLine('game-1');

      expect(mockPrisma.betLeg.update).toHaveBeenCalledWith({
        where: { id: 'leg-1' },
        data: { closingOdds: -108 }
      });
    });

    it('should skip a spread snapshot whose line moved off the leg line', async () => {
      mockPrisma.betLeg.findMany.mockResolvedValue([
        betLeg({ selectionType: 'spread', selection: 'home', line: new Decimal(-3) })
      ] as any);

      mockPrisma.game.findUnique.mockResolvedValue({
        id: 'game-1',
        oddsSnapshots: [
          // Line moved to -3.5 in the newest snapshot; the -3 price is still
          // the one the leg can be compared against.
          snapshot({
            marketType: 'spreads',
            homeSpread: new Decimal(-3.5),
            homeSpreadPrice: -105,
            capturedAt: new Date('2026-01-15T18:55:00Z')
          }),
          snapshot({
            marketType: 'spreads',
            homeSpread: new Decimal(-3),
            homeSpreadPrice: -118,
            capturedAt: new Date('2026-01-15T18:50:00Z')
          })
        ]
      } as any);

      mockPrisma.betLeg.update.mockResolvedValue({} as any);

      await service.captureClosingLine('game-1');

      expect(mockPrisma.betLeg.update).toHaveBeenCalledWith({
        where: { id: 'leg-1' },
        data: { closingOdds: -118 }
      });
    });

    it('should capture the over price when the total line matches', async () => {
      mockPrisma.betLeg.findMany.mockResolvedValue([
        betLeg({ selectionType: 'total', selection: 'over', line: new Decimal(48.5) })
      ] as any);

      mockPrisma.game.findUnique.mockResolvedValue({
        id: 'game-1',
        oddsSnapshots: [
          snapshot({
            marketType: 'totals',
            totalLine: new Decimal(48.5),
            overPrice: -112,
            underPrice: -108
          })
        ]
      } as any);

      mockPrisma.betLeg.update.mockResolvedValue({} as any);

      await service.captureClosingLine('game-1');

      expect(mockPrisma.betLeg.update).toHaveBeenCalledWith({
        where: { id: 'leg-1' },
        data: { closingOdds: -112 }
      });
    });

    it('should not capture when no snapshot carries the leg total line', async () => {
      mockPrisma.betLeg.findMany.mockResolvedValue([
        betLeg({ selectionType: 'total', selection: 'under', line: new Decimal(48.5) })
      ] as any);

      mockPrisma.game.findUnique.mockResolvedValue({
        id: 'game-1',
        oddsSnapshots: [
          snapshot({
            marketType: 'totals',
            totalLine: new Decimal(50.5),
            overPrice: -110,
            underPrice: -110
          })
        ]
      } as any);

      await service.captureClosingLine('game-1');

      expect(mockPrisma.betLeg.update).not.toHaveBeenCalled();
    });

    it('should ignore snapshots from other markets', async () => {
      mockPrisma.betLeg.findMany.mockResolvedValue([
        betLeg({ selectionType: 'moneyline', selection: 'home' })
      ] as any);

      mockPrisma.game.findUnique.mockResolvedValue({
        id: 'game-1',
        oddsSnapshots: [
          snapshot({
            marketType: 'spreads',
            homeSpread: new Decimal(-3.5),
            homeSpreadPrice: -110
          })
        ]
      } as any);

      await service.captureClosingLine('game-1');

      expect(mockPrisma.betLeg.update).not.toHaveBeenCalled();
    });

    it('should prefer the bookmaker the leg was placed at', async () => {
      mockPrisma.betLeg.findMany.mockResolvedValue([
        betLeg({ selectionType: 'moneyline', selection: 'home', bookmaker: 'FanDuel' })
      ] as any);

      mockPrisma.game.findUnique.mockResolvedValue({
        id: 'game-1',
        oddsSnapshots: [
          snapshot({
            bookmaker: 'draftkings',
            marketType: 'h2h',
            homePrice: -140,
            capturedAt: new Date('2026-01-15T18:59:00Z')
          }),
          snapshot({
            bookmaker: 'fanduel',
            marketType: 'h2h',
            homePrice: -125,
            capturedAt: new Date('2026-01-15T18:55:00Z')
          })
        ]
      } as any);

      mockPrisma.betLeg.update.mockResolvedValue({} as any);

      await service.captureClosingLine('game-1');

      expect(mockPrisma.betLeg.update).toHaveBeenCalledWith({
        where: { id: 'leg-1' },
        data: { closingOdds: -125 }
      });
    });

    it('should fall back to another bookmaker when the leg book has no snapshot', async () => {
      mockPrisma.betLeg.findMany.mockResolvedValue([
        betLeg({ selectionType: 'moneyline', selection: 'home', bookmaker: 'betmgm' })
      ] as any);

      mockPrisma.game.findUnique.mockResolvedValue({
        id: 'game-1',
        oddsSnapshots: [
          snapshot({ bookmaker: 'draftkings', marketType: 'h2h', homePrice: -140 })
        ]
      } as any);

      mockPrisma.betLeg.update.mockResolvedValue({} as any);

      await service.captureClosingLine('game-1');

      expect(mockPrisma.betLeg.update).toHaveBeenCalledWith({
        where: { id: 'leg-1' },
        data: { closingOdds: -140 }
      });
    });

    it('should fall back to an older snapshot when the newest lacks the price', async () => {
      mockPrisma.betLeg.findMany.mockResolvedValue([
        betLeg({ selectionType: 'moneyline', selection: 'away' })
      ] as any);

      mockPrisma.game.findUnique.mockResolvedValue({
        id: 'game-1',
        oddsSnapshots: [
          snapshot({
            marketType: 'h2h',
            homePrice: -135,
            awayPrice: null,
            capturedAt: new Date('2026-01-15T18:59:00Z')
          }),
          snapshot({
            marketType: 'h2h',
            homePrice: -130,
            awayPrice: 112,
            capturedAt: new Date('2026-01-15T18:50:00Z')
          })
        ]
      } as any);

      mockPrisma.betLeg.update.mockResolvedValue({} as any);

      await service.captureClosingLine('game-1');

      expect(mockPrisma.betLeg.update).toHaveBeenCalledWith({
        where: { id: 'leg-1' },
        data: { closingOdds: 112 }
      });
    });

    it('should skip legs that already have closing odds', async () => {
      // The findMany query filters closingOdds: null, so already-captured legs are excluded
      mockPrisma.betLeg.findMany.mockResolvedValue([]);

      await service.captureClosingLine('game-1');

      expect(mockPrisma.game.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.betLeg.update).not.toHaveBeenCalled();
    });

    it('should handle games with no odds snapshots', async () => {
      mockPrisma.betLeg.findMany.mockResolvedValue([betLeg({})] as any);

      mockPrisma.game.findUnique.mockResolvedValue({
        id: 'game-1',
        oddsSnapshots: []
      } as any);

      await service.captureClosingLine('game-1');

      expect(mockPrisma.betLeg.update).not.toHaveBeenCalled();
    });

    it('should handle missing game', async () => {
      mockPrisma.betLeg.findMany.mockResolvedValue([betLeg({})] as any);

      mockPrisma.game.findUnique.mockResolvedValue(null);

      await service.captureClosingLine('game-1');

      expect(mockPrisma.betLeg.update).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // CLV FOR BET
  // ========================================================================

  describe('calculateCLVForBet', () => {
    it('should calculate CLV for all legs in a bet', async () => {
      mockPrisma.bet.findFirst.mockResolvedValue({
        id: 'bet-1',
        legs: [
          { id: 'leg-1', closingOdds: -130, clv: null, odds: -110 },
          { id: 'leg-2', closingOdds: 120, clv: null, odds: 150 }
        ]
      } as any);

      // Mock calculateCLV's internal calls
      mockPrisma.betLeg.findUnique
        .mockResolvedValueOnce({ id: 'leg-1', odds: -110, closingOdds: -130 } as any)
        .mockResolvedValueOnce({ id: 'leg-2', odds: 150, closingOdds: 120 } as any);

      mockPrisma.betLeg.update.mockResolvedValue({} as any);

      await service.calculateCLVForBet('bet-1');

      expect(mockPrisma.betLeg.update).toHaveBeenCalledTimes(2);
    });

    it('should skip legs without closing odds', async () => {
      mockPrisma.bet.findFirst.mockResolvedValue({
        id: 'bet-2',
        legs: [
          { id: 'leg-1', closingOdds: null, clv: null },
          { id: 'leg-2', closingOdds: -120, clv: null, odds: -110 }
        ]
      } as any);

      mockPrisma.betLeg.findUnique.mockResolvedValue({
        id: 'leg-2', odds: -110, closingOdds: -120
      } as any);

      mockPrisma.betLeg.update.mockResolvedValue({} as any);

      await service.calculateCLVForBet('bet-2');

      // Only leg-2 should be calculated
      expect(mockPrisma.betLeg.update).toHaveBeenCalledTimes(1);
    });

    it('should skip legs that already have CLV', async () => {
      mockPrisma.bet.findFirst.mockResolvedValue({
        id: 'bet-3',
        legs: [
          { id: 'leg-1', closingOdds: -130, clv: new Decimal(5.5) }
        ]
      } as any);

      await service.calculateCLVForBet('bet-3');

      expect(mockPrisma.betLeg.findUnique).not.toHaveBeenCalled();
    });

    it('should handle bet not found', async () => {
      mockPrisma.bet.findFirst.mockResolvedValue(null);

      await service.calculateCLVForBet('nonexistent');

      expect(mockPrisma.betLeg.findUnique).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // REPORT GENERATION
  // ========================================================================

  describe('generateCLVReport', () => {
    it('should return empty report when no CLV data exists', async () => {
      mockPrisma.betLeg.findMany.mockResolvedValue([]);

      const report = await service.generateCLVReport();

      expect(report.summary.totalBets).toBe(0);
      expect(report.summary.averageCLV).toBe(0);
      expect(report.bySport).toHaveLength(0);
      expect(report.byBookmaker).toHaveLength(0);
      expect(report.topBets).toHaveLength(0);
      expect(report.worstBets).toHaveLength(0);
    });

    it('should calculate summary statistics from bet legs', async () => {
      mockPrisma.betLeg.findMany.mockResolvedValue([
        {
          id: 'leg-1',
          clv: new Decimal(5.0),
          clvCategory: 'positive',
          status: 'won',
          bet: { id: 'bet-1', name: 'DraftKings NFL', createdAt: new Date(), stake: 100, profit: 90 },
          game: { sport: { key: 'americanfootball_nfl' } }
        },
        {
          id: 'leg-2',
          clv: new Decimal(-3.0),
          clvCategory: 'negative',
          status: 'lost',
          bet: { id: 'bet-2', name: 'FanDuel NBA', createdAt: new Date(), stake: 50, profit: -50 },
          game: { sport: { key: 'basketball_nba' } }
        },
        {
          id: 'leg-3',
          clv: new Decimal(0.5),
          clvCategory: 'neutral',
          status: 'won',
          bet: { id: 'bet-3', name: 'DraftKings NBA', createdAt: new Date(), stake: 75, profit: 60 },
          game: { sport: { key: 'basketball_nba' } }
        }
      ] as any);

      const report = await service.generateCLVReport();

      expect(report.summary.totalBets).toBe(3);
      expect(report.summary.positiveCLVCount).toBe(1);
      expect(report.summary.negativeCLVCount).toBe(1);
      expect(report.summary.neutralCLVCount).toBe(1);
      // Average CLV: (5.0 + -3.0 + 0.5) / 3 ≈ 0.833
      expect(report.summary.averageCLV).toBeCloseTo(0.833, 1);
    });

    it('should group by sport correctly', async () => {
      mockPrisma.betLeg.findMany.mockResolvedValue([
        {
          clv: new Decimal(5.0), clvCategory: 'positive', status: 'won',
          bet: { id: 'bet-1', name: 'Test', createdAt: new Date() },
          game: { sport: { key: 'americanfootball_nfl' } }
        },
        {
          clv: new Decimal(3.0), clvCategory: 'positive', status: 'won',
          bet: { id: 'bet-2', name: 'Test', createdAt: new Date() },
          game: { sport: { key: 'americanfootball_nfl' } }
        },
        {
          clv: new Decimal(-2.0), clvCategory: 'negative', status: 'lost',
          bet: { id: 'bet-3', name: 'Test', createdAt: new Date() },
          game: { sport: { key: 'basketball_nba' } }
        }
      ] as any);

      const report = await service.generateCLVReport();

      expect(report.bySport).toHaveLength(2);
      const nfl = report.bySport.find(s => s.sportKey === 'americanfootball_nfl');
      const nba = report.bySport.find(s => s.sportKey === 'basketball_nba');
      expect(nfl?.count).toBe(2);
      expect(nfl?.averageCLV).toBe(4.0);
      expect(nba?.count).toBe(1);
      expect(nba?.averageCLV).toBe(-2.0);
    });

    it('should return top and worst bets sorted by CLV', async () => {
      mockPrisma.betLeg.findMany.mockResolvedValue([
        {
          clv: new Decimal(10.0), clvCategory: 'positive', status: 'won',
          bet: { id: 'bet-best', name: 'Best Bet', createdAt: new Date() },
          game: { sport: { key: 'nfl' } }
        },
        {
          clv: new Decimal(-8.0), clvCategory: 'negative', status: 'lost',
          bet: { id: 'bet-worst', name: 'Worst Bet', createdAt: new Date() },
          game: { sport: { key: 'nba' } }
        },
        {
          clv: new Decimal(2.0), clvCategory: 'positive', status: 'won',
          bet: { id: 'bet-mid', name: 'Mid Bet', createdAt: new Date() },
          game: { sport: { key: 'nfl' } }
        }
      ] as any);

      const report = await service.generateCLVReport();

      expect(report.topBets[0].betId).toBe('bet-best');
      expect(report.topBets[0].clv).toBe(10.0);
      expect(report.worstBets[0].betId).toBe('bet-worst');
      expect(report.worstBets[0].clv).toBe(-8.0);
    });

    it('should calculate CLV win rate correctly', async () => {
      // 2 positive CLV bets: 1 won, 1 lost = 50% CLV win rate
      mockPrisma.betLeg.findMany.mockResolvedValue([
        {
          clv: new Decimal(5.0), clvCategory: 'positive', status: 'won',
          bet: { id: 'bet-1', name: 'Test', createdAt: new Date() },
          game: { sport: { key: 'nfl' } }
        },
        {
          clv: new Decimal(3.0), clvCategory: 'positive', status: 'lost',
          bet: { id: 'bet-2', name: 'Test', createdAt: new Date() },
          game: { sport: { key: 'nfl' } }
        }
      ] as any);

      const report = await service.generateCLVReport();

      expect(report.summary.clvWinRate).toBe(50);
    });
  });
});
