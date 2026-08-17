/**
 * Tests for bookmakerService.
 *
 * The interesting behaviour here is URL encoding: bookmaker keys come from the
 * odds feed and are used as path segments, so a key containing a space or a
 * slash must not break the route.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bookmakerService } from './bookmaker.service';
import {
  makeBookmakerAnalytics,
  BOOKMAKER_OUTLIER_STATS,
  successEnvelope,
  axiosError,
} from '../test/fixtures';

vi.mock('./api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import api from './api';
const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };

describe('bookmakerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRankings', () => {
    it('defaults to the recommendation criteria', async () => {
      mockApi.get.mockResolvedValue(
        successEnvelope({
          rankings: [makeBookmakerAnalytics()],
          criteria: 'recommendation',
          count: 1,
        })
      );

      const result = await bookmakerService.getRankings();

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/bookmakers/rankings', {
        params: { criteria: 'recommendation' },
      });
      expect(result.rankings[0].bookmaker).toBe('pinnacle');
      expect(result.rankings[0].sharpBookRating).toBe(9.4);
      expect(result.count).toBe(1);
    });

    it('passes an explicit criteria through', async () => {
      mockApi.get.mockResolvedValue(
        successEnvelope({ rankings: [], criteria: 'sharpness', count: 0 })
      );

      const result = await bookmakerService.getRankings('sharpness');

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/bookmakers/rankings', {
        params: { criteria: 'sharpness' },
      });
      expect(result.criteria).toBe('sharpness');
    });

    it('echoes the requested criteria back when the response omits data', async () => {
      mockApi.get.mockResolvedValue({ data: { success: false } });

      const result = await bookmakerService.getRankings('limits');

      expect(result).toEqual({ rankings: [], criteria: 'limits', count: 0 });
    });
  });

  describe('getBookmakerDetail', () => {
    it('returns the analytics record for a bookmaker', async () => {
      mockApi.get.mockResolvedValue(successEnvelope(makeBookmakerAnalytics()));

      const detail = await bookmakerService.getBookmakerDetail('pinnacle');

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/bookmakers/pinnacle');
      expect(detail?.limitProfile).toBe('high');
      expect(detail?.recommendationScore).toBe(91);
    });

    it('percent-encodes bookmaker keys that are not URL-safe', async () => {
      mockApi.get.mockResolvedValue(successEnvelope(makeBookmakerAnalytics({ bookmaker: 'bet/365 uk' })));

      await bookmakerService.getBookmakerDetail('bet/365 uk');

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/bookmakers/bet%2F365%20uk');
    });

    it('returns null for an unknown bookmaker', async () => {
      mockApi.get.mockResolvedValue({ data: { success: true, data: null } });

      await expect(bookmakerService.getBookmakerDetail('nosuchbook')).resolves.toBeNull();
    });

    it('preserves a null recommendationScore instead of coercing it', async () => {
      mockApi.get.mockResolvedValue(
        successEnvelope(makeBookmakerAnalytics({ recommendationScore: null, uptimePercentage: null }))
      );

      const detail = await bookmakerService.getBookmakerDetail('newbook');

      expect(detail?.recommendationScore).toBeNull();
      expect(detail?.uptimePercentage).toBeNull();
    });
  });

  describe('getBookmakerOutlierStats', () => {
    it('defaults to a 30-day window', async () => {
      mockApi.get.mockResolvedValue(successEnvelope(BOOKMAKER_OUTLIER_STATS));

      const stats = await bookmakerService.getBookmakerOutlierStats('pinnacle');

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/bookmakers/pinnacle/outliers', {
        params: { days: 30 },
      });
      // outlierRate is the reported percentage of outlierCount within totalRecords.
      expect(stats!.outlierRate).toBeCloseTo(
        (stats!.outlierCount / stats!.totalRecords) * 100,
        1
      );
    });

    it('honours a custom window and encodes the bookmaker key', async () => {
      mockApi.get.mockResolvedValue(successEnvelope(BOOKMAKER_OUTLIER_STATS));

      await bookmakerService.getBookmakerOutlierStats('bet/365', 7);

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/bookmakers/bet%2F365/outliers', {
        params: { days: 7 },
      });
    });

    it('returns null when no outlier data exists', async () => {
      mockApi.get.mockResolvedValue({ data: { success: true, data: null } });

      await expect(bookmakerService.getBookmakerOutlierStats('pinnacle')).resolves.toBeNull();
    });
  });

  it('propagates request failures', async () => {
    mockApi.get.mockRejectedValue(axiosError('Failed to fetch bookmaker rankings'));

    await expect(bookmakerService.getRankings()).rejects.toThrow(
      'Failed to fetch bookmaker rankings'
    );
  });
});
