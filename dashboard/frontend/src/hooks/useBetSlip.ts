import { useSelector, useDispatch } from 'react-redux';
import { useState } from 'react';
import { RootState, AppDispatch } from '../store';
import {
  addLeg,
  removeLeg,
  updateLeg,
  setBetType,
  setStake,
  setTeaserPoints,
  clearSlip,
  selectLegs,
  selectFutureLegs,
  selectBetType,
  selectStake,
  selectTeaserPoints,
  selectCombinedOdds,
  selectPotentialPayout,
  selectPotentialProfit,
  selectIsValid,
  removeFutureLeg,
  updateFutureLeg
} from '../store/betSlipSlice';
import { BetLeg, FutureLeg } from '../types/game.types';
import api from '../services/api';

interface SubmitBetParams {
  name: string;
}

/**
 * Custom hook for bet slip operations
 */
export function useBetSlip() {
  const dispatch = useDispatch<AppDispatch>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Selectors
  const legs = useSelector(selectLegs);
  const futureLegs = useSelector(selectFutureLegs);
  const betType = useSelector(selectBetType);
  const stake = useSelector(selectStake);
  const teaserPoints = useSelector(selectTeaserPoints);
  const combinedOdds = useSelector(selectCombinedOdds);
  const potentialPayout = useSelector(selectPotentialPayout);
  const potentialProfit = useSelector(selectPotentialProfit);
  const isValid = useSelector(selectIsValid);

  // Actions
  const handleAddLeg = (leg: BetLeg) => {
    dispatch(addLeg(leg));
  };

  const handleRemoveLeg = (index: number) => {
    dispatch(removeLeg(index));
  };

  const handleUpdateLeg = (index: number, updates: Partial<BetLeg>) => {
    dispatch(updateLeg({ index, updates }));
  };

  const handleSetBetType = (type: 'single' | 'parlay' | 'teaser') => {
    dispatch(setBetType(type));
  };

  const handleSetStake = (amount: number) => {
    dispatch(setStake(amount));
  };

  const handleSetTeaserPoints = (points: number) => {
    dispatch(setTeaserPoints(points));
  };

  const handleClearSlip = () => {
    dispatch(clearSlip());
    setSubmitError(null);
  };

  /**
   * Submit bet to API
   */
  const submitBet = async ({ name }: SubmitBetParams): Promise<boolean> => {
    if (!isValid) {
      setSubmitError('Invalid bet configuration');
      return false;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Prepare bet data
      const betData: any = {
        name: name.trim(),
        betType,
        stake,
        legs: legs.map((leg) => ({
          gameId: leg.gameId,
          selectionType: leg.selectionType,
          selection: leg.selection,
          odds: leg.odds,
          line: leg.line
        }))
      };

      // Include futures legs if present
      if (futureLegs.length > 0) {
        betData.futureLegs = futureLegs.map((futureLeg) => ({
          futureId: futureLeg.futureId,
          outcome: futureLeg.outcome,
          odds: Math.round(futureLeg.userAdjustedOdds ?? futureLeg.odds),
          userAdjustedOdds: futureLeg.userAdjustedOdds ? Math.round(futureLeg.userAdjustedOdds) : undefined
        }));
      }

      // If teaser, include teaser points
      if (betType === 'teaser') {
        betData.teaserPoints = teaserPoints;
      }

      // Submit to API
      const response = await api.post('/bets', betData);

      // Clear slip on success
      handleClearSlip();

      return true;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || 'Failed to place bet';
      setSubmitError(errorMessage);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    // State
    legs,
    futureLegs,
    betType,
    stake,
    teaserPoints,
    combinedOdds,
    potentialPayout,
    potentialProfit,
    isValid,
    isSubmitting,
    submitError,

    // Actions
    addLeg: handleAddLeg,
    removeLeg: handleRemoveLeg,
    updateLeg: handleUpdateLeg,
    removeFutureLeg: (futureId: string) => dispatch(removeFutureLeg(futureId)),
    updateFutureLeg: (futureId: string, updates: Partial<FutureLeg>) => dispatch(updateFutureLeg({ futureId, updates })),
    setBetType: handleSetBetType,
    setStake: handleSetStake,
    setTeaserPoints: handleSetTeaserPoints,
    clearSlip: handleClearSlip,
    submitBet
  };
}
