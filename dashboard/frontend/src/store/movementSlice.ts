/**
 * Redux slice for Line Movement Analytics state management
 */
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { lineMovementService } from '../services/line-movement.service';
import { LineMovement, MovementStats, MovementFilters } from '../types/movements.types';
import { RootState } from './index';

export interface MovementState {
  liveMovements: LineMovement[];
  steamMoves: LineMovement[];
  selectedGameMovements: LineMovement[] | null;
  selectedGameId: string | null;
  selectedGame: any | null;
  statistics: MovementStats | null;
  steamMovesCount: number;
  totalMovements: number;
  filters: MovementFilters;
  loading: boolean;
  error: string | null;
  lastFetched: string | null;
}

const initialState: MovementState = {
  liveMovements: [],
  steamMoves: [],
  selectedGameMovements: null,
  selectedGameId: null,
  selectedGame: null,
  statistics: null,
  steamMovesCount: 0,
  totalMovements: 0,
  filters: {
    movementType: 'steam',
    hoursBack: 4,
    limit: 20
  },
  loading: false,
  error: null,
  lastFetched: null
};

// Async thunks
export const fetchLiveMovements = createAsyncThunk(
  'movements/fetchLive',
  async (
    { limit = 20, hoursBack = 4, movementType = 'steam' }: Partial<MovementFilters>,
    { rejectWithValue }
  ) => {
    try {
      const data = await lineMovementService.getLiveMovements(limit, hoursBack, movementType);
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to fetch live movements'
      );
    }
  }
);

export const fetchGameMovements = createAsyncThunk(
  'movements/fetchGameMovements',
  async (gameId: string, { rejectWithValue }) => {
    try {
      const data = await lineMovementService.getGameMovements(gameId);
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to fetch game movements'
      );
    }
  }
);

export const fetchMovementStats = createAsyncThunk(
  'movements/fetchStats',
  async (hoursBack: number = 24, { rejectWithValue }) => {
    try {
      const data = await lineMovementService.getMovementStats(hoursBack);
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to fetch movement statistics'
      );
    }
  }
);

export const fetchSteamMoves = createAsyncThunk(
  'movements/fetchSteamMoves',
  async (limit: number = 20, { rejectWithValue }) => {
    try {
      const data = await lineMovementService.getSteamMoves(limit);
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to fetch steam moves'
      );
    }
  }
);

const movementSlice = createSlice({
  name: 'movements',
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<Partial<MovementFilters>>) {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearGameMovements(state) {
      state.selectedGameMovements = null;
      state.selectedGameId = null;
      state.selectedGame = null;
    },
    clearError(state) {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // Fetch Live Movements
    builder
      .addCase(fetchLiveMovements.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLiveMovements.fulfilled, (state, action) => {
        state.liveMovements = action.payload.movements;
        state.loading = false;
        state.lastFetched = new Date().toISOString();
      })
      .addCase(fetchLiveMovements.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch Game Movements
    builder
      .addCase(fetchGameMovements.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGameMovements.fulfilled, (state, action) => {
        state.selectedGameMovements = action.payload.movements;
        state.selectedGame = action.payload.game;
        state.loading = false;
      })
      .addCase(fetchGameMovements.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch Movement Stats
    builder
      .addCase(fetchMovementStats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMovementStats.fulfilled, (state, action) => {
        state.statistics = action.payload.statistics;
        state.steamMovesCount = action.payload.steamMovesCount;
        state.totalMovements = action.payload.totalMovements;
        state.loading = false;
      })
      .addCase(fetchMovementStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch Steam Moves
    builder
      .addCase(fetchSteamMoves.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSteamMoves.fulfilled, (state, action) => {
        state.steamMoves = action.payload;
        state.loading = false;
      })
      .addCase(fetchSteamMoves.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { setFilters, clearGameMovements, clearError } = movementSlice.actions;

// Selectors
export const selectLiveMovements = (state: RootState) => state.movements.liveMovements;
export const selectSteamMoves = (state: RootState) => state.movements.steamMoves;
export const selectGameMovements = (state: RootState) => state.movements.selectedGameMovements;
export const selectMovementStats = (state: RootState) => state.movements.statistics;
export const selectMovementLoading = (state: RootState) => state.movements.loading;
export const selectMovementError = (state: RootState) => state.movements.error;
export const selectSteamMovesCount = (state: RootState) => state.movements.steamMovesCount;

export default movementSlice.reducer;
