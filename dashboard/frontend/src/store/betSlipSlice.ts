import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BetLeg, FutureLeg } from '../types/game.types';
import { RootState } from './index';

interface BetSlipState {
  legs: BetLeg[];
  futureLegs: FutureLeg[];
  betType: 'single' | 'parlay' | 'teaser';
  stake: number;
  teaserPoints: number;
}

const initialState: BetSlipState = {
  legs: [],
  futureLegs: [],
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

      // Auto-switch to parlay if more than 1 total leg
      const totalLegs = state.legs.length + state.futureLegs.length;
      if (totalLegs > 1 && state.betType === 'single') {
        state.betType = 'parlay';
      }
    },

    removeLeg: (state, action: PayloadAction<number>) => {
      state.legs.splice(action.payload, 1);

      // Auto-switch to single if 1 total leg left
      const totalLegs = state.legs.length + state.futureLegs.length;
      if (totalLegs <= 1 && state.betType !== 'single') {
        state.betType = 'single';
      }

      // Clear stake if no legs
      if (totalLegs === 0) {
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
      // Can't be single with multiple total legs
      const totalLegs = state.legs.length + state.futureLegs.length;
      if (action.payload === 'single' && totalLegs > 1) {
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
      state.futureLegs = [];
      state.betType = 'single';
      state.stake = 0;
      state.teaserPoints = 6;
    },

    addFutureLeg: (state, action: PayloadAction<FutureLeg>) => {
      // Check if future leg already exists
      const existingIndex = state.futureLegs.findIndex(
        (leg) =>
          leg.futureId === action.payload.futureId &&
          leg.outcome === action.payload.outcome
      );

      if (existingIndex !== -1) {
        // Replace existing future leg
        state.futureLegs[existingIndex] = action.payload;
      } else {
        // Add new future leg
        state.futureLegs.push(action.payload);
      }

      // Auto-switch to parlay if more than 1 total leg
      const totalLegs = state.legs.length + state.futureLegs.length;
      if (totalLegs > 1 && state.betType === 'single') {
        state.betType = 'parlay';
      }
    },

    removeFutureLeg: (state, action: PayloadAction<string>) => {
      const index = state.futureLegs.findIndex(leg => leg.futureId === action.payload);
      if (index !== -1) {
        state.futureLegs.splice(index, 1);
      }

      // Auto-switch to single if 1 total leg left
      const totalLegs = state.legs.length + state.futureLegs.length;
      if (totalLegs <= 1 && state.betType !== 'single') {
        state.betType = 'single';
      }

      // Clear stake if no legs
      if (totalLegs === 0) {
        state.stake = 0;
      }
    },

    updateFutureLeg: (
      state,
      action: PayloadAction<{ futureId: string; updates: Partial<FutureLeg> }>
    ) => {
      const { futureId, updates } = action.payload;
      const index = state.futureLegs.findIndex(leg => leg.futureId === futureId);
      if (index !== -1) {
        state.futureLegs[index] = { ...state.futureLegs[index], ...updates };
      }
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
  clearSlip,
  addFutureLeg,
  removeFutureLeg,
  updateFutureLeg
} = betSlipSlice.actions;

// Selectors
export const selectLegs = (state: RootState) => state.betSlip.legs;
export const selectFutureLegs = (state: RootState) => state.betSlip.futureLegs;
export const selectBetType = (state: RootState) => state.betSlip.betType;
export const selectStake = (state: RootState) => state.betSlip.stake;
export const selectTeaserPoints = (state: RootState) => state.betSlip.teaserPoints;

/**
 * Calculate combined odds based on bet type
 * Includes both game legs and futures legs
 */
export const selectCombinedOdds = (state: RootState): number => {
  const { legs, futureLegs, betType } = state.betSlip;

  const totalLegs = legs.length + futureLegs.length;
  if (totalLegs === 0) return 0;

  if (betType === 'single') {
    // Single bet - return first available leg odds
    if (legs.length > 0) {
      return legs[0]?.odds || 0;
    } else {
      return (futureLegs[0]?.userAdjustedOdds ?? futureLegs[0]?.odds) || 0;
    }
  }

  if (betType === 'parlay' || betType === 'teaser') {
    // Group game legs by gameId to detect Same Game Parlays (SGP)
    const gameGroups = new Map<string, typeof legs>();
    legs.forEach((leg) => {
      const gameId = leg.gameId;
      if (!gameGroups.has(gameId)) {
        gameGroups.set(gameId, []);
      }
      gameGroups.get(gameId)!.push(leg);
    });

    // Build effective odds array with smart SGP logic
    const effectiveOdds: number[] = [];
    
    // Process game legs
    gameGroups.forEach((gameLegs) => {
      if (gameLegs.length > 1) {
        // SGP detected - apply smart logic
        const mlLeg = gameLegs.find(leg => leg.selectionType === 'moneyline');
        const spreadLeg = gameLegs.find(leg => leg.selectionType === 'spread');
        const totalLegs = gameLegs.filter(leg => leg.selectionType === 'total');
        
        // If both ML and Spread exist for same team, use only the higher odds
        if (mlLeg && spreadLeg && mlLeg.selection === spreadLeg.selection) {
          const mlDecimal = mlLeg.odds > 0 ? 1 + mlLeg.odds / 100 : 1 + 100 / Math.abs(mlLeg.odds);
          const spreadDecimal = spreadLeg.odds > 0 ? 1 + spreadLeg.odds / 100 : 1 + 100 / Math.abs(spreadLeg.odds);
          
          // Use higher odds leg
          if (mlDecimal >= spreadDecimal) {
            effectiveOdds.push(mlLeg.odds);
          } else {
            effectiveOdds.push(spreadLeg.odds);
          }
          
          // Add totals separately
          totalLegs.forEach(leg => effectiveOdds.push(leg.odds));
        } else {
          // Standard: multiply all legs
          gameLegs.forEach((leg) => effectiveOdds.push(leg.odds));
        }
      } else {
        // Regular single leg on this game
        effectiveOdds.push(gameLegs[0].odds);
      }
    });

    // Add futures legs (always independent, never correlated)
    futureLegs.forEach((futureLeg) => {
      effectiveOdds.push(futureLeg.userAdjustedOdds ?? futureLeg.odds);
    });

    // Convert American odds to decimal for parlay calculation
    const decimalOdds = effectiveOdds.map((american) => {
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
  const { legs, futureLegs, stake, betType } = state.betSlip;
  const totalLegs = legs.length + futureLegs.length;

  // Must have at least one leg (game or future)
  if (totalLegs === 0) return false;

  // Must have stake
  if (stake <= 0) return false;

  // Single bets can only have 1 leg total
  if (betType === 'single' && totalLegs > 1) return false;

  // Parlays/teasers must have 2+ legs total
  if ((betType === 'parlay' || betType === 'teaser') && totalLegs < 2) return false;

  return true;
};

export default betSlipSlice.reducer;
