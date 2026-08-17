/**
 * Tests for sharpSlice.
 *
 * The slice is mostly transition bookkeeping, so the assertions focus on what
 * would actually break a screen: which field each thunk writes to, that the
 * three fetches do not clobber one another's slots, and that a rejection
 * surfaces the backend message rather than a generic one.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import {
  makeSharpIndicator,
  makeContrarianOpportunity,
  SHARP_STATS,
  axiosError,
} from '../test/fixtures';

vi.mock('../services/sharp.service', () => ({
  sharpService: {
    getLiveIndicators: vi.fn(),
    getGameIndicators: vi.fn(),
    getContrarianOpportunities: vi.fn(),
    getStats: vi.fn(),
  },
}));

import { sharpService } from '../services/sharp.service';
import reducer, {
  fetchLiveIndicators,
  fetchGameIndicators,
  fetchContrarianOpportunities,
  fetchSharpStats,
  clearGameIndicators,
  clearError,
  selectLiveIndicators,
  selectContrarianOpportunities,
  selectSharpStats,
} from './sharpSlice';

const mockService = sharpService as unknown as Record<string, ReturnType<typeof vi.fn>>;

function makeStore() {
  return configureStore({ reducer: { sharp: reducer } });
}

describe('sharpSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with empty collections and no selection', () => {
    const state = reducer(undefined, { type: '@@INIT' });

    expect(state.liveIndicators).toEqual([]);
    expect(state.contrarianOpportunities).toEqual([]);
    expect(state.selectedGameIndicators).toBeNull();
    expect(state.selectedGame).toBeNull();
    expect(state.stats).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.lastFetched).toBeNull();
  });

  describe('fetchLiveIndicators', () => {
    it('passes the limit through and stores the indicators', async () => {
      mockService.getLiveIndicators.mockResolvedValue({
        indicators: [makeSharpIndicator({ id: 'sharp-a' }), makeSharpIndicator({ id: 'sharp-b' })],
        count: 2,
      });
      const store = makeStore();

      await store.dispatch(fetchLiveIndicators(10));

      expect(mockService.getLiveIndicators).toHaveBeenCalledWith(10);
      expect(selectLiveIndicators(store.getState() as never).map((i) => i.id)).toEqual([
        'sharp-a',
        'sharp-b',
      ]);
      expect(store.getState().sharp.loading).toBe(false);
      expect(store.getState().sharp.lastFetched).not.toBeNull();
    });

    it('marks loading and clears the previous error while in flight', () => {
      const errored = reducer(undefined, {
        type: fetchLiveIndicators.rejected.type,
        payload: 'earlier failure',
      });
      const state = reducer(errored, { type: fetchLiveIndicators.pending.type });

      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('surfaces the backend error message', async () => {
      mockService.getLiveIndicators.mockRejectedValue(axiosError('Sharp feed unavailable'));
      const store = makeStore();

      await store.dispatch(fetchLiveIndicators());

      expect(store.getState().sharp.error).toBe('Sharp feed unavailable');
      expect(store.getState().sharp.loading).toBe(false);
    });

    it('uses the generic message when the failure has no response body', async () => {
      mockService.getLiveIndicators.mockRejectedValue(new Error('Network Error'));
      const store = makeStore();

      await store.dispatch(fetchLiveIndicators());

      expect(store.getState().sharp.error).toBe('Failed to fetch sharp indicators');
    });
  });

  describe('fetchGameIndicators', () => {
    it('stores the selected game and its indicators without touching the live list', async () => {
      mockService.getLiveIndicators.mockResolvedValue({
        indicators: [makeSharpIndicator({ id: 'live-1' })],
        count: 1,
      });
      mockService.getGameIndicators.mockResolvedValue({
        game: { id: 'game-lal-bos', matchup: 'Lakers @ Celtics' },
        indicators: [makeSharpIndicator({ id: 'game-1', marketType: 'totals' })],
      });
      const store = makeStore();

      await store.dispatch(fetchLiveIndicators());
      await store.dispatch(fetchGameIndicators('game-lal-bos'));

      const state = store.getState().sharp;
      expect(mockService.getGameIndicators).toHaveBeenCalledWith('game-lal-bos');
      expect(state.selectedGame.matchup).toBe('Lakers @ Celtics');
      expect(state.selectedGameIndicators?.map((i) => i.id)).toEqual(['game-1']);
      expect(state.liveIndicators.map((i) => i.id)).toEqual(['live-1']);
    });

    it('drops the selection on clearGameIndicators', async () => {
      mockService.getGameIndicators.mockResolvedValue({
        game: { id: 'game-lal-bos' },
        indicators: [makeSharpIndicator()],
      });
      const store = makeStore();

      await store.dispatch(fetchGameIndicators('game-lal-bos'));
      store.dispatch(clearGameIndicators());

      const state = store.getState().sharp;
      expect(state.selectedGameIndicators).toBeNull();
      expect(state.selectedGame).toBeNull();
    });
  });

  describe('fetchContrarianOpportunities', () => {
    it('forwards the confidence floor and limit', async () => {
      mockService.getContrarianOpportunities.mockResolvedValue({
        opportunities: [makeContrarianOpportunity()],
        count: 1,
      });
      const store = makeStore();

      await store.dispatch(fetchContrarianOpportunities({ minConfidence: 8, limit: 5 }));

      expect(mockService.getContrarianOpportunities).toHaveBeenCalledWith(8, 5);
      const opportunities = selectContrarianOpportunities(store.getState() as never);
      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].maxConfidence).toBe(8);
    });

    it('applies the slice defaults when called with an empty argument', async () => {
      mockService.getContrarianOpportunities.mockResolvedValue({ opportunities: [], count: 0 });
      const store = makeStore();

      await store.dispatch(fetchContrarianOpportunities({}));

      expect(mockService.getContrarianOpportunities).toHaveBeenCalledWith(6, 20);
    });

    it('records the error on failure', async () => {
      mockService.getContrarianOpportunities.mockRejectedValue(axiosError('No contrarian data'));
      const store = makeStore();

      await store.dispatch(fetchContrarianOpportunities({}));

      expect(store.getState().sharp.error).toBe('No contrarian data');
    });
  });

  describe('fetchSharpStats', () => {
    it('stores the stats payload for the requested window', async () => {
      mockService.getStats.mockResolvedValue(SHARP_STATS);
      const store = makeStore();

      await store.dispatch(fetchSharpStats(48));

      expect(mockService.getStats).toHaveBeenCalledWith(48);
      expect(selectSharpStats(store.getState() as never)?.totalIndicators).toBe(41);
      expect(store.getState().sharp.loading).toBe(false);
    });

    it('defaults to a 24-hour window', async () => {
      mockService.getStats.mockResolvedValue(SHARP_STATS);
      const store = makeStore();

      await store.dispatch(fetchSharpStats());

      expect(mockService.getStats).toHaveBeenCalledWith(24);
    });
  });

  it('clears the error on clearError', () => {
    const errored = reducer(undefined, {
      type: fetchSharpStats.rejected.type,
      payload: 'boom',
    });
    expect(errored.error).toBe('boom');

    expect(reducer(errored, clearError()).error).toBeNull();
  });
});
