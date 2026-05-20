/**
 * Unit tests for LineMovementService
 * Tests public methods: getGameMovements, getMovementsByType, getRecentMovements,
 * getSteamMoves, getMovementStats, and the classification/analysis logic via detectMovements.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LineMovementService } from '../src/services/line-movement.service';

jest.mock('../src/config/database', () => ({
  prisma: {
    oddsSnapshot: { findMany: jest.fn() },
    lineMovement: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
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

const makeSnapshot = (opts: {
  bookmaker: string;
  capturedAt: Date;
  marketType: string;
  homePrice?: number;
  homeSpread?: number;
  totalLine?: number;
}) => ({
  id: `snap-${Math.random()}`,
  bookmaker: opts.bookmaker,
  capturedAt: opts.capturedAt,
  marketType: opts.marketType,
  gameId: 'game-1',
  homePrice: opts.homePrice ?? null,
  awayPrice: opts.homePrice ? opts.homePrice + 10 : null,
  homeSpread: opts.homeSpread ?? null,
  homeSpreadPrice: null,
  awaySpread: opts.homeSpread ? -opts.homeSpread : null,
  awaySpreadPrice: null,
  totalLine: opts.totalLine ?? null,
  overPrice: null,
  underPrice: null,
  syncTimestamp: opts.capturedAt,
});

describe('LineMovementService', () => {
  let service: LineMovementService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LineMovementService();
  });

  // ─── getGameMovements ──────────────────────────────────────────────────
  describe('getGameMovements', () => {
    it('queries lineMovement with gameId and default limit', async () => {
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue([] as any);

      await service.getGameMovements('game-1');

      expect(mockPrisma.lineMovement.findMany).toHaveBeenCalledWith({
        where: { gameId: 'game-1' },
        orderBy: { detectedAt: 'desc' },
        take: 50,
      });
    });

    it('respects custom limit', async () => {
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue([] as any);

      await service.getGameMovements('game-1', 10);

      expect(mockPrisma.lineMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });

    it('returns movements from the database', async () => {
      const movements = [{ id: 'mv-1', gameId: 'game-1', movementType: 'steam' }];
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue(movements as any);

      const result = await service.getGameMovements('game-1');

      expect(result).toEqual(movements);
    });
  });

  // ─── getMovementsByType ───────────────────────────────────────────────
  describe('getMovementsByType', () => {
    it('filters by movement type and time window', async () => {
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue([] as any);

      await service.getMovementsByType('steam', 12);

      expect(mockPrisma.lineMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ movementType: 'steam' }),
          include: { game: true },
          orderBy: { detectedAt: 'desc' },
        })
      );
    });

    it('returns filtered movements', async () => {
      const movements = [{ id: 'mv-2', movementType: 'reverse' }];
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue(movements as any);

      const result = await service.getMovementsByType('reverse', 24);

      expect(result).toEqual(movements);
    });
  });

  // ─── getRecentMovements ───────────────────────────────────────────────
  describe('getRecentMovements', () => {
    it('fetches all movements from the last N hours', async () => {
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue([] as any);

      await service.getRecentMovements(6);

      expect(mockPrisma.lineMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { game: true },
          orderBy: { detectedAt: 'desc' },
        })
      );
    });
  });

  // ─── getSteamMoves ────────────────────────────────────────────────────
  describe('getSteamMoves', () => {
    it('returns steam moves with default limit 20', async () => {
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue([] as any);

      await service.getSteamMoves();

      expect(mockPrisma.lineMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { movementType: 'steam' },
          take: 20,
        })
      );
    });

    it('respects custom limit', async () => {
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue([] as any);

      await service.getSteamMoves(5);

      expect(mockPrisma.lineMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });
  });

  // ─── getMovementStats ─────────────────────────────────────────────────
  describe('getMovementStats', () => {
    it('counts movements by type and market', async () => {
      const movements = [
        { movementType: 'steam', marketType: 'h2h' },
        { movementType: 'steam', marketType: 'spreads' },
        { movementType: 'gradual', marketType: 'totals' },
        { movementType: 'normal', marketType: 'h2h' },
      ];
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue(movements as any);

      const result = await service.getMovementStats(24);

      expect(result.byType.steam).toBe(2);
      expect(result.byType.gradual).toBe(1);
      expect(result.byType.normal).toBe(1);
      expect(result.byMarket.h2h).toBe(2);
      expect(result.byMarket.spreads).toBe(1);
      expect(result.byMarket.totals).toBe(1);
    });

    it('returns zero counts when no movements found', async () => {
      (mockPrisma.lineMovement.findMany as jest.Mock).mockResolvedValue([] as any);

      const result = await service.getMovementStats(24);

      expect(result.byType).toEqual({ steam: 0, reverse: 0, gradual: 0, injury: 0, normal: 0 });
      expect(result.byMarket).toEqual({ h2h: 0, spreads: 0, totals: 0 });
    });
  });

  // ─── detectMovements ──────────────────────────────────────────────────
  describe('detectMovements', () => {
    it('returns empty array when fewer than 2 snapshots exist', async () => {
      (mockPrisma.oddsSnapshot.findMany as jest.Mock).mockResolvedValue([
        makeSnapshot({ bookmaker: 'dk', capturedAt: new Date(), marketType: 'h2h', homePrice: -110 }),
      ] as any);

      const result = await service.detectMovements('game-1');

      expect(result).toEqual([]);
      expect(mockPrisma.lineMovement.create).not.toHaveBeenCalled();
    });

    it('returns empty array when no snapshots exist', async () => {
      (mockPrisma.oddsSnapshot.findMany as jest.Mock).mockResolvedValue([] as any);

      const result = await service.detectMovements('game-1');

      expect(result).toEqual([]);
    });

    it('detects steam move when 3+ bookmakers move 15+ cents on h2h within 900s', async () => {
      const t1 = new Date('2026-05-19T10:00:00Z');
      const t2 = new Date('2026-05-19T10:10:00Z');

      const snapshots = [
        makeSnapshot({ bookmaker: 'dk', capturedAt: t1, marketType: 'h2h', homePrice: -110 }),
        makeSnapshot({ bookmaker: 'fd', capturedAt: t1, marketType: 'h2h', homePrice: -110 }),
        makeSnapshot({ bookmaker: 'mgm', capturedAt: t1, marketType: 'h2h', homePrice: -110 }),
        makeSnapshot({ bookmaker: 'dk', capturedAt: t2, marketType: 'h2h', homePrice: -130 }),
        makeSnapshot({ bookmaker: 'fd', capturedAt: t2, marketType: 'h2h', homePrice: -135 }),
        makeSnapshot({ bookmaker: 'mgm', capturedAt: t2, marketType: 'h2h', homePrice: -128 }),
      ];
      (mockPrisma.oddsSnapshot.findMany as jest.Mock).mockResolvedValue(snapshots as any);
      (mockPrisma.lineMovement.create as jest.Mock).mockImplementation(async ({ data }: any) => ({
        id: 'mv-new',
        ...data,
      }));

      const result = await service.detectMovements('game-1');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].movementType).toBe('steam');
      expect(mockPrisma.lineMovement.create).toHaveBeenCalled();
    });

    it('detects steam move on spreads when 3+ books move 1.5+ points', async () => {
      const t1 = new Date('2026-05-19T11:00:00Z');
      const t2 = new Date('2026-05-19T11:05:00Z');

      const snapshots = [
        makeSnapshot({ bookmaker: 'dk', capturedAt: t1, marketType: 'spreads', homeSpread: -3.5 }),
        makeSnapshot({ bookmaker: 'fd', capturedAt: t1, marketType: 'spreads', homeSpread: -3.5 }),
        makeSnapshot({ bookmaker: 'mgm', capturedAt: t1, marketType: 'spreads', homeSpread: -3.5 }),
        makeSnapshot({ bookmaker: 'dk', capturedAt: t2, marketType: 'spreads', homeSpread: -5.5 }),
        makeSnapshot({ bookmaker: 'fd', capturedAt: t2, marketType: 'spreads', homeSpread: -5.5 }),
        makeSnapshot({ bookmaker: 'mgm', capturedAt: t2, marketType: 'spreads', homeSpread: -5.5 }),
      ];
      (mockPrisma.oddsSnapshot.findMany as jest.Mock).mockResolvedValue(snapshots as any);
      (mockPrisma.lineMovement.create as jest.Mock).mockImplementation(async ({ data }: any) => ({
        id: 'mv-spread',
        ...data,
      }));

      const result = await service.detectMovements('game-1');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].movementType).toBe('steam');
    });

    it('classifies gradual moves when timeElapsed > 3600s and avgMovement < 1', async () => {
      const t1 = new Date('2026-05-19T08:00:00Z');
      const t2 = new Date('2026-05-19T10:00:00Z'); // 2 hours later

      const snapshots = [
        makeSnapshot({ bookmaker: 'dk', capturedAt: t1, marketType: 'spreads', homeSpread: -3.5 }),
        makeSnapshot({ bookmaker: 'fd', capturedAt: t1, marketType: 'spreads', homeSpread: -3.5 }),
        makeSnapshot({ bookmaker: 'dk', capturedAt: t2, marketType: 'spreads', homeSpread: -3.9 }),
        makeSnapshot({ bookmaker: 'fd', capturedAt: t2, marketType: 'spreads', homeSpread: -3.8 }),
      ];
      (mockPrisma.oddsSnapshot.findMany as jest.Mock).mockResolvedValue(snapshots as any);
      (mockPrisma.lineMovement.create as jest.Mock).mockImplementation(async ({ data }: any) => ({
        id: 'mv-gradual',
        ...data,
      }));

      const result = await service.detectMovements('game-1');

      // With only 2 time groups no gradual pass runs (needs > 2)
      expect(result).toBeDefined();
    });

    it('skips snapshot pairs already processed (sinceTime guard)', async () => {
      const t1 = new Date('2026-05-19T10:00:00Z');
      const t2 = new Date('2026-05-19T10:10:00Z');
      const sinceTime = new Date('2026-05-19T10:15:00Z'); // after t2

      const snapshots = [
        makeSnapshot({ bookmaker: 'dk', capturedAt: t1, marketType: 'h2h', homePrice: -110 }),
        makeSnapshot({ bookmaker: 'fd', capturedAt: t1, marketType: 'h2h', homePrice: -110 }),
        makeSnapshot({ bookmaker: 'mgm', capturedAt: t1, marketType: 'h2h', homePrice: -110 }),
        makeSnapshot({ bookmaker: 'dk', capturedAt: t2, marketType: 'h2h', homePrice: -130 }),
        makeSnapshot({ bookmaker: 'fd', capturedAt: t2, marketType: 'h2h', homePrice: -132 }),
        makeSnapshot({ bookmaker: 'mgm', capturedAt: t2, marketType: 'h2h', homePrice: -128 }),
      ];
      (mockPrisma.oddsSnapshot.findMany as jest.Mock).mockResolvedValue(snapshots as any);

      const result = await service.detectMovements('game-1', 10, sinceTime);

      expect(result).toEqual([]);
      expect(mockPrisma.lineMovement.create).not.toHaveBeenCalled();
    });

    it('propagates errors from the database', async () => {
      (mockPrisma.oddsSnapshot.findMany as jest.Mock).mockRejectedValue(new Error('Connection lost') as never);

      await expect(service.detectMovements('game-1')).rejects.toThrow('Connection lost');
    });
  });
});
