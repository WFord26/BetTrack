/**
 * Tests for arbitrageSlice.
 *
 * Three things carry real logic here and get real assertions:
 *   1. alert settings round-trip through localStorage,
 *   2. `selectAlertingOpportunities` filters live opportunities against those
 *      settings (profit floor, staleness, middles, books, sports),
 *   3. `takeOpportunity.fulfilled` removes the taken row from the live list.
 * The thunks are driven through a real store against a mocked service so the
 * pending/fulfilled/rejected transitions are exercised end to end.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { DEFAULT_ALERT_SETTINGS } from '../types/arbitrage.types';
import {
  makeArbitrageOpportunity,
  ARBITRAGE_STATS,
  STAKE_PLAN,
  axiosError,
} from '../test/fixtures';

vi.mock('../services/arbitrage.service', () => ({
  arbitrageService: {
    getLive: vi.fn(),
    getHistory: vi.fn(),
    getStats: vi.fn(),
    getById: vi.fn(),
    markTaken: vi.fn(),
    calculate: vi.fn(),
  },
}));

import { arbitrageService } from '../services/arbitrage.service';
import reducer, {
  fetchLiveArbitrage,
  fetchArbitrageHistory,
  fetchArbitrageStats,
  calculateStakes,
  takeOpportunity,
  setAlertSettings,
  resetAlertSettings,
  clearCalculatorResult,
  clearArbitrageError,
  selectAlertingOpportunities,
  selectLiveArbitrage,
  selectArbitrageError,
} from './arbitrageSlice';

const mockService = arbitrageService as unknown as Record<string, ReturnType<typeof vi.fn>>;

const ALERT_SETTINGS_KEY = 'bettrack.arbitrage.alerts';

function makeStore() {
  return configureStore({ reducer: { arbitrage: reducer } });
}

/** Wraps slice state in the shape the selectors expect. */
function asRootState(state: ReturnType<typeof reducer>) {
  return { arbitrage: state } as never;
}

describe('arbitrageSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('initial state', () => {
    it('starts empty with the default alert settings', () => {
      const state = reducer(undefined, { type: '@@INIT' });

      expect(state.live).toEqual([]);
      expect(state.history).toEqual([]);
      expect(state.stats).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.alertSettings).toEqual(DEFAULT_ALERT_SETTINGS);
    });
  });

  describe('alert settings', () => {
    it('merges a partial update and persists the merged result', () => {
      const state = reducer(undefined, setAlertSettings({ minProfitPercentage: 2.5 }));

      expect(state.alertSettings.minProfitPercentage).toBe(2.5);
      // Untouched fields keep their defaults rather than being dropped.
      expect(state.alertSettings.includeMiddles).toBe(DEFAULT_ALERT_SETTINGS.includeMiddles);

      const persisted = JSON.parse(localStorage.getItem(ALERT_SETTINGS_KEY)!);
      expect(persisted.minProfitPercentage).toBe(2.5);
      expect(persisted.maxSnapshotAgeSeconds).toBe(DEFAULT_ALERT_SETTINGS.maxSnapshotAgeSeconds);
    });

    it('accumulates successive partial updates', () => {
      let state = reducer(undefined, setAlertSettings({ enabled: false }));
      state = reducer(state, setAlertSettings({ preferredBookmakers: ['pinnacle'] }));

      expect(state.alertSettings.enabled).toBe(false);
      expect(state.alertSettings.preferredBookmakers).toEqual(['pinnacle']);
    });

    it('restores and re-persists the defaults on reset', () => {
      let state = reducer(undefined, setAlertSettings({ minProfitPercentage: 9, enabled: false }));
      state = reducer(state, resetAlertSettings());

      expect(state.alertSettings).toEqual(DEFAULT_ALERT_SETTINGS);
      expect(JSON.parse(localStorage.getItem(ALERT_SETTINGS_KEY)!)).toEqual(DEFAULT_ALERT_SETTINGS);
    });

    it('keeps settings in memory when storage writes throw (private mode)', () => {
      const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      const state = reducer(undefined, setAlertSettings({ minProfitPercentage: 4 }));

      expect(state.alertSettings.minProfitPercentage).toBe(4);
      setItem.mockRestore();
    });
  });

  describe('selectAlertingOpportunities', () => {
    const base = reducer(undefined, { type: '@@INIT' });

    function stateWith(live: ReturnType<typeof makeArbitrageOpportunity>[], settings = {}) {
      return asRootState({
        ...base,
        live,
        alertSettings: { ...DEFAULT_ALERT_SETTINGS, ...settings },
      });
    }

    it('returns nothing when alerts are disabled, however good the opportunity', () => {
      const state = stateWith([makeArbitrageOpportunity({ profitPercentage: '25' })], {
        enabled: false,
      });

      expect(selectAlertingOpportunities(state)).toEqual([]);
    });

    it('admits an opportunity that clears every threshold', () => {
      const state = stateWith([makeArbitrageOpportunity()]);

      expect(selectAlertingOpportunities(state)).toHaveLength(1);
    });

    it('drops opportunities below the profit floor, comparing numerically', () => {
      // profitPercentage arrives as a Decimal string; '0.50' must not be
      // string-compared against the numeric floor of 1.
      const state = stateWith([
        makeArbitrageOpportunity({ id: 'weak', profitPercentage: '0.50' }),
        makeArbitrageOpportunity({ id: 'strong', profitPercentage: '2.00' }),
      ]);

      expect(selectAlertingOpportunities(state).map((o) => o.id)).toEqual(['strong']);
    });

    it('drops opportunities whose odds snapshot is staler than the limit', () => {
      const state = stateWith(
        [
          makeArbitrageOpportunity({ id: 'fresh', oddsSnapshotAge: 100 }),
          makeArbitrageOpportunity({ id: 'stale', oddsSnapshotAge: 900 }),
        ],
        { maxSnapshotAgeSeconds: 600 }
      );

      expect(selectAlertingOpportunities(state).map((o) => o.id)).toEqual(['fresh']);
    });

    it('excludes middles when includeMiddles is off', () => {
      const state = stateWith(
        [
          makeArbitrageOpportunity({ id: 'arb', arbType: 'two-way' }),
          makeArbitrageOpportunity({ id: 'mid', arbType: 'middle' }),
        ],
        { includeMiddles: false }
      );

      expect(selectAlertingOpportunities(state).map((o) => o.id)).toEqual(['arb']);
    });

    it('requires every leg to sit on a preferred book, case-insensitively', () => {
      const onPreferred = makeArbitrageOpportunity({ id: 'both-preferred' });
      const partly = makeArbitrageOpportunity({
        id: 'one-off-book',
        legs: [
          { ...onPreferred.legs[0], bookmaker: 'DraftKings' },
          { ...onPreferred.legs[1], bookmaker: 'betmgm' },
        ],
      });
      const state = stateWith([onPreferred, partly], {
        preferredBookmakers: ['DRAFTKINGS', 'FanDuel'],
      });

      expect(selectAlertingOpportunities(state).map((o) => o.id)).toEqual(['both-preferred']);
    });

    it('filters by sport when a sport list is configured', () => {
      const nba = makeArbitrageOpportunity({ id: 'nba' });
      const nfl = makeArbitrageOpportunity({
        id: 'nfl',
        game: { ...nba.game!, sport: { key: 'americanfootball_nfl', name: 'NFL' } },
      });
      const noSport = makeArbitrageOpportunity({ id: 'no-sport', game: undefined });
      const state = stateWith([nba, nfl, noSport], { sports: ['basketball_nba'] });

      expect(selectAlertingOpportunities(state).map((o) => o.id)).toEqual(['nba']);
    });
  });

  describe('fetchLiveArbitrage', () => {
    it('sets loading on pending and clears any prior error', () => {
      const errored = reducer(undefined, {
        type: fetchLiveArbitrage.rejected.type,
        payload: 'boom',
      });
      const state = reducer(errored, { type: fetchLiveArbitrage.pending.type });

      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('stores opportunities and the server timestamp on success', async () => {
      const opportunity = makeArbitrageOpportunity();
      mockService.getLive.mockResolvedValue({
        opportunities: [opportunity],
        count: 1,
        retrievedAt: '2026-01-15T18:00:00.000Z',
      });
      const store = makeStore();

      await store.dispatch(fetchLiveArbitrage({ minProfit: 1 }));

      const state = store.getState().arbitrage;
      expect(mockService.getLive).toHaveBeenCalledWith({ minProfit: 1 });
      expect(selectLiveArbitrage(store.getState() as never)).toHaveLength(1);
      expect(state.lastFetched).toBe('2026-01-15T18:00:00.000Z');
      expect(state.loading).toBe(false);
    });

    it('falls back to the local clock when the server sends no timestamp', async () => {
      mockService.getLive.mockResolvedValue({ opportunities: [], count: 0, retrievedAt: null });
      const store = makeStore();

      await store.dispatch(fetchLiveArbitrage({}));

      const { lastFetched } = store.getState().arbitrage;
      expect(lastFetched).not.toBeNull();
      expect(Number.isNaN(Date.parse(lastFetched!))).toBe(false);
    });

    it('surfaces the backend error message on failure', async () => {
      mockService.getLive.mockRejectedValue(axiosError('Arbitrage detection is offline'));
      const store = makeStore();

      await store.dispatch(fetchLiveArbitrage({}));

      expect(selectArbitrageError(store.getState() as never)).toBe('Arbitrage detection is offline');
      expect(store.getState().arbitrage.loading).toBe(false);
    });

    it('falls back to a generic message when the error carries no body', async () => {
      mockService.getLive.mockRejectedValue(new Error('Network Error'));
      const store = makeStore();

      await store.dispatch(fetchLiveArbitrage({}));

      expect(store.getState().arbitrage.error).toBe('Failed to fetch arbitrage opportunities');
    });
  });

  describe('fetchArbitrageHistory', () => {
    it('stores history rows without touching the live list', async () => {
      const live = makeArbitrageOpportunity({ id: 'live-1' });
      mockService.getLive.mockResolvedValue({ opportunities: [live], count: 1, retrievedAt: null });
      mockService.getHistory.mockResolvedValue({
        opportunities: [makeArbitrageOpportunity({ id: 'hist-1', status: 'expired' })],
        count: 1,
        period: 'Last 7 days',
      });
      const store = makeStore();

      await store.dispatch(fetchLiveArbitrage({}));
      await store.dispatch(fetchArbitrageHistory({ daysBack: 7 }));

      const state = store.getState().arbitrage;
      expect(state.history.map((o) => o.id)).toEqual(['hist-1']);
      expect(state.live.map((o) => o.id)).toEqual(['live-1']);
    });
  });

  describe('fetchArbitrageStats', () => {
    it('stores the stats payload', async () => {
      mockService.getStats.mockResolvedValue(ARBITRAGE_STATS);
      const store = makeStore();

      await store.dispatch(fetchArbitrageStats({ daysBack: 30 }));

      expect(store.getState().arbitrage.stats?.totalDetected).toBe(128);
    });

    it('records an error without clearing existing stats', async () => {
      mockService.getStats
        .mockResolvedValueOnce(ARBITRAGE_STATS)
        .mockRejectedValueOnce(axiosError('Stats unavailable'));
      const store = makeStore();

      await store.dispatch(fetchArbitrageStats({}));
      await store.dispatch(fetchArbitrageStats({}));

      const state = store.getState().arbitrage;
      expect(state.error).toBe('Stats unavailable');
      expect(state.stats?.totalDetected).toBe(128);
    });
  });

  describe('calculateStakes', () => {
    it('tracks the calculating flag separately from loading', async () => {
      let resolveCalc: (plan: typeof STAKE_PLAN) => void = () => {};
      mockService.calculate.mockReturnValue(
        new Promise((resolve) => {
          resolveCalc = resolve;
        })
      );
      const store = makeStore();

      const pending = store.dispatch(calculateStakes({ odds: [150, -130], totalStake: 1000 }));
      expect(store.getState().arbitrage.calculating).toBe(true);
      expect(store.getState().arbitrage.loading).toBe(false);

      resolveCalc(STAKE_PLAN);
      await pending;

      const state = store.getState().arbitrage;
      expect(state.calculating).toBe(false);
      expect(state.calculatorResult?.guaranteedProfit).toBe(36.03);
    });

    it('clears a previous result on request', () => {
      const withResult = reducer(undefined, {
        type: calculateStakes.fulfilled.type,
        payload: STAKE_PLAN,
      });
      expect(withResult.calculatorResult).not.toBeNull();

      expect(reducer(withResult, clearCalculatorResult()).calculatorResult).toBeNull();
    });

    it('records the error and stops calculating on failure', async () => {
      mockService.calculate.mockRejectedValue(axiosError('At least two legs are required'));
      const store = makeStore();

      await store.dispatch(calculateStakes({ odds: [150], totalStake: 1000 }));

      const state = store.getState().arbitrage;
      expect(state.calculating).toBe(false);
      expect(state.error).toBe('At least two legs are required');
    });
  });

  describe('takeOpportunity', () => {
    it('removes the taken opportunity from the live list', async () => {
      mockService.getLive.mockResolvedValue({
        opportunities: [
          makeArbitrageOpportunity({ id: 'arb-1' }),
          makeArbitrageOpportunity({ id: 'arb-2' }),
        ],
        count: 2,
        retrievedAt: null,
      });
      mockService.markTaken.mockResolvedValue(
        makeArbitrageOpportunity({ id: 'arb-1', status: 'taken' })
      );
      const store = makeStore();

      await store.dispatch(fetchLiveArbitrage({}));
      await store.dispatch(takeOpportunity({ id: 'arb-1', actualProfit: 36.03 }));

      expect(store.getState().arbitrage.live.map((o) => o.id)).toEqual(['arb-2']);
    });

    it('leaves the live list untouched when the server returns no row', async () => {
      mockService.getLive.mockResolvedValue({
        opportunities: [makeArbitrageOpportunity({ id: 'arb-1' })],
        count: 1,
        retrievedAt: null,
      });
      mockService.markTaken.mockResolvedValue(null);
      const store = makeStore();

      await store.dispatch(fetchLiveArbitrage({}));
      await store.dispatch(takeOpportunity({ id: 'arb-1' }));

      expect(store.getState().arbitrage.live.map((o) => o.id)).toEqual(['arb-1']);
    });

    it('records an error when marking fails', async () => {
      mockService.markTaken.mockRejectedValue(axiosError('Opportunity already expired'));
      const store = makeStore();

      await store.dispatch(takeOpportunity({ id: 'arb-1' }));

      expect(store.getState().arbitrage.error).toBe('Opportunity already expired');
    });
  });

  it('clears the error on clearArbitrageError', () => {
    const errored = reducer(undefined, {
      type: fetchLiveArbitrage.rejected.type,
      payload: 'boom',
    });
    expect(errored.error).toBe('boom');

    expect(reducer(errored, clearArbitrageError()).error).toBeNull();
  });
});
