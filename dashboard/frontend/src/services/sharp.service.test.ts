/**
 * Tests for sharpService.
 *
 * getStats is the one method that synthesises a value rather than passing one
 * through: when the backend returns no data it builds an empty stats object
 * whose `period` string is derived from the requested window, so that branch
 * gets its own assertions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sharpService } from './sharp.service';
import {
  makeSharpIndicator,
  makeContrarianOpportunity,
  SHARP_STATS,
  successEnvelope,
  axiosError,
} from '../test/fixtures';

vi.mock('./api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import api from './api';
const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };

describe('sharpService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLiveIndicators', () => {
    it('defaults to a limit of 20 and unwraps the indicators', async () => {
      mockApi.get.mockResolvedValue(
        successEnvelope({ indicators: [makeSharpIndicator()], count: 1 })
      );

      const result = await sharpService.getLiveIndicators();

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/sharp/live', {
        params: { limit: 20 },
      });
      expect(result.count).toBe(1);
      // Reverse line movement against 72% public backing is the contrarian
      // signal the panel keys off; make sure it survives the unwrap.
      expect(result.indicators[0].lineMovement).toBe('reverse');
      expect(result.indicators[0].sharpSide).toBe('away');
      expect(result.indicators[0].publicSide).toBe('home');
      expect(result.indicators[0].publicBettingPct).toBe(72);
    });

    it('honours an explicit limit', async () => {
      mockApi.get.mockResolvedValue(successEnvelope({ indicators: [], count: 0 }));

      await sharpService.getLiveIndicators(5);

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/sharp/live', { params: { limit: 5 } });
    });

    it('falls back to an empty list when data is null', async () => {
      mockApi.get.mockResolvedValue({ data: { success: false, data: null } });

      const result = await sharpService.getLiveIndicators();

      expect(result).toEqual({ indicators: [], count: 0 });
    });
  });

  describe('getGameIndicators', () => {
    it('builds the per-game path and returns game plus indicators', async () => {
      const game = {
        id: 'game-lal-bos',
        matchup: 'Los Angeles Lakers @ Boston Celtics',
        sport: 'NBA Basketball',
        sportKey: 'basketball_nba',
        commenceTime: '2026-01-15T20:00:00.000Z',
        status: 'scheduled',
      };
      mockApi.get.mockResolvedValue(
        successEnvelope({ game, indicators: [makeSharpIndicator({ marketType: 'h2h' })] })
      );

      const result = await sharpService.getGameIndicators('game-lal-bos');

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/sharp/game/game-lal-bos');
      expect(result.game.matchup).toBe('Los Angeles Lakers @ Boston Celtics');
      expect(result.indicators[0].marketType).toBe('h2h');
    });

    it('returns a null game when the id has no indicators', async () => {
      mockApi.get.mockResolvedValue({ data: { success: true, data: null } });

      const result = await sharpService.getGameIndicators('unknown-game');

      expect(result).toEqual({ game: null, indicators: [] });
    });
  });

  describe('getContrarianOpportunities', () => {
    it('sends the default confidence floor and limit', async () => {
      mockApi.get.mockResolvedValue(
        successEnvelope({ opportunities: [makeContrarianOpportunity()], count: 1, minConfidence: 6 })
      );

      const result = await sharpService.getContrarianOpportunities();

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/sharp/contrarian', {
        params: { minConfidence: 6, limit: 20 },
      });
      expect(result.opportunities[0].maxConfidence).toBe(8);
      // maxConfidence should not undercut the strongest indicator attached.
      const strongest = Math.max(
        ...result.opportunities[0].indicators.map((i) => i.sharpConfidence)
      );
      expect(result.opportunities[0].maxConfidence).toBeGreaterThanOrEqual(strongest);
    });

    it('passes an explicit confidence floor and limit', async () => {
      mockApi.get.mockResolvedValue(
        successEnvelope({ opportunities: [], count: 0, minConfidence: 9 })
      );

      await sharpService.getContrarianOpportunities(9, 3);

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/sharp/contrarian', {
        params: { minConfidence: 9, limit: 3 },
      });
    });
  });

  describe('getStats', () => {
    it('returns the stats payload for the requested window', async () => {
      mockApi.get.mockResolvedValue(successEnvelope(SHARP_STATS));

      const stats = await sharpService.getStats(24);

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/sharp/stats', {
        params: { hoursBack: 24 },
      });
      expect(stats.totalIndicators).toBe(41);
      // The per-market breakdown accounts for every indicator counted.
      const marketTotal = Object.values(stats.byMarket).reduce((a, b) => a + b, 0);
      expect(marketTotal).toBe(stats.totalIndicators);
    });

    it('synthesises a zeroed stats object when the backend returns no data', async () => {
      mockApi.get.mockResolvedValue({ data: { success: false, data: null } });

      const stats = await sharpService.getStats(48);

      expect(stats).toEqual({
        byMarket: {},
        bySharpSide: {},
        byLineMovement: {},
        avgConfidence: 0,
        totalIndicators: 0,
        period: 'Last 48 hours',
      });
    });

    it('defaults the window to 24 hours in the synthesised fallback', async () => {
      mockApi.get.mockResolvedValue({ data: { success: false, data: null } });

      const stats = await sharpService.getStats();

      expect(stats.period).toBe('Last 24 hours');
    });
  });

  it('propagates request failures', async () => {
    mockApi.get.mockRejectedValue(axiosError('Failed to fetch sharp indicators'));

    await expect(sharpService.getLiveIndicators()).rejects.toThrow(
      'Failed to fetch sharp indicators'
    );
  });
});
