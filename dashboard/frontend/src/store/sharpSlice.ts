/**
 * Redux slice for Sharp vs Public Money Indicators state management
 */
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { sharpService } from '../services/sharp.service';
import { SharpIndicator, ContrarianOpportunity, SharpStats } from '../types/sharp.types';
import { RootState } from './index';

export interface SharpState {
  liveIndicators: SharpIndicator[];
  contrarianOpportunities: ContrarianOpportunity[];
  selectedGameIndicators: SharpIndicator[] | null;
  selectedGame: any | null;
  stats: SharpStats | null;
  loading: boolean;
  error: string | null;
  lastFetched: string | null;
}

const initialState: SharpState = {
  liveIndicators: [],
  contrarianOpportunities: [],
  selectedGameIndicators: null,
  selectedGame: null,
  stats: null,
  loading: false,
  error: null,
  lastFetched: null,
};

// ─── Async Thunks ─────────────────────────────────────────────────────────────

export const fetchLiveIndicators = createAsyncThunk(
  'sharp/fetchLive',
  async (limit: number = 20, { rejectWithValue }) => {
    try {
      return await sharpService.getLiveIndicators(limit);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to fetch sharp indicators'
      );
    }
  }
);

export const fetchGameIndicators = createAsyncThunk(
  'sharp/fetchGame',
  async (gameId: string, { rejectWithValue }) => {
    try {
      return await sharpService.getGameIndicators(gameId);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to fetch game sharp indicators'
      );
    }
  }
);

export const fetchContrarianOpportunities = createAsyncThunk(
  'sharp/fetchContrarian',
  async (
    { minConfidence = 6, limit = 20 }: { minConfidence?: number; limit?: number },
    { rejectWithValue }
  ) => {
    try {
      return await sharpService.getContrarianOpportunities(minConfidence, limit);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to fetch contrarian opportunities'
      );
    }
  }
);

export const fetchSharpStats = createAsyncThunk(
  'sharp/fetchStats',
  async (hoursBack: number = 24, { rejectWithValue }) => {
    try {
      return await sharpService.getStats(hoursBack);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to fetch sharp stats'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const sharpSlice = createSlice({
  name: 'sharp',
  initialState,
  reducers: {
    clearGameIndicators(state) {
      state.selectedGameIndicators = null;
      state.selectedGame = null;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Live indicators
    builder
      .addCase(fetchLiveIndicators.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLiveIndicators.fulfilled, (state, action) => {
        state.liveIndicators = action.payload.indicators;
        state.loading = false;
        state.lastFetched = new Date().toISOString();
      })
      .addCase(fetchLiveIndicators.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Game indicators
    builder
      .addCase(fetchGameIndicators.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGameIndicators.fulfilled, (state, action) => {
        state.selectedGameIndicators = action.payload.indicators;
        state.selectedGame = action.payload.game;
        state.loading = false;
      })
      .addCase(fetchGameIndicators.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Contrarian opportunities
    builder
      .addCase(fetchContrarianOpportunities.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchContrarianOpportunities.fulfilled, (state, action) => {
        state.contrarianOpportunities = action.payload.opportunities;
        state.loading = false;
        state.lastFetched = new Date().toISOString();
      })
      .addCase(fetchContrarianOpportunities.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Stats
    builder
      .addCase(fetchSharpStats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSharpStats.fulfilled, (state, action) => {
        state.stats = action.payload;
        state.loading = false;
      })
      .addCase(fetchSharpStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearGameIndicators, clearError } = sharpSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectLiveIndicators = (state: RootState) => state.sharp.liveIndicators;
export const selectContrarianOpportunities = (state: RootState) => state.sharp.contrarianOpportunities;
export const selectGameIndicators = (state: RootState) => state.sharp.selectedGameIndicators;
export const selectSharpStats = (state: RootState) => state.sharp.stats;
export const selectSharpLoading = (state: RootState) => state.sharp.loading;
export const selectSharpError = (state: RootState) => state.sharp.error;

export default sharpSlice.reducer;
