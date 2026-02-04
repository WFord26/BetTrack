/**
 * Redux slice for CLV (Closing Line Value) analytics state management
 */
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { clvService } from '../services/clv.service';
import { CLVSummary, CLVBySport, CLVByBookmaker, CLVTrend, CLVReport, CLVFilters } from '../types/clv.types';
import { RootState } from './index';

export interface CLVState {
  summary: CLVSummary | null;
  bySport: CLVBySport[];
  byBookmaker: CLVByBookmaker[];
  trends: CLVTrend[];
  report: CLVReport | null;
  filters: CLVFilters;
  loading: boolean;
  error: string | null;
}

const initialState: CLVState = {
  summary: null,
  bySport: [],
  byBookmaker: [],
  trends: [],
  report: null,
  filters: {
    period: 'all-time'
  },
  loading: false,
  error: null
};

// Async thunks
export const fetchCLVSummary = createAsyncThunk(
  'clv/fetchSummary',
  async (_, { rejectWithValue }) => {
    try {
      const data = await clvService.getSummary();
      return data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch CLV summary');
    }
  }
);

export const fetchCLVBySport = createAsyncThunk(
  'clv/fetchBySport',
  async (_, { rejectWithValue }) => {
    try {
      const data = await clvService.getBySport();
      return data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch CLV by sport');
    }
  }
);

export const fetchCLVByBookmaker = createAsyncThunk(
  'clv/fetchByBookmaker',
  async (_, { rejectWithValue }) => {
    try {
      const data = await clvService.getByBookmaker();
      return data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch CLV by bookmaker');
    }
  }
);

export const fetchCLVTrends = createAsyncThunk(
  'clv/fetchTrends',
  async (filters: CLVFilters | undefined, { rejectWithValue }) => {
    try {
      const data = await clvService.getTrends(filters);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch CLV trends');
    }
  }
);

export const fetchCLVReport = createAsyncThunk(
  'clv/fetchReport',
  async (filters: CLVFilters | undefined, { rejectWithValue }) => {
    try {
      const data = await clvService.getReport(filters);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch CLV report');
    }
  }
);

export const calculateBetCLV = createAsyncThunk(
  'clv/calculateBet',
  async (betId: string, { rejectWithValue }) => {
    try {
      const data = await clvService.calculateForBet(betId);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to calculate bet CLV');
    }
  }
);

// Slice
const clvSlice = createSlice({
  name: 'clv',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<CLVFilters>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = { period: 'all-time' };
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // Fetch Summary
    builder
      .addCase(fetchCLVSummary.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCLVSummary.fulfilled, (state, action) => {
        state.loading = false;
        state.summary = action.payload;
      })
      .addCase(fetchCLVSummary.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch By Sport
    builder
      .addCase(fetchCLVBySport.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCLVBySport.fulfilled, (state, action) => {
        state.loading = false;
        state.bySport = action.payload;
      })
      .addCase(fetchCLVBySport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch By Bookmaker
    builder
      .addCase(fetchCLVByBookmaker.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCLVByBookmaker.fulfilled, (state, action) => {
        state.loading = false;
        state.byBookmaker = action.payload;
      })
      .addCase(fetchCLVByBookmaker.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch Trends
    builder
      .addCase(fetchCLVTrends.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCLVTrends.fulfilled, (state, action) => {
        state.loading = false;
        state.trends = action.payload;
      })
      .addCase(fetchCLVTrends.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch Report
    builder
      .addCase(fetchCLVReport.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCLVReport.fulfilled, (state, action) => {
        state.loading = false;
        state.report = action.payload;
      })
      .addCase(fetchCLVReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Calculate Bet CLV
    builder
      .addCase(calculateBetCLV.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(calculateBetCLV.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(calculateBetCLV.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

// Actions
export const { setFilters, clearFilters, clearError } = clvSlice.actions;

// Selectors
export const selectCLVSummary = (state: RootState) => state.clv.summary;
export const selectCLVBySport = (state: RootState) => state.clv.bySport;
export const selectCLVByBookmaker = (state: RootState) => state.clv.byBookmaker;
export const selectCLVTrends = (state: RootState) => state.clv.trends;
export const selectCLVReport = (state: RootState) => state.clv.report;
export const selectCLVFilters = (state: RootState) => state.clv.filters;
export const selectCLVLoading = (state: RootState) => state.clv.loading;
export const selectCLVError = (state: RootState) => state.clv.error;

export default clvSlice.reducer;
