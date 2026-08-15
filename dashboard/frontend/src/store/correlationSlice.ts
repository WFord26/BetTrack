/**
 * Redux slice for parlay correlation analysis, hedging, and education content.
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { correlationService } from '../services/correlation.service';
import {
  ParlayAnalysis,
  DraftLegInput,
  HedgeOption,
  RiskLevel,
  CorrelationEducationContent,
} from '../types/correlation.types';
import { RootState } from './index';

export interface CorrelationState {
  draftAnalysis: ParlayAnalysis | null;
  history: ParlayAnalysis[];
  hedgeOptions: HedgeOption[];
  education: CorrelationEducationContent | null;
  analyzing: boolean;
  hedging: boolean;
  loading: boolean;
  error: string | null;
  /**
   * requestId of the most recently dispatched analyzeDraftSlip thunk. If the
   * user edits the slip while an earlier debounced request is still in
   * flight, a slow response for that stale request must not overwrite the
   * current slip's warning/true-odds with outdated data.
   */
  latestDraftRequestId: string | null;
}

const initialState: CorrelationState = {
  draftAnalysis: null,
  history: [],
  hedgeOptions: [],
  education: null,
  analyzing: false,
  hedging: false,
  loading: false,
  error: null,
  latestDraftRequestId: null,
};

// ─── Async Thunks ─────────────────────────────────────────────────────────────

export const analyzeDraftSlip = createAsyncThunk(
  'correlation/analyzeDraftSlip',
  async (legs: DraftLegInput[], { rejectWithValue }) => {
    try {
      return await correlationService.analyzeDraftSlip(legs);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to analyze parlay');
    }
  }
);

export const fetchCorrelationHistory = createAsyncThunk(
  'correlation/fetchHistory',
  async (params: { limit?: number; riskLevel?: RiskLevel } = {}, { rejectWithValue }) => {
    try {
      return await correlationService.getHistory(params);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch correlation history');
    }
  }
);

export const findHedgeOptions = createAsyncThunk(
  'correlation/findHedges',
  async (betLegId: string, { rejectWithValue }) => {
    try {
      return await correlationService.findHedges(betLegId);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to find hedging opportunities');
    }
  }
);

export const fetchCorrelationEducation = createAsyncThunk(
  'correlation/fetchEducation',
  async (_: void, { rejectWithValue }) => {
    try {
      return await correlationService.getEducation();
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch education content');
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const correlationSlice = createSlice({
  name: 'correlation',
  initialState,
  reducers: {
    clearDraftAnalysis(state) {
      state.draftAnalysis = null;
      // Invalidate so a fulfillment for a request made before this clear
      // (e.g. the last leg was just removed) can't repopulate stale data.
      state.latestDraftRequestId = null;
    },
    clearHedgeOptions(state) {
      state.hedgeOptions = [];
    },
    clearCorrelationError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(analyzeDraftSlip.pending, (state, action) => {
        state.analyzing = true;
        state.error = null;
        state.latestDraftRequestId = action.meta.requestId;
      })
      .addCase(analyzeDraftSlip.fulfilled, (state, action) => {
        // A newer request has since superseded this one — drop the stale result.
        if (action.meta.requestId !== state.latestDraftRequestId) return;
        state.draftAnalysis = action.payload;
        state.analyzing = false;
      })
      .addCase(analyzeDraftSlip.rejected, (state, action) => {
        if (action.meta.requestId !== state.latestDraftRequestId) return;
        state.analyzing = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(fetchCorrelationHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCorrelationHistory.fulfilled, (state, action) => {
        state.history = action.payload.analyses;
        state.loading = false;
      })
      .addCase(fetchCorrelationHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(findHedgeOptions.pending, (state) => {
        state.hedging = true;
        state.error = null;
      })
      .addCase(findHedgeOptions.fulfilled, (state, action) => {
        state.hedgeOptions = action.payload;
        state.hedging = false;
      })
      .addCase(findHedgeOptions.rejected, (state, action) => {
        state.hedging = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(fetchCorrelationEducation.fulfilled, (state, action) => {
        state.education = action.payload;
      })
      .addCase(fetchCorrelationEducation.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const { clearDraftAnalysis, clearHedgeOptions, clearCorrelationError } =
  correlationSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectDraftAnalysis = (state: RootState) => state.correlation.draftAnalysis;
export const selectCorrelationHistory = (state: RootState) => state.correlation.history;
export const selectHedgeOptions = (state: RootState) => state.correlation.hedgeOptions;
export const selectCorrelationEducation = (state: RootState) => state.correlation.education;
export const selectCorrelationAnalyzing = (state: RootState) => state.correlation.analyzing;
export const selectCorrelationHedging = (state: RootState) => state.correlation.hedging;
export const selectCorrelationLoading = (state: RootState) => state.correlation.loading;
export const selectCorrelationError = (state: RootState) => state.correlation.error;

export default correlationSlice.reducer;
