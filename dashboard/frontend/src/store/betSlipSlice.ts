import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BetLeg } from '../types/game.types';
import { RootState } from './index';

interface BetSlipState {
  legs: BetLeg[];
  betType: 'single' | 'parlay' | 'teaser';
  stake: number;
  teaserPoints: number;
}

const initialState: BetSlipState = {
  legs: [],
  betType: 'single',
  stake: 0,
  teaserPoints: 6
};

const betSlipSlice = createSlice({
  name: 'betSlip',
  initialState,
  reducers: {
    addLeg: (state, action: PayloadAction<BetLeg>) => {
      // Check if leg already exists (same game + selection type)
      const existingIndex = state.legs.findIndex(
        (leg) =>
          leg.gameId === action.payload.gameId &&
          leg.selectionType === action.payload.selectionType
      );

      if (existingIndex !== -1) {
        // Replace existing leg
        state.legs[existingIndex] = action.payload;
      } else {
        // Add new leg
        state.legs.push(action.payload);
      }

      // Auto-switch to parlay if more than 1 leg
      if (state.legs.length > 1 && state.betType === 'single') {
        state.betType = 'parlay';
      }
    },

    removeLeg: (state, action: PayloadAction<number>) => {
      state.legs.splice(action.payload, 1);

      // Auto-switch to single if 1 leg left
      if (state.legs.length <= 1 && state.betType !== 'single') {
        state.betType = 'single';
      }

      // Clear stake if no legs
      if (state.legs.length === 0) {
        state.stake = 0;
      }
    },

    updateLeg: (
      state,
      action: PayloadAction<{ index: number; updates: Partial<BetLeg> }>
    ) => {
      const { index, updates } = action.payload;
      if (state.legs[index]) {
        state.legs[index] = { ...state.legs[index], ...updates };
      }
    },

    setBetType: (state, action: PayloadAction<'single' | 'parlay' | 'teaser'>) => {
      // Can't be single with multiple legs
      if (action.payload === 'single' && state.legs.length > 1) {
        return;
      }
      state.betType = action.payload;
    },

    setStake: (state, action: PayloadAction<number>) => {
      state.stake = Math.max(0, action.payload);
    },

    setTeaserPoints: (state, action: PayloadAction<number>) => {
      state.teaserPoints = action.payload;
    },

    clearSlip: (state) => {
      state.legs = [];
      state.betType = 'single';
      state.stake = 0;
      state.teaserPoints = 6;
    }
  }
});

export const {
  addLeg,
  removeLeg,
  updateLeg,
  setBetType,
  setStake,
  setTeaserPoints,
  clearSlip
} = betSlipSlice.actions;

// Selectors
export const selectLegs = (state: RootState) => state.betSlip.legs;
export const selectBetType = (state: RootState) => state.betSlip.betType;
export const selectStake = (state: RootState) => state.betSlip.stake;
export const selectTeaserPoints = (state: RootState) => state.betSlip.teaserPoints;

/**
 * Calculate combined odds based on bet type
 */
export const selectCombinedOdds = (state: RootState): number => {
  const { legs, betType } = state.betSlip;

  if (legs.length === 0) return 0;

  if (betType === 'single') {
    return legs[0]?.odds || 0;
  }

  if (betType === 'parlay' || betType === 'teaser') {
    // Convert American odds to decimal for parlay calculation
    const decimalOdds = legs.map((leg) => {
      const american = leg.odds;
      if (american > 0) {
        return 1 + american / 100;
      } else {
        return 1 + 100 / Math.abs(american);
      }
    });

    // Multiply all decimal odds
    const combinedDecimal = decimalOdds.reduce((acc, odds) => acc * odds, 1);

    // Convert back to American
    if (combinedDecimal >= 2) {
      return Math.round((combinedDecimal - 1) * 100);
    } else {
      return Math.round(-100 / (combinedDecimal - 1));
    }
  }

  return 0;
};

/**
 * Calculate potential payout
 */
export const selectPotentialPayout = (state: RootState): number => {
  const { stake } = state.betSlip;
  const odds = selectCombinedOdds(state);

  if (stake <= 0 || odds === 0) return 0;

  // Calculate payout based on American odds
  if (odds > 0) {
    return stake + (stake * odds) / 100;
  } else {
    return stake + (stake * 100) / Math.abs(odds);
  }
};

/**
 * Calculate potential profit
 */
export const selectPotentialProfit = (state: RootState): number => {
  const payout = selectPotentialPayout(state);
  const stake = state.betSlip.stake;
  return payout - stake;
};

/**
 * Check if bet slip is valid for submission
 */
export const selectIsValid = (state: RootState): boolean => {
  const { legs, stake, betType } = state.betSlip;

  // Must have at least one leg
  if (legs.length === 0) return false;

  // Must have stake
  if (stake <= 0) return false;

  // Single bets can only have 1 leg
  if (betType === 'single' && legs.length > 1) return false;

  // Parlays/teasers must have 2+ legs
  if ((betType === 'parlay' || betType === 'teaser') && legs.length < 2) return false;

  return true;
};

export default betSlipSlice.reducer;
