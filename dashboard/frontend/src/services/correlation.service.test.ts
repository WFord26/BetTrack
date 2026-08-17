/**
 * Tests for correlationService.
 *
 * The parlay endpoint is overloaded — the same POST takes either a saved
 * `betId` or an array of draft `legs` — so the two callers must send
 * distinguishable bodies. The rest is envelope unwrapping with `?? null`
 * fallbacks that fire on error responses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { correlationService } from './correlation.service';
import { successEnvelope, axiosError } from '../test/fixtures';
import type { Correlation, DraftLegInput, ParlayAnalysis } from '../types/correlation.types';

vi.mock('./api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import api from './api';
const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

const SAME_GAME_CORRELATION: Correlation = {
  type: 'same-game',
  score: 0.85,
  confidence: 0.75,
  reasoning: 'A team covering the spread implies a higher-scoring game',
  factors: ['team_performance', 'scoring_pace'],
};

/**
 * A correlated two-leg parlay: the books price it at +264 but, once the
 * spread/total correlation is priced in, the fair number is +180 — so the
 * discrepancy is negative and the slip is worse than it looks.
 */
const PARLAY_ANALYSIS: ParlayAnalysis = {
  betLegIds: ['leg-1', 'leg-2'],
  betId: 'bet-1',
  nominalOdds: 264,
  trueOdds: 180,
  oddsDiscrepancy: -84,
  riskLevel: 'high',
  correlationFlags: [
    { betLeg1Id: 'leg-1', betLeg2Id: 'leg-2', type: 'same-game', score: 0.85 },
  ],
  recommendation: 'warning',
  reasoning: 'Spread and total on the same game are positively correlated',
  suggestedFix: 'Drop one leg or place them as separate bets',
};

describe('correlationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzePair', () => {
    it('posts both leg ids and returns the correlation', async () => {
      mockApi.post.mockResolvedValue(
        successEnvelope({ correlated: true, correlation: SAME_GAME_CORRELATION })
      );

      const correlation = await correlationService.analyzePair('leg-1', 'leg-2');

      expect(mockApi.post).toHaveBeenCalledWith('/analytics/correlation/analyze', {
        betLeg1Id: 'leg-1',
        betLeg2Id: 'leg-2',
      });
      expect(correlation?.type).toBe('same-game');
      expect(correlation?.score).toBe(0.85);
    });

    it('returns null when the legs are uncorrelated', async () => {
      mockApi.post.mockResolvedValue(successEnvelope({ correlated: false, correlation: null }));

      await expect(correlationService.analyzePair('leg-1', 'leg-3')).resolves.toBeNull();
    });
  });

  describe('analyzeBet', () => {
    it('posts the bet id and returns the analysis', async () => {
      mockApi.post.mockResolvedValue(successEnvelope(PARLAY_ANALYSIS));

      const analysis = await correlationService.analyzeBet('bet-1');

      expect(mockApi.post).toHaveBeenCalledWith('/analytics/correlation/parlay', {
        betId: 'bet-1',
      });
      expect(analysis?.riskLevel).toBe('high');
      // A positive correlation makes the fair price shorter than the
      // advertised one, so the discrepancy runs against the bettor.
      expect(analysis!.trueOdds).toBeLessThan(analysis!.nominalOdds);
      expect(analysis!.oddsDiscrepancy).toBe(analysis!.trueOdds - analysis!.nominalOdds);
    });

    it('returns null when the bet cannot be analysed', async () => {
      mockApi.post.mockResolvedValue({ data: { success: false } });

      await expect(correlationService.analyzeBet('bet-missing')).resolves.toBeNull();
    });
  });

  describe('analyzeDraftSlip', () => {
    it('posts legs rather than a betId, preserving each leg field', async () => {
      const legs: DraftLegInput[] = [
        {
          gameId: 'game-lal-bos',
          selectionType: 'spread',
          selection: 'home',
          teamName: 'Boston Celtics',
          line: -3.5,
          odds: -110,
          sgpGroupId: 'draft-game-lal-bos',
        },
        {
          gameId: 'game-lal-bos',
          selectionType: 'total',
          selection: 'over',
          line: 224.5,
          odds: -105,
          sgpGroupId: 'draft-game-lal-bos',
        },
      ];
      mockApi.post.mockResolvedValue(successEnvelope({ ...PARLAY_ANALYSIS, betId: null }));

      const analysis = await correlationService.analyzeDraftSlip(legs);

      expect(mockApi.post).toHaveBeenCalledWith('/analytics/correlation/parlay', { legs });
      const [, body] = mockApi.post.mock.calls[0];
      expect('betId' in body).toBe(false);
      expect(body.legs[0].sgpGroupId).toBe(body.legs[1].sgpGroupId);
      expect(analysis?.betId).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('forwards filter params', async () => {
      mockApi.get.mockResolvedValue(successEnvelope({ analyses: [PARLAY_ANALYSIS], count: 1 }));

      const result = await correlationService.getHistory({ limit: 5, riskLevel: 'high', mine: true });

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/correlation/history', {
        params: { limit: 5, riskLevel: 'high', mine: true },
      });
      expect(result.count).toBe(1);
      expect(result.analyses[0].correlationFlags).toHaveLength(1);
    });

    it('defaults to an empty filter object and empty results', async () => {
      mockApi.get.mockResolvedValue({ data: { success: false } });

      const result = await correlationService.getHistory();

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/correlation/history', { params: {} });
      expect(result).toEqual({ analyses: [], count: 0 });
    });
  });

  describe('findHedges', () => {
    it('returns the hedge options for a leg', async () => {
      const hedge = {
        gameId: 'game-lal-bos',
        bookmaker: 'fanduel',
        selection: 'home' as const,
        odds: -130,
        hedgeStake: 585.58,
        guaranteedProfit: 36.03,
        guaranteedProfitPct: 3.6,
      };
      mockApi.post.mockResolvedValue(successEnvelope({ opportunities: [hedge], count: 1 }));

      const hedges = await correlationService.findHedges('leg-1');

      expect(mockApi.post).toHaveBeenCalledWith('/analytics/correlation/hedge', {
        betLegId: 'leg-1',
      });
      expect(hedges).toHaveLength(1);
      expect(hedges[0].guaranteedProfit).toBeGreaterThan(0);
    });

    it('returns an empty array when no hedge exists', async () => {
      mockApi.post.mockResolvedValue({ data: { success: false } });

      await expect(correlationService.findHedges('leg-1')).resolves.toEqual([]);
    });
  });

  describe('getEducation', () => {
    it('returns the static education content', async () => {
      const content = {
        correlationTypes: [
          {
            type: 'same-game' as const,
            label: 'Same game',
            summary: 'Outcomes in one game move together',
            example: 'Spread + total on the same game',
          },
        ],
        glossary: [{ term: 'True odds', definition: 'Price after correlation is accounted for' }],
        warningLevels: [{ level: 'high', threshold: '|score| > 0.7', icon: '🔴' }],
      };
      mockApi.get.mockResolvedValue(successEnvelope(content));

      const result = await correlationService.getEducation();

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/correlation/education');
      expect(result?.correlationTypes[0].type).toBe('same-game');
      expect(result?.glossary).toHaveLength(1);
    });

    it('returns null when content is unavailable', async () => {
      mockApi.get.mockResolvedValue({ data: { success: false } });

      await expect(correlationService.getEducation()).resolves.toBeNull();
    });
  });

  it('propagates request failures', async () => {
    mockApi.post.mockRejectedValue(axiosError('Failed to analyze parlay'));

    await expect(correlationService.analyzeBet('bet-1')).rejects.toThrow('Failed to analyze parlay');
  });
});
