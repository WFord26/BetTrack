/**
 * Redux slice for Bookmaker Performance Analytics state management
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { bookmakerService } from '../services/bookmaker.service';
import {
  BookmakerAnalytics,
  BookmakerOutlierStats,
  BookmakerRankingCriteria,
} from '../types/bookmaker.types';
import { RootState } from './index';

export interface BookmakerState {
  rankings: BookmakerAnalytics[];
  rankingCriteria: BookmakerRankingCriteria;
  selectedBookmaker: BookmakerAnalytics | null;
  outlierStats: BookmakerOutlierStats | null;
  loading: boolean;
  detailLoading: boolean;
  outlierLoading: boolean;
  error: string | null;
}

const initialState: BookmakerState = {
  rankings: [],
  rankingCriteria: 'recommendation',
  selectedBookmaker: null,
  outlierStats: null,
  loading: false,
  detailLoading: false,
  outlierLoading: false,
  error: null,
};

// ─── Async Thunks ─────────────────────────────────────────────────────────────

export const fetchRankings = createAsyncThunk(
  'bookmaker/fetchRankings',
  async (criteria: BookmakerRankingCriteria = 'recommendation', { rejectWithValue }) => {
    try {
      return await bookmakerService.getRankings(criteria);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to fetch bookmaker rankings'
      );
    }
  }
);

export const fetchBookmakerDetail = createAsyncThunk(
  'bookmaker/fetchDetail',
  async (bookmaker: string, { rejectWithValue }) => {
    try {
      return await bookmakerService.getBookmakerDetail(bookmaker);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to fetch bookmaker details'
      );
    }
  }
);

export const fetchOutlierStats = createAsyncThunk(
  'bookmaker/fetchOutliers',
  async (
    { bookmaker, days = 30 }: { bookmaker: string; days?: number },
    { rejectWithValue }
  ) => {
    try {
      return await bookmakerService.getBookmakerOutlierStats(bookmaker, days);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to fetch outlier stats'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const bookmakerSlice = createSlice({
  name: 'bookmaker',
  initialState,
  reducers: {
    clearSelectedBookmaker(state) {
      state.selectedBookmaker = null;
      state.outlierStats = null;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Rankings
    builder
      .addCase(fetchRankings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRankings.fulfilled, (state, action) => {
        state.rankings = action.payload.rankings;
        state.rankingCriteria = action.payload.criteria;
        state.loading = false;
      })
      .addCase(fetchRankings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Detail
    builder
      .addCase(fetchBookmakerDetail.pending, (state) => {
        state.detailLoading = true;
        state.error = null;
      })
      .addCase(fetchBookmakerDetail.fulfilled, (state, action) => {
        state.selectedBookmaker = action.payload;
        state.detailLoading = false;
      })
      .addCase(fetchBookmakerDetail.rejected, (state, action) => {
        state.detailLoading = false;
        state.error = action.payload as string;
      });

    // Outlier stats
    builder
      .addCase(fetchOutlierStats.pending, (state) => {
        state.outlierLoading = true;
      })
      .addCase(fetchOutlierStats.fulfilled, (state, action) => {
        state.outlierStats = action.payload;
        state.outlierLoading = false;
      })
      .addCase(fetchOutlierStats.rejected, (state, action) => {
        state.outlierLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearSelectedBookmaker, clearError } = bookmakerSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectRankings = (state: RootState) => state.bookmaker.rankings;
export const selectRankingCriteria = (state: RootState) => state.bookmaker.rankingCriteria;
export const selectSelectedBookmaker = (state: RootState) => state.bookmaker.selectedBookmaker;
export const selectOutlierStats = (state: RootState) => state.bookmaker.outlierStats;
export const selectBookmakerLoading = (state: RootState) => state.bookmaker.loading;
export const selectBookmakerDetailLoading = (state: RootState) => state.bookmaker.detailLoading;
export const selectBookmakerOutlierLoading = (state: RootState) => state.bookmaker.outlierLoading;
export const selectBookmakerError = (state: RootState) => state.bookmaker.error;

export default bookmakerSlice.reducer;
