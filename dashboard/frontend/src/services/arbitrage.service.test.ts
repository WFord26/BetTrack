/**
 * Tests for arbitrageService.
 *
 * The service is a thin layer over axios, but it owns two things worth
 * pinning down: the exact request it issues (path + params, which the backend
 * routes parse) and how it unwraps the `{ success, data }` envelope, including
 * the `|| []` / `|| null` fallbacks that fire when the backend returns an error
 * body with no `data`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { arbitrageService } from './arbitrage.service';
import {
  makeArbitrageOpportunity,
  ARBITRAGE_STATS,
  STAKE_PLAN,
  successEnvelope,
  axiosError,
} from '../test/fixtures';

vi.mock('./api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import api from './api';
const mockApi = api as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

describe('arbitrageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLive', () => {
    it('requests /analytics/arbitrage/live and unwraps the payload', async () => {
      const opportunity = makeArbitrageOpportunity();
      mockApi.get.mockResolvedValue(
        successEnvelope({ opportunities: [opportunity], count: 1, retrievedAt: '2026-01-15T18:00:00.000Z' })
      );

      const result = await arbitrageService.getLive();

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/arbitrage/live', { params: {} });
      expect(result.opportunities).toHaveLength(1);
      expect(result.opportunities[0].id).toBe('arb-1');
      expect(result.opportunities[0].legs[0].bookmaker).toBe('draftkings');
      expect(result.count).toBe(1);
      expect(result.retrievedAt).toBe('2026-01-15T18:00:00.000Z');
    });

    it('forwards the query filters the backend route parses', async () => {
      mockApi.get.mockResolvedValue(
        successEnvelope({ opportunities: [], count: 0, retrievedAt: null })
      );

      await arbitrageService.getLive({
        limit: 10,
        minProfit: 2.5,
        arbType: 'middle',
        marketType: 'totals',
        maxSnapshotAge: 300,
      });

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/arbitrage/live', {
        params: {
          limit: 10,
          minProfit: 2.5,
          arbType: 'middle',
          marketType: 'totals',
          maxSnapshotAge: 300,
        },
      });
    });

    it('falls back to empty results when the response carries no data', async () => {
      mockApi.get.mockResolvedValue({ data: { success: false } });

      const result = await arbitrageService.getLive();

      expect(result.opportunities).toEqual([]);
      expect(result.count).toBe(0);
      expect(result.retrievedAt).toBeNull();
    });

    it('propagates transport errors to the caller', async () => {
      mockApi.get.mockRejectedValue(axiosError('Failed to fetch arbitrage opportunities'));

      await expect(arbitrageService.getLive()).rejects.toThrow(
        'Failed to fetch arbitrage opportunities'
      );
    });
  });

  describe('getHistory', () => {
    it('unwraps opportunities, count and the period label', async () => {
      mockApi.get.mockResolvedValue(
        successEnvelope({
          opportunities: [makeArbitrageOpportunity({ id: 'arb-old', status: 'expired' })],
          count: 1,
          period: 'Last 7 days',
        })
      );

      const result = await arbitrageService.getHistory({ daysBack: 7, status: 'expired' });

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/arbitrage/history', {
        params: { daysBack: 7, status: 'expired' },
      });
      expect(result.opportunities[0].status).toBe('expired');
      expect(result.period).toBe('Last 7 days');
    });

    it('returns an empty period string when the backend omits data', async () => {
      mockApi.get.mockResolvedValue({ data: { success: false } });

      const result = await arbitrageService.getHistory();

      expect(result).toEqual({ opportunities: [], count: 0, period: '' });
    });
  });

  describe('getStats', () => {
    it('sends the default 30-day window and returns the stats object', async () => {
      mockApi.get.mockResolvedValue(successEnvelope(ARBITRAGE_STATS));

      const stats = await arbitrageService.getStats();

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/arbitrage/stats', {
        params: { daysBack: 30, mine: false },
      });
      expect(stats?.totalDetected).toBe(128);
      expect(stats?.taken.count).toBe(9);
    });

    it('honours an explicit window and the mine flag', async () => {
      mockApi.get.mockResolvedValue(successEnvelope(ARBITRAGE_STATS));

      await arbitrageService.getStats(7, true);

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/arbitrage/stats', {
        params: { daysBack: 7, mine: true },
      });
    });

    it('returns null when the backend has no stats to report', async () => {
      mockApi.get.mockResolvedValue({ data: { success: true } });

      await expect(arbitrageService.getStats()).resolves.toBeNull();
    });
  });

  describe('getById', () => {
    it('builds the detail path from the id', async () => {
      mockApi.get.mockResolvedValue(successEnvelope(makeArbitrageOpportunity({ id: 'arb-42' })));

      const opportunity = await arbitrageService.getById('arb-42');

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/arbitrage/arb-42');
      expect(opportunity?.id).toBe('arb-42');
    });

    it('returns null for an unknown id', async () => {
      mockApi.get.mockResolvedValue({ data: { success: true } });

      await expect(arbitrageService.getById('missing')).resolves.toBeNull();
    });
  });

  describe('markTaken', () => {
    it('posts an empty body when no actual profit is supplied', async () => {
      mockApi.post.mockResolvedValue(
        successEnvelope(makeArbitrageOpportunity({ status: 'taken', takenAt: '2026-01-15T18:05:00.000Z' }))
      );

      const result = await arbitrageService.markTaken('arb-1');

      expect(mockApi.post).toHaveBeenCalledWith('/analytics/arbitrage/arb-1/take', {});
      expect(result?.status).toBe('taken');
    });

    it('includes actualProfit when supplied, including zero', async () => {
      mockApi.post.mockResolvedValue(successEnvelope(makeArbitrageOpportunity({ actualProfit: '0' })));

      await arbitrageService.markTaken('arb-1', 0);

      expect(mockApi.post).toHaveBeenCalledWith('/analytics/arbitrage/arb-1/take', {
        actualProfit: 0,
      });
    });
  });

  describe('calculate', () => {
    it('posts the odds array and total stake, returning the stake plan', async () => {
      mockApi.post.mockResolvedValue(successEnvelope(STAKE_PLAN));

      const plan = await arbitrageService.calculate([150, -130], 1000);

      expect(mockApi.post).toHaveBeenCalledWith('/analytics/arbitrage/calculator', {
        odds: [150, -130],
        totalStake: 1000,
      });
      // The plan is a real arbitrage: stakes split the bankroll and both
      // payouts clear the total stake.
      expect(plan?.isArbitrage).toBe(true);
      expect(plan!.stakes.reduce((a, b) => a + b, 0)).toBeCloseTo(1000, 2);
      expect(Math.min(...plan!.payouts)).toBeGreaterThan(plan!.totalStake);
      expect(plan?.totalImpliedProbability).toBeLessThan(1);
    });

    it('returns null when the calculator rejects the input', async () => {
      mockApi.post.mockResolvedValue({ data: { success: false } });

      await expect(arbitrageService.calculate([100], 1000)).resolves.toBeNull();
    });
  });
});
