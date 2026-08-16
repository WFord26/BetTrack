/**
 * Redux slice for arbitrage and middle opportunities
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { arbitrageService, LiveQuery } from '../services/arbitrage.service';
import {
  ArbitrageOpportunity,
  ArbitrageStats,
  StakePlan,
  ArbitrageAlertSettings,
  DEFAULT_ALERT_SETTINGS,
} from '../types/arbitrage.types';
import { RootState } from './index';

const ALERT_SETTINGS_KEY = 'bettrack.arbitrage.alerts';

function loadAlertSettings(): ArbitrageAlertSettings {
  try {
    const raw = window.localStorage.getItem(ALERT_SETTINGS_KEY);
    if (!raw) return DEFAULT_ALERT_SETTINGS;
    return { ...DEFAULT_ALERT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ALERT_SETTINGS;
  }
}

function saveAlertSettings(settings: ArbitrageAlertSettings): void {
  try {
    window.localStorage.setItem(ALERT_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable (private mode); settings stay in memory only.
  }
}

export interface ArbitrageState {
  live: ArbitrageOpportunity[];
  history: ArbitrageOpportunity[];
  selected: ArbitrageOpportunity | null;
  stats: ArbitrageStats | null;
  calculatorResult: StakePlan | null;
  alertSettings: ArbitrageAlertSettings;
  loading: boolean;
  calculating: boolean;
  error: string | null;
  lastFetched: string | null;
}

const initialState: ArbitrageState = {
  live: [],
  history: [],
  selected: null,
  stats: null,
  calculatorResult: null,
  alertSettings: loadAlertSettings(),
  loading: false,
  calculating: false,
  error: null,
  lastFetched: null,
};

// ─── Async Thunks ─────────────────────────────────────────────────────────────

export const fetchLiveArbitrage = createAsyncThunk(
  'arbitrage/fetchLive',
  async (query: LiveQuery = {}, { rejectWithValue }) => {
    try {
      return await arbitrageService.getLive(query);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to fetch arbitrage opportunities'
      );
    }
  }
);

export const fetchArbitrageHistory = createAsyncThunk(
  'arbitrage/fetchHistory',
  async (
    params: { limit?: number; daysBack?: number; status?: string; mine?: boolean } = {},
    { rejectWithValue }
  ) => {
    try {
      return await arbitrageService.getHistory(params);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to fetch arbitrage history'
      );
    }
  }
);

export const fetchArbitrageStats = createAsyncThunk(
  'arbitrage/fetchStats',
  async (
    { daysBack = 30, mine = false }: { daysBack?: number; mine?: boolean } = {},
    { rejectWithValue }
  ) => {
    try {
      return await arbitrageService.getStats(daysBack, mine);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch arbitrage stats');
    }
  }
);

export const calculateStakes = createAsyncThunk(
  'arbitrage/calculate',
  async (
    { odds, totalStake }: { odds: number[]; totalStake: number },
    { rejectWithValue }
  ) => {
    try {
      return await arbitrageService.calculate(odds, totalStake);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to calculate stakes');
    }
  }
);

export const takeOpportunity = createAsyncThunk(
  'arbitrage/take',
  async (
    { id, actualProfit }: { id: string; actualProfit?: number },
    { rejectWithValue }
  ) => {
    try {
      return await arbitrageService.markTaken(id, actualProfit);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to mark opportunity as taken'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const arbitrageSlice = createSlice({
  name: 'arbitrage',
  initialState,
  reducers: {
    setAlertSettings(state, action: { payload: Partial<ArbitrageAlertSettings> }) {
      state.alertSettings = { ...state.alertSettings, ...action.payload };
      saveAlertSettings(state.alertSettings);
    },
    resetAlertSettings(state) {
      state.alertSettings = DEFAULT_ALERT_SETTINGS;
      saveAlertSettings(state.alertSettings);
    },
    clearCalculatorResult(state) {
      state.calculatorResult = null;
    },
    clearArbitrageError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLiveArbitrage.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLiveArbitrage.fulfilled, (state, action) => {
        state.live = action.payload.opportunities;
        state.loading = false;
        state.lastFetched = action.payload.retrievedAt || new Date().toISOString();
      })
      .addCase(fetchLiveArbitrage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(fetchArbitrageHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchArbitrageHistory.fulfilled, (state, action) => {
        state.history = action.payload.opportunities;
        state.loading = false;
      })
      .addCase(fetchArbitrageHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(fetchArbitrageStats.fulfilled, (state, action) => {
        state.stats = action.payload;
      })
      .addCase(fetchArbitrageStats.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    builder
      .addCase(calculateStakes.pending, (state) => {
        state.calculating = true;
        state.error = null;
      })
      .addCase(calculateStakes.fulfilled, (state, action) => {
        state.calculatorResult = action.payload;
        state.calculating = false;
      })
      .addCase(calculateStakes.rejected, (state, action) => {
        state.calculating = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(takeOpportunity.fulfilled, (state, action) => {
        if (!action.payload) return;
        state.live = state.live.filter((o) => o.id !== action.payload!.id);
      })
      .addCase(takeOpportunity.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const {
  setAlertSettings,
  resetAlertSettings,
  clearCalculatorResult,
  clearArbitrageError,
} = arbitrageSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectLiveArbitrage = (state: RootState) => state.arbitrage.live;
export const selectArbitrageHistory = (state: RootState) => state.arbitrage.history;
export const selectArbitrageStats = (state: RootState) => state.arbitrage.stats;
export const selectCalculatorResult = (state: RootState) => state.arbitrage.calculatorResult;
export const selectAlertSettings = (state: RootState) => state.arbitrage.alertSettings;
export const selectArbitrageLoading = (state: RootState) => state.arbitrage.loading;
export const selectArbitrageCalculating = (state: RootState) => state.arbitrage.calculating;
export const selectArbitrageError = (state: RootState) => state.arbitrage.error;
export const selectArbitrageLastFetched = (state: RootState) => state.arbitrage.lastFetched;

/** Opportunities that clear the user's configured alert thresholds. */
export const selectAlertingOpportunities = (state: RootState) => {
  const settings = state.arbitrage.alertSettings;
  if (!settings.enabled) return [];

  return state.arbitrage.live.filter((opportunity) => {
    if (Number(opportunity.profitPercentage) < settings.minProfitPercentage) return false;
    if (opportunity.oddsSnapshotAge > settings.maxSnapshotAgeSeconds) return false;
    if (!settings.includeMiddles && opportunity.arbType === 'middle') return false;

    if (settings.preferredBookmakers.length > 0) {
      const books = opportunity.legs.map((leg) => leg.bookmaker.toLowerCase());
      const allowed = settings.preferredBookmakers.map((b) => b.toLowerCase());
      if (!books.every((book) => allowed.includes(book))) return false;
    }

    if (settings.sports.length > 0) {
      const sportKey = opportunity.game?.sport?.key;
      if (!sportKey || !settings.sports.includes(sportKey)) return false;
    }

    return true;
  });
};

export default arbitrageSlice.reducer;
