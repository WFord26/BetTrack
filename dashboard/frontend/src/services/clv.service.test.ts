/**
 * Tests for clvService.
 *
 * Unlike the other analytics services, clvService returns `response.data.data`
 * with no fallback, so these tests pin the request shape (paths and the filter
 * params the backend route reads) and verify the payload is handed back intact.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clvService } from './clv.service';
import {
  CLV_SUMMARY,
  CLV_BY_SPORT,
  CLV_BY_BOOKMAKER,
  CLV_TRENDS,
  successEnvelope,
  axiosError,
} from '../test/fixtures';

vi.mock('./api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import apiClient from './api';
const mockApi = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe('clvService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getSummary returns the summary payload', async () => {
    mockApi.get.mockResolvedValue(successEnvelope(CLV_SUMMARY));

    const summary = await clvService.getSummary();

    expect(mockApi.get).toHaveBeenCalledWith('/analytics/clv/summary');
    expect(summary.totalBets).toBe(140);
    // The three CLV buckets are a partition of the bet population.
    expect(
      summary.positiveCLVCount + summary.negativeCLVCount + summary.neutralCLVCount
    ).toBe(summary.totalBets);
  });

  it('getBySport returns one row per sport', async () => {
    mockApi.get.mockResolvedValue(successEnvelope(CLV_BY_SPORT));

    const bySport = await clvService.getBySport();

    expect(mockApi.get).toHaveBeenCalledWith('/analytics/clv/by-sport');
    expect(bySport.map((row) => row.sport)).toEqual(['basketball_nba', 'americanfootball_nfl']);
    expect(bySport[0].averageCLV).toBe(2.4);
  });

  it('getByBookmaker returns one row per bookmaker', async () => {
    mockApi.get.mockResolvedValue(successEnvelope(CLV_BY_BOOKMAKER));

    const byBookmaker = await clvService.getByBookmaker();

    expect(mockApi.get).toHaveBeenCalledWith('/analytics/clv/by-bookmaker');
    expect(byBookmaker.map((row) => row.bookmaker)).toEqual(['draftkings', 'fanduel']);
  });

  it('getTrends passes filters through as query params', async () => {
    mockApi.get.mockResolvedValue(successEnvelope(CLV_TRENDS));

    const trends = await clvService.getTrends({ sportKey: 'basketball_nba', period: 'month' });

    expect(mockApi.get).toHaveBeenCalledWith('/analytics/clv/trends', {
      params: { sportKey: 'basketball_nba', period: 'month' },
    });
    expect(trends).toHaveLength(3);
    // A negative day survives the round trip — sign is meaningful for CLV.
    expect(trends[2].averageCLV).toBe(-0.6);
  });

  it('getTrends sends undefined params when called without filters', async () => {
    mockApi.get.mockResolvedValue(successEnvelope(CLV_TRENDS));

    await clvService.getTrends();

    expect(mockApi.get).toHaveBeenCalledWith('/analytics/clv/trends', { params: undefined });
  });

  it('getReport returns the composed report', async () => {
    const report = {
      summary: CLV_SUMMARY,
      bySport: CLV_BY_SPORT,
      byBookmaker: CLV_BY_BOOKMAKER,
      trends: CLV_TRENDS,
      topBets: [],
      worstBets: [],
    };
    mockApi.get.mockResolvedValue(successEnvelope(report));

    const result = await clvService.getReport({ period: 'season' });

    expect(mockApi.get).toHaveBeenCalledWith('/analytics/clv/report', {
      params: { period: 'season' },
    });
    expect(result.summary.averageCLV).toBe(1.85);
    expect(result.bySport).toHaveLength(2);
  });

  it('calculateForBet posts to the per-bet path', async () => {
    mockApi.post.mockResolvedValue(successEnvelope({ clv: 2.7, category: 'positive' }));

    const result = await clvService.calculateForBet('bet-123');

    expect(mockApi.post).toHaveBeenCalledWith('/analytics/clv/calculate/bet-123');
    expect(result).toEqual({ clv: 2.7, category: 'positive' });
  });

  it('updateStats posts to the update-stats path', async () => {
    mockApi.post.mockResolvedValue(successEnvelope({ message: 'CLV stats updated' }));

    const result = await clvService.updateStats();

    expect(mockApi.post).toHaveBeenCalledWith('/analytics/clv/update-stats');
    expect(result.message).toBe('CLV stats updated');
  });

  it('propagates request failures rather than swallowing them', async () => {
    mockApi.get.mockRejectedValue(axiosError('Failed to fetch CLV summary'));

    await expect(clvService.getSummary()).rejects.toThrow('Failed to fetch CLV summary');
  });
});
