/**
 * Tests for lineMovementService.
 *
 * Two behaviours matter beyond plain unwrapping: the optional filters
 * (`movementType`, `marketType`) must be omitted from the query string rather
 * than sent as `undefined`, and the statistics fallbacks must produce a fully
 * zeroed `MovementStats` so chart code can index it without guarding.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lineMovementService } from './line-movement.service';
import {
  makeLineMovement,
  MOVEMENT_STATS,
  movementEnvelope,
  axiosError,
} from '../test/fixtures';

vi.mock('./api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import api from './api';
const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };

const ZEROED_STATS = {
  byType: { steam: 0, reverse: 0, gradual: 0, injury: 0, normal: 0 },
  byMarket: { h2h: 0, spreads: 0, totals: 0 },
};

describe('lineMovementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLiveMovements', () => {
    it('applies the documented defaults', async () => {
      mockApi.get.mockResolvedValue(movementEnvelope({ movements: [makeLineMovement()], total: 1 }));

      const result = await lineMovementService.getLiveMovements();

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/movements/live', {
        params: { limit: 20, hoursBack: 4, movementType: 'steam' },
      });
      expect(result.total).toBe(1);
      expect(result.movements[0].movementType).toBe('steam');
      // A steam move is defined by several books moving together; the fixture
      // records three books and the same 1.5-point shift on each.
      expect(result.movements[0].bookmakerCount).toBe(3);
      expect(Number(result.movements[0].averageMovement)).toBe(1.5);
    });

    it('passes explicit limit, window and movement type', async () => {
      mockApi.get.mockResolvedValue(movementEnvelope({ movements: [], total: 0 }));

      await lineMovementService.getLiveMovements(50, 12, 'reverse');

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/movements/live', {
        params: { limit: 50, hoursBack: 12, movementType: 'reverse' },
      });
    });

    it('falls back to an empty result set when data is null', async () => {
      mockApi.get.mockResolvedValue({ data: { status: 'error', data: null } });

      const result = await lineMovementService.getLiveMovements();

      expect(result).toEqual({ movements: [], total: 0 });
    });
  });

  describe('getGameMovements', () => {
    it('builds the per-game path with the limit param', async () => {
      const game = {
        id: 'game-lal-bos',
        matchup: 'Los Angeles Lakers @ Boston Celtics',
        sport: 'NBA Basketball',
        commenceTime: '2026-01-15T20:00:00.000Z',
      };
      mockApi.get.mockResolvedValue(
        movementEnvelope({ movements: [makeLineMovement()], total: 1, game })
      );

      const result = await lineMovementService.getGameMovements('game-lal-bos');

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/movements/game/game-lal-bos', {
        params: { limit: 50 },
      });
      expect(result.game.matchup).toBe('Los Angeles Lakers @ Boston Celtics');
      expect(result.movements).toHaveLength(1);
    });
  });

  describe('getMovementHistory', () => {
    it('omits movementType from the query when it is not supplied', async () => {
      mockApi.get.mockResolvedValue(
        movementEnvelope({ movements: [], total: 0, statistics: MOVEMENT_STATS, byDate: {} })
      );

      await lineMovementService.getMovementHistory();

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/movements/history', {
        params: { hoursBack: 24 },
      });
      const [, config] = mockApi.get.mock.calls[0];
      expect('movementType' in config.params).toBe(false);
    });

    it('includes movementType when supplied and groups movements by date', async () => {
      const movement = makeLineMovement();
      mockApi.get.mockResolvedValue(
        movementEnvelope({
          movements: [movement],
          total: 1,
          statistics: MOVEMENT_STATS,
          byDate: { '2026-01-15': [movement] },
        })
      );

      const result = await lineMovementService.getMovementHistory(48, 'steam');

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/movements/history', {
        params: { hoursBack: 48, movementType: 'steam' },
      });
      expect(result.statistics.byType.steam).toBe(11);
      expect(result.byDate['2026-01-15']).toHaveLength(1);
    });

    it('returns fully zeroed statistics when the backend omits them', async () => {
      mockApi.get.mockResolvedValue({ data: { status: 'error', data: null } });

      const result = await lineMovementService.getMovementHistory();

      expect(result.statistics).toEqual(ZEROED_STATS);
      expect(result.movements).toEqual([]);
      expect(result.byDate).toEqual({});
    });
  });

  describe('getBookmakerMovements', () => {
    it('encodes the bookmaker key and omits marketType by default', async () => {
      mockApi.get.mockResolvedValue(
        movementEnvelope({
          movements: [],
          total: 0,
          impactStats: { totalMovements: 42, steamMoves: 6, avgMovementSize: '1.20' },
          recentMovements: [makeLineMovement()],
        })
      );

      const result = await lineMovementService.getBookmakerMovements('bet/365');

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/movements/bookmaker/bet%2F365', {
        params: { hoursBack: 24 },
      });
      expect(result.impactStats.steamMoves).toBe(6);
      expect(result.recentMovements).toHaveLength(1);
    });

    it('includes marketType when supplied', async () => {
      mockApi.get.mockResolvedValue(movementEnvelope({ movements: [], total: 0 }));

      await lineMovementService.getBookmakerMovements('draftkings', 6, 'totals');

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/movements/bookmaker/draftkings', {
        params: { hoursBack: 6, marketType: 'totals' },
      });
    });

    it('returns an empty recentMovements list when data is null', async () => {
      mockApi.get.mockResolvedValue({ data: { status: 'error', data: null } });

      const result = await lineMovementService.getBookmakerMovements('draftkings');

      expect(result.recentMovements).toEqual([]);
      expect(result.impactStats).toBeUndefined();
    });
  });

  describe('getMovementStats', () => {
    it('returns counts for the requested window', async () => {
      mockApi.get.mockResolvedValue(
        movementEnvelope({
          movements: [],
          total: 0,
          statistics: MOVEMENT_STATS,
          steamMovesCount: 11,
          totalMovements: 60,
        })
      );

      const result = await lineMovementService.getMovementStats(12);

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/movements/stats', {
        params: { hoursBack: 12 },
      });
      expect(result.steamMovesCount).toBe(11);
      // The steam count must agree with the per-type breakdown, and the
      // breakdown must account for every movement in the window.
      expect(result.statistics.byType.steam).toBe(result.steamMovesCount);
      const typeTotal = Object.values(result.statistics.byType).reduce((a, b) => a + b, 0);
      expect(typeTotal).toBe(result.totalMovements);
    });

    it('zeroes every counter when the backend returns no data', async () => {
      mockApi.get.mockResolvedValue({ data: { status: 'error', data: null } });

      const result = await lineMovementService.getMovementStats();

      expect(result).toEqual({
        statistics: ZEROED_STATS,
        steamMovesCount: 0,
        totalMovements: 0,
      });
    });
  });

  describe('getSteamMoves', () => {
    it('queries the live endpoint pinned to steam over a 24-hour window', async () => {
      mockApi.get.mockResolvedValue(movementEnvelope({ movements: [makeLineMovement()], total: 1 }));

      const movements = await lineMovementService.getSteamMoves(5);

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/movements/live', {
        params: { limit: 5, hoursBack: 24, movementType: 'steam' },
      });
      expect(movements).toHaveLength(1);
    });

    it('returns an empty array when nothing is found', async () => {
      mockApi.get.mockResolvedValue({ data: { status: 'success', data: null } });

      await expect(lineMovementService.getSteamMoves()).resolves.toEqual([]);
    });
  });

  it('propagates request failures', async () => {
    mockApi.get.mockRejectedValue(axiosError('Failed to fetch movements'));

    await expect(lineMovementService.getLiveMovements()).rejects.toThrow(
      'Failed to fetch movements'
    );
  });
});
