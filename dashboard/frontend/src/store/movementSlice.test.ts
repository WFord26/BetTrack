/**
 * Tests for movementSlice.
 *
 * `fetchLiveMovements` destructures its argument with defaults, so calling it
 * with a partial filter object has to fill the gaps rather than send
 * `undefined` down to the service — that is what the filter UI relies on.
 * The rest covers which slot each thunk writes and the filter reducer's merge.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { makeLineMovement, MOVEMENT_STATS, axiosError } from '../test/fixtures';

vi.mock('../services/line-movement.service', () => ({
  lineMovementService: {
    getLiveMovements: vi.fn(),
    getGameMovements: vi.fn(),
    getMovementStats: vi.fn(),
    getSteamMoves: vi.fn(),
  },
}));

import { lineMovementService } from '../services/line-movement.service';
import reducer, {
  fetchLiveMovements,
  fetchGameMovements,
  fetchMovementStats,
  fetchSteamMoves,
  setFilters,
  clearGameMovements,
  clearError,
  selectLiveMovements,
  selectSteamMoves,
  selectMovementStats,
  selectSteamMovesCount,
} from './movementSlice';

const mockService = lineMovementService as unknown as Record<string, ReturnType<typeof vi.fn>>;

function makeStore() {
  return configureStore({ reducer: { movements: reducer } });
}

describe('movementSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with the steam filter preset and empty collections', () => {
    const state = reducer(undefined, { type: '@@INIT' });

    expect(state.filters).toEqual({ movementType: 'steam', hoursBack: 4, limit: 20 });
    expect(state.liveMovements).toEqual([]);
    expect(state.steamMoves).toEqual([]);
    expect(state.selectedGameMovements).toBeNull();
    expect(state.statistics).toBeNull();
    expect(state.steamMovesCount).toBe(0);
    expect(state.totalMovements).toBe(0);
  });

  describe('setFilters', () => {
    it('merges a partial filter change, keeping the rest', () => {
      const state = reducer(undefined, setFilters({ hoursBack: 12 }));

      expect(state.filters).toEqual({ movementType: 'steam', hoursBack: 12, limit: 20 });
    });

    it('accumulates successive changes', () => {
      let state = reducer(undefined, setFilters({ movementType: 'reverse' }));
      state = reducer(state, setFilters({ limit: 50 }));

      expect(state.filters).toEqual({ movementType: 'reverse', hoursBack: 4, limit: 50 });
    });
  });

  describe('fetchLiveMovements', () => {
    it('passes the supplied filters positionally to the service', async () => {
      mockService.getLiveMovements.mockResolvedValue({ movements: [makeLineMovement()], total: 1 });
      const store = makeStore();

      await store.dispatch(
        fetchLiveMovements({ limit: 50, hoursBack: 12, movementType: 'reverse' })
      );

      expect(mockService.getLiveMovements).toHaveBeenCalledWith(50, 12, 'reverse');
      expect(selectLiveMovements(store.getState() as never)).toHaveLength(1);
      expect(store.getState().movements.lastFetched).not.toBeNull();
    });

    it('fills in defaults for filters the caller omits', async () => {
      mockService.getLiveMovements.mockResolvedValue({ movements: [], total: 0 });
      const store = makeStore();

      await store.dispatch(fetchLiveMovements({ hoursBack: 24 }));

      expect(mockService.getLiveMovements).toHaveBeenCalledWith(20, 24, 'steam');
    });

    it('stores the movement detail a steam alert renders', async () => {
      mockService.getLiveMovements.mockResolvedValue({
        movements: [makeLineMovement({ id: 'move-9' })],
        total: 1,
      });
      const store = makeStore();

      await store.dispatch(fetchLiveMovements({}));

      const [movement] = store.getState().movements.liveMovements;
      expect(movement.id).toBe('move-9');
      expect(movement.bookmakerCount).toBe(3);
      expect(movement.linesBefore.draftkings).toBe(-3.5);
      expect(movement.linesAfter.draftkings).toBe(-5);
    });

    it('surfaces the backend error message', async () => {
      mockService.getLiveMovements.mockRejectedValue(axiosError('Movement detection is offline'));
      const store = makeStore();

      await store.dispatch(fetchLiveMovements({}));

      expect(store.getState().movements.error).toBe('Movement detection is offline');
      expect(store.getState().movements.loading).toBe(false);
    });

    it('falls back to a generic message when there is no response body', async () => {
      mockService.getLiveMovements.mockRejectedValue(new Error('Network Error'));
      const store = makeStore();

      await store.dispatch(fetchLiveMovements({}));

      expect(store.getState().movements.error).toBe('Failed to fetch live movements');
    });
  });

  describe('fetchGameMovements', () => {
    it('stores the game and its movements separately from the live feed', async () => {
      mockService.getLiveMovements.mockResolvedValue({
        movements: [makeLineMovement({ id: 'live-1' })],
        total: 1,
      });
      mockService.getGameMovements.mockResolvedValue({
        movements: [makeLineMovement({ id: 'game-move-1' })],
        game: { id: 'game-lal-bos', matchup: 'Lakers @ Celtics' },
      });
      const store = makeStore();

      await store.dispatch(fetchLiveMovements({}));
      await store.dispatch(fetchGameMovements('game-lal-bos'));

      const state = store.getState().movements;
      expect(mockService.getGameMovements).toHaveBeenCalledWith('game-lal-bos');
      expect(state.selectedGameMovements?.map((m) => m.id)).toEqual(['game-move-1']);
      expect(state.selectedGame.matchup).toBe('Lakers @ Celtics');
      expect(state.liveMovements.map((m) => m.id)).toEqual(['live-1']);
    });

    it('drops the game selection on clearGameMovements', async () => {
      mockService.getGameMovements.mockResolvedValue({
        movements: [makeLineMovement()],
        game: { id: 'game-lal-bos' },
      });
      const store = makeStore();

      await store.dispatch(fetchGameMovements('game-lal-bos'));
      store.dispatch(clearGameMovements());

      const state = store.getState().movements;
      expect(state.selectedGameMovements).toBeNull();
      expect(state.selectedGameId).toBeNull();
      expect(state.selectedGame).toBeNull();
    });
  });

  describe('fetchMovementStats', () => {
    it('stores statistics along with the two headline counts', async () => {
      mockService.getMovementStats.mockResolvedValue({
        statistics: MOVEMENT_STATS,
        steamMovesCount: 11,
        totalMovements: 60,
      });
      const store = makeStore();

      await store.dispatch(fetchMovementStats(12));

      expect(mockService.getMovementStats).toHaveBeenCalledWith(12);
      expect(selectMovementStats(store.getState() as never)?.byType.steam).toBe(11);
      expect(selectSteamMovesCount(store.getState() as never)).toBe(11);
      expect(store.getState().movements.totalMovements).toBe(60);
    });

    it('defaults to a 24-hour window', async () => {
      mockService.getMovementStats.mockResolvedValue({
        statistics: MOVEMENT_STATS,
        steamMovesCount: 0,
        totalMovements: 0,
      });
      const store = makeStore();

      await store.dispatch(fetchMovementStats());

      expect(mockService.getMovementStats).toHaveBeenCalledWith(24);
    });
  });

  describe('fetchSteamMoves', () => {
    it('stores the steam list, which the payload provides directly as an array', async () => {
      mockService.getSteamMoves.mockResolvedValue([
        makeLineMovement({ id: 'steam-1' }),
        makeLineMovement({ id: 'steam-2' }),
      ]);
      const store = makeStore();

      await store.dispatch(fetchSteamMoves(5));

      expect(mockService.getSteamMoves).toHaveBeenCalledWith(5);
      expect(selectSteamMoves(store.getState() as never).map((m) => m.id)).toEqual([
        'steam-1',
        'steam-2',
      ]);
      expect(store.getState().movements.loading).toBe(false);
    });

    it('records the error on failure', async () => {
      mockService.getSteamMoves.mockRejectedValue(axiosError('Steam feed unavailable'));
      const store = makeStore();

      await store.dispatch(fetchSteamMoves());

      expect(store.getState().movements.error).toBe('Steam feed unavailable');
    });
  });

  it('clears the error on clearError', () => {
    const errored = reducer(undefined, {
      type: fetchLiveMovements.rejected.type,
      payload: 'boom',
    });
    expect(errored.error).toBe('boom');

    expect(reducer(errored, clearError()).error).toBeNull();
  });
});
