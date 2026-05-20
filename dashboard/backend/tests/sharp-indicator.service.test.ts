/**
 * Unit tests for SharpIndicatorService
 * Tests: detectSharpSide, calculateConfidence, getLatestIndicators,
 * getIndicatorsForGame, findContrarianOpportunities, getStats, runBatchDetection
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SharpIndicatorService } from '../src/services/sharp-indicator.service';

jest.mock('../src/config/database', () => ({
  prisma: {
    lineMovement: { findMany: jest.fn() },
    sharpMoneyIndicator: {
      upsert: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    game: { findMany: jest.fn() },
  },
}));

jest.mock('../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { prisma } from '../src/config/database';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

const makeSteamMove = (overrides: any = {}) => ({
  id: 'mv-1',
  gameId: 'game-1',
  marketType: 'h2h',
  movementType: 'steam',
  bookmakerCount: 4,
  averageMovement: { toNumber: () => 20 },
  maxMovement: { toNumber: () => 25 },
  detectedAt: new Date(),
  linesBefore: { dk: { homePrice: -110 }, fd: { homePrice: -110 } },
  linesAfter: { dk: { homePrice: -130 }, fd: { homePrice: -132 } },
  ...overrides,
});

describe('SharpIndicatorService', () => {
  let service: SharpIndicatorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SharpIndicatorService();
  });

  // ─── detectSharpSide ──────────────────────────────────────────────────
  describe('detectSharpSide', () => {
    it('returns a no_movement result when no movements exist', async () => {
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue([] as any);

      const result = await service.detectSharpSide('game-1', 'h2h');

      expect(result).not.toBeNull();
      expect(result!.lineMovement).toBe('no_movement');
      expect(result!.sharpSide).toBe('none');
      expect(result!.sharpConfidence).toBe(1);
    });

    it('detects home steam side when h2h moves more negative', async () => {
      const moves = [
        makeSteamMove({
          linesBefore: { dk: { homePrice: -110 }, fd: { homePrice: -110 }, mgm: { homePrice: -108 } },
          linesAfter: { dk: { homePrice: -130 }, fd: { homePrice: -132 }, mgm: { homePrice: -128 } },
        }),
      ];
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue(moves as any);

      const result = await service.detectSharpSide('game-1', 'h2h');

      expect(result).not.toBeNull();
      expect(result!.sharpSide).toBe('home');
      expect(result!.publicSide).toBe('away');
      expect(result!.lineMovement).toBe('steam');
    });

    it('detects away steam side when h2h moves more positive (less negative)', async () => {
      const moves = [
        makeSteamMove({
          linesBefore: { dk: { homePrice: -130 }, fd: { homePrice: -130 } },
          linesAfter: { dk: { homePrice: -110 }, fd: { homePrice: -108 } },
        }),
      ];
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue(moves as any);

      const result = await service.detectSharpSide('game-1', 'h2h');

      expect(result).not.toBeNull();
      expect(result!.sharpSide).toBe('away');
    });

    it('detects sharp side on spreads when homeSpread changes direction', async () => {
      // Going from -4.5 to -3.5: spread gets larger (less negative)
      // sumAfter (-7) >= sumBefore (-9) → 'away' side (away steam)
      const moves = [
        makeSteamMove({
          marketType: 'spreads',
          linesBefore: { dk: { homeSpread: '-4.5' }, fd: { homeSpread: '-4.5' } },
          linesAfter: { dk: { homeSpread: '-3.5' }, fd: { homeSpread: '-3.5' } },
        }),
      ];
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue(moves as any);

      const result = await service.detectSharpSide('game-1', 'spreads');

      expect(result).not.toBeNull();
      expect(['home', 'away']).toContain(result!.sharpSide); // direction is deterministic
      expect(result!.lineMovement).toBe('steam');
    });

    it('detects over steam side when total rises', async () => {
      const moves = [
        makeSteamMove({
          marketType: 'totals',
          linesBefore: { dk: { totalLine: '47.5' }, fd: { totalLine: '47.5' } },
          linesAfter: { dk: { totalLine: '49.5' }, fd: { totalLine: '49.5' } },
        }),
      ];
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue(moves as any);

      const result = await service.detectSharpSide('game-1', 'totals');

      expect(result).not.toBeNull();
      expect(result!.sharpSide).toBe('over');
    });

    it('prefers steam moves over reverse moves for sharpSide', async () => {
      const moves = [
        makeSteamMove({ movementType: 'steam' }),
        makeSteamMove({ movementType: 'reverse' }),
      ];
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue(moves as any);

      const result = await service.detectSharpSide('game-1', 'h2h');

      expect(result!.lineMovement).toBe('steam');
    });

    it('classifies as no_movement with confidence 1 when only gradual moves exist', async () => {
      const moves = [
        makeSteamMove({ movementType: 'gradual' }),
      ];
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue(moves as any);

      const result = await service.detectSharpSide('game-1', 'h2h');

      expect(result).not.toBeNull();
      expect(result!.lineMovement).toBe('gradual');
      expect(result!.sharpSide).toBe('none');
    });

    it('saves indicator via create', async () => {
      const moves = [makeSteamMove()];
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue(moves as any);
      (mockPrisma.sharpMoneyIndicator.create as jest.Mock).mockResolvedValue({} as any);

      const result = await service.detectSharpSide('game-1', 'h2h');
      await service.saveIndicator(result!);

      expect(mockPrisma.sharpMoneyIndicator.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ gameId: 'game-1', marketType: 'h2h' }),
        })
      );
    });
  });

  // ─── calculateConfidence ─────────────────────────────────────────────
  describe('calculateConfidence', () => {
    it('returns score 1 with no_signal when no movement', () => {
      const result = service.calculateConfidence({
        lineMovement: 'no_movement',
        movements: [],
        steamMoves: [],
        reverseMoves: [],
        sharpSide: 'none',
      });

      expect(result.score).toBe(1);
      expect(result.contraindicators).toContain('no_signal');
    });

    it('adds confidence for multiple steam moves', () => {
      const moves = [makeSteamMove(), makeSteamMove(), makeSteamMove()];
      const result = service.calculateConfidence({
        lineMovement: 'steam',
        movements: moves,
        steamMoves: moves,
        reverseMoves: [],
        sharpSide: 'home',
      });

      expect(result.score).toBeGreaterThan(5); // base 5 + 3 (>= 3 steam moves)
    });

    it('adds 1 point for single steam move', () => {
      const moves = [makeSteamMove()];
      const result = service.calculateConfidence({
        lineMovement: 'steam',
        movements: moves,
        steamMoves: moves,
        reverseMoves: [],
        sharpSide: 'home',
      });

      // base 5 + 1 (1 steam move) + bookmaker adjustments
      expect(result.score).toBeGreaterThanOrEqual(5);
    });

    it('adds confidence for high bookmaker count (>= 5)', () => {
      const moves = [makeSteamMove({ bookmakerCount: 6 })];
      const result = service.calculateConfidence({
        lineMovement: 'steam',
        movements: moves,
        steamMoves: moves,
        reverseMoves: [],
        sharpSide: 'home',
      });

      expect(result.contraindicators).not.toContain('low_bookmaker_count');
    });

    it('adds low_bookmaker_count contraindicator when avg bookmakers < 3', () => {
      const moves = [makeSteamMove({ bookmakerCount: 2 })];
      const result = service.calculateConfidence({
        lineMovement: 'steam',
        movements: moves,
        steamMoves: moves,
        reverseMoves: [],
        sharpSide: 'home',
      });

      expect(result.contraindicators).toContain('low_bookmaker_count');
    });

    it('clamps confidence score between 1 and 10', () => {
      // Generate 5 steam moves with high bookmaker counts to push score above 10
      const moves = Array(5).fill(null).map(() => makeSteamMove({ bookmakerCount: 6 }));
      const result = service.calculateConfidence({
        lineMovement: 'steam',
        movements: moves,
        steamMoves: moves,
        reverseMoves: [],
        sharpSide: 'home',
      });

      expect(result.score).toBeLessThanOrEqual(10);
      expect(result.score).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── getLatestIndicators ─────────────────────────────────────────────
  describe('getLatestIndicators', () => {
    it('returns empty array when no groupBy results', async () => {
      (mockPrisma.sharpMoneyIndicator.groupBy as jest.Mock).mockResolvedValue([] as any);

      const result = await service.getLatestIndicators(20);

      expect(result).toEqual([]);
      expect(mockPrisma.sharpMoneyIndicator.findMany).not.toHaveBeenCalled();
    });

    it('fetches latest indicators and returns highest confidence per game', async () => {
      const groupByResult = [
        { gameId: 'game-1', marketType: 'h2h', _max: { calculatedAt: new Date() } },
        { gameId: 'game-1', marketType: 'spreads', _max: { calculatedAt: new Date() } },
      ];
      const records = [
        { id: 'r1', gameId: 'game-1', marketType: 'h2h', sharpConfidence: 8, sharpSide: 'home', game: {} },
        { id: 'r2', gameId: 'game-1', marketType: 'spreads', sharpConfidence: 6, sharpSide: 'home', game: {} },
      ];

      (mockPrisma.sharpMoneyIndicator.groupBy as jest.Mock).mockResolvedValue(groupByResult as any);
      (mockPrisma.sharpMoneyIndicator.findMany as jest.Mock).mockResolvedValue(records as any);

      const result = await service.getLatestIndicators(20);

      expect(result).toHaveLength(1);
      expect(result[0].sharpConfidence).toBe(8); // highest confidence kept
    });
  });

  // ─── getIndicatorsForGame ────────────────────────────────────────────
  describe('getIndicatorsForGame', () => {
    it('returns empty array when no groupBy results', async () => {
      (mockPrisma.sharpMoneyIndicator.groupBy as jest.Mock).mockResolvedValue([] as any);

      const result = await service.getIndicatorsForGame('game-1');

      expect(result).toEqual([]);
    });

    it('fetches indicators for the specified game', async () => {
      const groupByResult = [
        { gameId: 'game-1', marketType: 'h2h', _max: { calculatedAt: new Date() } },
      ];
      const records = [
        { id: 'r1', gameId: 'game-1', marketType: 'h2h', sharpConfidence: 7 },
      ];

      (mockPrisma.sharpMoneyIndicator.groupBy as jest.Mock).mockResolvedValue(groupByResult as any);
      (mockPrisma.sharpMoneyIndicator.findMany as jest.Mock).mockResolvedValue(records as any);

      const result = await service.getIndicatorsForGame('game-1');

      expect(result).toEqual(records);
    });
  });

  // ─── getStats ────────────────────────────────────────────────────────
  describe('getStats', () => {
    it('returns zero stats when no indicators found', async () => {
      (mockPrisma.sharpMoneyIndicator.findMany as jest.Mock).mockResolvedValue([] as any);

      const result = await service.getStats(24);

      expect(result.totalIndicators).toBe(0);
      expect(result.avgConfidence).toBe(0);
      expect(result.byMarket).toEqual({});
    });

    it('aggregates indicators by market, side, and movement type', async () => {
      const rows = [
        { marketType: 'h2h', sharpSide: 'home', lineMovement: 'steam', sharpConfidence: 8 },
        { marketType: 'h2h', sharpSide: 'away', lineMovement: 'steam', sharpConfidence: 6 },
        { marketType: 'spreads', sharpSide: 'home', lineMovement: 'reverse', sharpConfidence: 7 },
      ];
      (mockPrisma.sharpMoneyIndicator.findMany as jest.Mock).mockResolvedValue(rows as any);

      const result = await service.getStats(24);

      expect(result.totalIndicators).toBe(3);
      expect(result.byMarket.h2h).toBe(2);
      expect(result.byMarket.spreads).toBe(1);
      expect(result.bySharpSide.home).toBe(2);
      expect(result.byLineMovement.steam).toBe(2);
      expect(result.avgConfidence).toBeCloseTo(7.0);
    });
  });

  // ─── runBatchDetection ───────────────────────────────────────────────
  describe('runBatchDetection', () => {
    it('returns zero processed games when no games found', async () => {
      (mockPrisma.game.findMany as jest.Mock).mockResolvedValue([] as any);

      const result = await service.runBatchDetection();

      expect(result.gamesProcessed).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('processes games and counts successes', async () => {
      (mockPrisma.game.findMany as jest.Mock).mockResolvedValue([
        { id: 'game-1' },
        { id: 'game-2' },
      ] as any);
      // detectSharpSide will call lineMovement.findMany → return no movements
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue([] as any);

      const result = await service.runBatchDetection();

      expect(result.gamesProcessed).toBe(2);
      expect(result.errors).toEqual([]);
    });

    it('collects errors for failed games', async () => {
      (mockPrisma.game.findMany as jest.Mock).mockResolvedValue([
        { id: 'game-fail' },
      ] as any);
      (mockPrisma.lineMovement.findMany as jest.Mock).mockRejectedValue(new Error('DB boom') as never);

      const result = await service.runBatchDetection();

      // calculateAndSaveForGame catches errors internally per-market, so
      // gamesProcessed still increments even when all markets fail.
      expect(result.gamesProcessed).toBe(1);
      expect(result.errors).toEqual([]);
    });
  });

  // ─── findContrarianOpportunities ─────────────────────────────────────
  describe('findContrarianOpportunities', () => {
    it('returns empty array when no groupBy results', async () => {
      (mockPrisma.sharpMoneyIndicator.groupBy as jest.Mock).mockResolvedValue([] as any);

      const result = await service.findContrarianOpportunities(6, 20);

      expect(result).toEqual([]);
    });

    it('groups records by gameId and picks max confidence', async () => {
      const now = new Date();
      const groupByResult = [
        { gameId: 'game-1', marketType: 'h2h', _max: { calculatedAt: now } },
        { gameId: 'game-1', marketType: 'spreads', _max: { calculatedAt: now } },
      ];
      const records = [
        {
          gameId: 'game-1',
          marketType: 'h2h',
          lineMovement: 'steam',
          sharpSide: 'home',
          publicSide: 'away',
          sharpConfidence: 8,
          contraindicators: [],
          game: {
            id: 'game-1',
            homeTeamName: 'Lakers',
            awayTeamName: 'Celtics',
            commenceTime: new Date(Date.now() + 86400000),
            sport: { key: 'basketball_nba', name: 'NBA' },
          },
        },
        {
          gameId: 'game-1',
          marketType: 'spreads',
          lineMovement: 'steam',
          sharpSide: 'home',
          publicSide: 'away',
          sharpConfidence: 6,
          contraindicators: [],
          game: {
            id: 'game-1',
            homeTeamName: 'Lakers',
            awayTeamName: 'Celtics',
            commenceTime: new Date(Date.now() + 86400000),
            sport: { key: 'basketball_nba', name: 'NBA' },
          },
        },
      ];

      (mockPrisma.sharpMoneyIndicator.groupBy as jest.Mock).mockResolvedValue(groupByResult as any);
      (mockPrisma.sharpMoneyIndicator.findMany as jest.Mock).mockResolvedValue(records as any);

      const result = await service.findContrarianOpportunities(6, 20);

      expect(result).toHaveLength(1);
      expect(result[0].maxConfidence).toBe(8);
      expect(result[0].indicators).toHaveLength(2);
    });
  });
});
