/**
 * Tests for bookmakerSlice.
 *
 * This slice keeps three independent loading flags — `loading` for the
 * rankings table, `detailLoading` for the drawer, `outlierLoading` for the
 * outlier panel — so a drawer fetch must not put the table into a spinner.
 * That separation is the main thing under test here.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import {
  makeBookmakerAnalytics,
  BOOKMAKER_OUTLIER_STATS,
  axiosError,
} from '../test/fixtures';

vi.mock('../services/bookmaker.service', () => ({
  bookmakerService: {
    getRankings: vi.fn(),
    getBookmakerDetail: vi.fn(),
    getBookmakerOutlierStats: vi.fn(),
  },
}));

import { bookmakerService } from '../services/bookmaker.service';
import reducer, {
  fetchRankings,
  fetchBookmakerDetail,
  fetchOutlierStats,
  clearSelectedBookmaker,
  clearError,
  selectRankings,
  selectRankingCriteria,
  selectSelectedBookmaker,
  selectOutlierStats,
} from './bookmakerSlice';

const mockService = bookmakerService as unknown as Record<string, ReturnType<typeof vi.fn>>;

function makeStore() {
  return configureStore({ reducer: { bookmaker: reducer } });
}

describe('bookmakerSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with no rankings and the recommendation criteria', () => {
    const state = reducer(undefined, { type: '@@INIT' });

    expect(state.rankings).toEqual([]);
    expect(state.rankingCriteria).toBe('recommendation');
    expect(state.selectedBookmaker).toBeNull();
    expect(state.outlierStats).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.detailLoading).toBe(false);
    expect(state.outlierLoading).toBe(false);
  });

  describe('fetchRankings', () => {
    it('stores the rankings and adopts the criteria the server echoed back', async () => {
      mockService.getRankings.mockResolvedValue({
        rankings: [
          makeBookmakerAnalytics({ bookmaker: 'pinnacle', sharpBookRating: 9.4 }),
          makeBookmakerAnalytics({ bookmaker: 'circa', sharpBookRating: 9.1 }),
        ],
        criteria: 'sharpness',
        count: 2,
      });
      const store = makeStore();

      await store.dispatch(fetchRankings('sharpness'));

      expect(mockService.getRankings).toHaveBeenCalledWith('sharpness');
      const rankings = selectRankings(store.getState() as never);
      expect(rankings.map((b) => b.bookmaker)).toEqual(['pinnacle', 'circa']);
      // Order comes from the server; the slice must not re-sort it.
      expect(rankings[0].sharpBookRating).toBeGreaterThan(rankings[1].sharpBookRating);
      expect(selectRankingCriteria(store.getState() as never)).toBe('sharpness');
      expect(store.getState().bookmaker.loading).toBe(false);
    });

    it('sets only the rankings loading flag while in flight', () => {
      const state = reducer(undefined, { type: fetchRankings.pending.type });

      expect(state.loading).toBe(true);
      expect(state.detailLoading).toBe(false);
      expect(state.outlierLoading).toBe(false);
    });

    it('surfaces the backend error message', async () => {
      mockService.getRankings.mockRejectedValue(axiosError('Rankings not yet calculated'));
      const store = makeStore();

      await store.dispatch(fetchRankings());

      expect(store.getState().bookmaker.error).toBe('Rankings not yet calculated');
      expect(store.getState().bookmaker.loading).toBe(false);
    });

    it('falls back to a generic message when there is no response body', async () => {
      mockService.getRankings.mockRejectedValue(new Error('Network Error'));
      const store = makeStore();

      await store.dispatch(fetchRankings());

      expect(store.getState().bookmaker.error).toBe('Failed to fetch bookmaker rankings');
    });
  });

  describe('fetchBookmakerDetail', () => {
    it('stores the selected bookmaker without disturbing the rankings table', async () => {
      mockService.getRankings.mockResolvedValue({
        rankings: [makeBookmakerAnalytics({ bookmaker: 'pinnacle' })],
        criteria: 'recommendation',
        count: 1,
      });
      mockService.getBookmakerDetail.mockResolvedValue(
        makeBookmakerAnalytics({ bookmaker: 'fanduel', limitProfile: 'low', estimatedMaxBet: 500 })
      );
      const store = makeStore();

      await store.dispatch(fetchRankings());
      await store.dispatch(fetchBookmakerDetail('fanduel'));

      const state = store.getState().bookmaker;
      expect(selectSelectedBookmaker(store.getState() as never)?.bookmaker).toBe('fanduel');
      expect(state.selectedBookmaker?.estimatedMaxBet).toBe(500);
      expect(state.rankings.map((b) => b.bookmaker)).toEqual(['pinnacle']);
      expect(state.detailLoading).toBe(false);
      expect(state.loading).toBe(false);
    });

    it('uses detailLoading, leaving the table flag alone', () => {
      const state = reducer(undefined, { type: fetchBookmakerDetail.pending.type });

      expect(state.detailLoading).toBe(true);
      expect(state.loading).toBe(false);
    });

    it('stores null for an unknown bookmaker', async () => {
      mockService.getBookmakerDetail.mockResolvedValue(null);
      const store = makeStore();

      await store.dispatch(fetchBookmakerDetail('nosuchbook'));

      expect(store.getState().bookmaker.selectedBookmaker).toBeNull();
      expect(store.getState().bookmaker.detailLoading).toBe(false);
    });
  });

  describe('fetchOutlierStats', () => {
    it('forwards the bookmaker and window, then stores the stats', async () => {
      mockService.getBookmakerOutlierStats.mockResolvedValue(BOOKMAKER_OUTLIER_STATS);
      const store = makeStore();

      await store.dispatch(fetchOutlierStats({ bookmaker: 'pinnacle', days: 7 }));

      expect(mockService.getBookmakerOutlierStats).toHaveBeenCalledWith('pinnacle', 7);
      expect(selectOutlierStats(store.getState() as never)?.outlierCount).toBe(75);
      expect(store.getState().bookmaker.outlierLoading).toBe(false);
    });

    it('defaults the window to 30 days', async () => {
      mockService.getBookmakerOutlierStats.mockResolvedValue(BOOKMAKER_OUTLIER_STATS);
      const store = makeStore();

      await store.dispatch(fetchOutlierStats({ bookmaker: 'pinnacle' }));

      expect(mockService.getBookmakerOutlierStats).toHaveBeenCalledWith('pinnacle', 30);
    });

    it('clears the outlier spinner and records the error on failure', async () => {
      mockService.getBookmakerOutlierStats.mockRejectedValue(axiosError('Outlier job has not run'));
      const store = makeStore();

      await store.dispatch(fetchOutlierStats({ bookmaker: 'pinnacle' }));

      const state = store.getState().bookmaker;
      expect(state.outlierLoading).toBe(false);
      expect(state.error).toBe('Outlier job has not run');
    });
  });

  it('clears both the selection and its outlier stats together', async () => {
    mockService.getBookmakerDetail.mockResolvedValue(makeBookmakerAnalytics());
    mockService.getBookmakerOutlierStats.mockResolvedValue(BOOKMAKER_OUTLIER_STATS);
    const store = makeStore();

    await store.dispatch(fetchBookmakerDetail('pinnacle'));
    await store.dispatch(fetchOutlierStats({ bookmaker: 'pinnacle' }));
    store.dispatch(clearSelectedBookmaker());

    const state = store.getState().bookmaker;
    expect(state.selectedBookmaker).toBeNull();
    expect(state.outlierStats).toBeNull();
  });

  it('clears the error on clearError', () => {
    const errored = reducer(undefined, { type: fetchRankings.rejected.type, payload: 'boom' });
    expect(errored.error).toBe('boom');

    expect(reducer(errored, clearError()).error).toBeNull();
  });
});
