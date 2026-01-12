import React, { useState } from 'react';
import { useBetSlip } from '../../hooks/useBetSlip';
import BetLegItem from './BetLegItem';
import TeaserControl from './TeaserControl';
import { formatOdds, formatCurrency, americanToDecimal, decimalToAmerican } from '../../utils/format';

interface BetSlipProps {
  useDecimalOdds?: boolean;
  onClear?: () => void;
  onRemoveLeg?: (index: number) => void;
}

export default function BetSlip({ useDecimalOdds = false, onClear, onRemoveLeg }: BetSlipProps) {
  const {
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
    removeLeg,
    removeFutureLeg,
    updateLeg,
    updateFutureLeg,
    setBetType,
    setStake,
    setTeaserPoints,
    clearSlip,
    submitBet
  } = useBetSlip();

  const [betName, setBetName] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [stakeInput, setStakeInput] = useState('');
  const [editingFutureId, setEditingFutureId] = useState<string | null>(null);
  const [editFutureOdds, setEditFutureOdds] = useState('');
  const [editFutureOddsDecimal, setEditFutureOddsDecimal] = useState('');

  // Auto-expand bet slip when legs are added
  React.useEffect(() => {
    const totalLegs = legs.length + (futureLegs?.length || 0);
    if (totalLegs > 0 && isMinimized) {
      setIsMinimized(false);
    }
  }, [legs.length, futureLegs?.length, isMinimized]);

  // Sync stakeInput with stake changes from quick buttons
  React.useEffect(() => {
    if (stake > 0) {
      setStakeInput(stake.toString());
    } else if (stake === 0 && stakeInput === '') {
      // Keep empty when both are empty
    } else if (stake === 0) {
      setStakeInput('');
    }
  }, [stake]);

  // Detect SGP (Same Game Parlay) - multiple legs on same game
  const sgpInfo = React.useMemo(() => {
    if (betType !== 'parlay' || legs.length < 2) return null;

    const gameGroups = new Map<string, Array<{ leg: typeof legs[0]; index: number }>>();
    legs.forEach((leg, index) => {
      if (!gameGroups.has(leg.gameId)) {
        gameGroups.set(leg.gameId, []);
      }
      gameGroups.get(leg.gameId)!.push({ leg, index });
    });

    const sgpGames = new Map<string, Array<{ leg: typeof legs[0]; index: number }>>();
    const regularLegs: Array<{ leg: typeof legs[0]; index: number }> = [];

    gameGroups.forEach((legsWithIndex, gameId) => {
      if (legsWithIndex.length > 1) {
        // SGP group
        sgpGames.set(gameId, legsWithIndex);
      } else {
        // Regular single leg
        regularLegs.push(legsWithIndex[0]);
      }
    });

    if (sgpGames.size === 0) return null;

    return { sgpGames, regularLegs };
  }, [legs, betType]);

  // State for editing SGP odds
  const [editingSGPGame, setEditingSGPGame] = React.useState<string | null>(null);
  const [sgpOddsEdits, setSgpOddsEdits] = React.useState<Map<string, string>>(new Map());

  // Quick stake buttons
  const quickStakes = [10, 25, 50, 100, 250, 500];

  // Handle clear with callback
  const handleClearSlip = () => {
    clearSlip();
    if (onClear) {
      onClear();
    }
  };

  // Handle remove leg with callback
  const handleRemoveLeg = (index: number) => {
    removeLeg(index);
    if (onRemoveLeg) {
      onRemoveLeg(index);
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!isValid || !betName.trim()) return;

    const success = await submitBet({ name: betName.trim() });
    
    if (success) {
      setBetName('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      
      // Clear selections in parent component
      if (onClear) {
        onClear();
      }
    }
  };

  // Minimized state
  if (isMinimized) {
    const totalLegs = legs.length + (futureLegs?.length || 0);
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 text-white rounded-full shadow-2xl p-4 hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900 transition-all z-50 flex items-center gap-2"
        title={`Bet Slip (${totalLegs} ${totalLegs === 1 ? 'selection' : 'selections'})`}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        {totalLegs > 0 && (
          <span className="bg-white text-blue-700 dark:text-blue-800 rounded-full px-2.5 py-0.5 text-sm font-bold">
            {totalLegs}
          </span>
        )}
      </button>
    );
  }

  // Empty state - don't render if minimized
  if ((legs.length === 0 && (!futureLegs || futureLegs.length === 0))) {
    if (isMinimized) return null;
    
    return (
      <div className="fixed bottom-4 right-4 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 text-center z-50 border-2 border-blue-600 dark:border-blue-500">
        <button
          onClick={() => setIsMinimized(true)}
          className="absolute top-3 right-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Minimize"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <div className="text-4xl mb-3">🎟️</div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Bet Slip Empty
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Click on any odds to add them to your bet slip
        </p>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] z-50 border-2 border-blue-600 dark:border-blue-500">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 px-4 py-3 flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-lg">Bet Slip</h3>
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-semibold">
            {legs.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Minimize button */}
          <button
            onClick={() => setIsMinimized(true)}
            className="text-white/80 hover:text-white transition-colors p-1"
            title="Minimize"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={handleClearSlip}
            className="text-white/80 hover:text-white transition-colors text-sm font-medium"
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Success Message */}
        {showSuccess && (
          <div className="m-4 bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-800 font-medium">
              ✅ Bet placed successfully!
            </p>
          </div>
        )}

        {/* Error Message */}
        {submitError && (
          <div className="m-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">{submitError}</p>
          </div>
        )}

        <div className="p-4 space-y-4">
          {/* Bet Type Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setBetType('single')}
              disabled={legs.length > 1}
              className={`
                flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all
                ${
                  betType === 'single'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
                ${legs.length > 1 ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              Single
            </button>
            <button
              onClick={() => setBetType('parlay')}
              disabled={legs.length < 2}
              className={`
                flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all
                ${
                  betType === 'parlay'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
                ${legs.length < 2 ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              Parlay
            </button>
            <button
              onClick={() => setBetType('teaser')}
              disabled={legs.length < 2}
              className={`
                flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all
                ${
                  betType === 'teaser'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
                ${legs.length < 2 ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              Teaser
            </button>
          </div>

          {/* Teaser Control */}
          {betType === 'teaser' && (
            <TeaserControl
              legs={legs}
              selectedPoints={teaserPoints}
              onChange={setTeaserPoints}
            />
          )}

          {/* Legs */}
          <div className="space-y-3">
            {/* SGP Groups */}
            {sgpInfo?.sgpGames && Array.from(sgpInfo.sgpGames.entries()).map(([gameId, legsWithIndex]) => {
              const firstLeg = legsWithIndex[0].leg;
              const gameName = firstLeg.game 
                ? `${firstLeg.game.awayTeamName} vs ${firstLeg.game.homeTeamName}`
                : 'Same Game';
              
              // Calculate combined SGP odds with smart logic
              // Check if any leg has userAdjustedOdds - if so, use those for display
              const hasUserAdjustedOdds = legsWithIndex.some(({ leg }) => leg.userAdjustedOdds !== undefined);
              
              let combinedSgpOdds: number;
              let americanSgpOdds: number;
              
              if (hasUserAdjustedOdds) {
                // At least one leg has adjusted odds - recalculate from userAdjustedOdds or original odds
                combinedSgpOdds = legsWithIndex.reduce((total, { leg }) => {
                  const oddsToUse = leg.userAdjustedOdds ?? leg.odds;
                  const decimalOdds = oddsToUse > 0 ? 1 + oddsToUse / 100 : 1 + 100 / Math.abs(oddsToUse);
                  return total * decimalOdds;
                }, 1);
                americanSgpOdds = combinedSgpOdds >= 2 
                  ? Math.round((combinedSgpOdds - 1) * 100)
                  : Math.round(-100 / (combinedSgpOdds - 1));
              } else {
                // No adjustments - apply smart SGP logic
                const mlLeg = legsWithIndex.find(({ leg }) => leg.selectionType === 'moneyline');
                const spreadLeg = legsWithIndex.find(({ leg }) => leg.selectionType === 'spread');
                const totalLegs = legsWithIndex.filter(({ leg }) => leg.selectionType === 'total');
                
                // Determine which legs to multiply
                const legsToMultiply: typeof legsWithIndex = [];
                
                // If both ML and Spread exist for same team, use only the higher odds
                if (mlLeg && spreadLeg && mlLeg.leg.selection === spreadLeg.leg.selection) {
                  const mlDecimal = mlLeg.leg.odds > 0 ? 1 + mlLeg.leg.odds / 100 : 1 + 100 / Math.abs(mlLeg.leg.odds);
                  const spreadDecimal = spreadLeg.leg.odds > 0 ? 1 + spreadLeg.leg.odds / 100 : 1 + 100 / Math.abs(spreadLeg.leg.odds);
                  
                  // Use higher odds leg
                  if (mlDecimal >= spreadDecimal) {
                    legsToMultiply.push(mlLeg);
                  } else {
                    legsToMultiply.push(spreadLeg);
                  }
                  
                  // Add totals separately
                  legsToMultiply.push(...totalLegs);
                } else {
                  // Standard: multiply all legs
                  legsToMultiply.push(...legsWithIndex);
                }
                
                // Calculate combined odds from selected legs
                combinedSgpOdds = legsToMultiply.reduce((total, { leg }) => {
                  const decimalOdds = leg.odds > 0 ? 1 + leg.odds / 100 : 1 + 100 / Math.abs(leg.odds);
                  return total * decimalOdds;
                }, 1);
                americanSgpOdds = combinedSgpOdds >= 2 
                  ? Math.round((combinedSgpOdds - 1) * 100)
                  : Math.round(-100 / (combinedSgpOdds - 1));
              }

              const isEditingThisSGP = editingSGPGame === gameId;
              const defaultEditValue = useDecimalOdds 
                ? ((combinedSgpOdds).toFixed(2))
                : americanSgpOdds.toString();
              const editValue = sgpOddsEdits.get(gameId) || defaultEditValue;

              return (
                <div key={`sgp-${gameId}`} className="border-2 border-purple-500 dark:border-purple-600 rounded-lg bg-gradient-to-br from-purple-100 via-purple-50 to-pink-50 dark:from-purple-900/40 dark:via-purple-900/30 dark:to-pink-900/30 p-4 shadow-md">
                  {/* SGP Header with Combined Odds */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-purple-700 dark:text-purple-300 font-bold text-base">⚡</span>
                        <span className="text-sm font-bold text-purple-900 dark:text-purple-100 uppercase tracking-wide">
                          Same Game Parlay
                        </span>
                        <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-200/50 dark:bg-purple-800/50 px-2 py-0.5 rounded-full">
                          {legsWithIndex.length} legs
                        </span>
                      </div>
                      <div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{gameName}</div>
                    </div>
                    
                    {/* Editable Combined Odds */}
                    <div className="flex items-center gap-2 ml-3">
                      {isEditingThisSGP ? (
                        <>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={editValue}
                            onChange={(e) => {
                              const newMap = new Map(sgpOddsEdits);
                              newMap.set(gameId, e.target.value);
                              setSgpOddsEdits(newMap);
                            }}
                            className="w-20 px-2 py-1.5 text-sm font-bold border-2 border-purple-500 dark:border-purple-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder={useDecimalOdds ? "2.00" : "-110"}
                          />
                          <button
                            onClick={() => {
                              let americanOdds: number;
                              if (useDecimalOdds) {
                                const decimalValue = parseFloat(editValue);
                                if (!isNaN(decimalValue) && decimalValue >= 1) {
                                  // Convert decimal to American
                                  americanOdds = decimalValue >= 2.0
                                    ? Math.round((decimalValue - 1) * 100)
                                    : Math.round(-100 / (decimalValue - 1));
                                } else {
                                  return; // Invalid value
                                }
                              } else {
                                americanOdds = parseInt(editValue);
                                if (isNaN(americanOdds)) {
                                  return; // Invalid value
                                }
                              }
                              legsWithIndex.forEach(({ index }) => {
                                updateLeg(index, { userAdjustedOdds: americanOdds });
                              });
                              setEditingSGPGame(null);
                            }}
                            className="text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 p-1 bg-green-100 dark:bg-green-900/30 rounded transition-colors"
                            title="Apply"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setEditingSGPGame(null)}
                            className="text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 bg-red-100 dark:bg-red-900/30 rounded transition-colors"
                            title="Cancel"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-base font-bold text-purple-900 dark:text-purple-100 bg-purple-200/60 dark:bg-purple-800/60 px-3 py-1 rounded-lg">
                            {formatOdds(americanSgpOdds, useDecimalOdds)}
                          </span>
                          <button
                            onClick={() => {
                              setEditingSGPGame(gameId);
                              const newMap = new Map(sgpOddsEdits);
                              const initialValue = useDecimalOdds 
                                ? (combinedSgpOdds).toFixed(2)
                                : americanSgpOdds.toString();
                              newMap.set(gameId, initialValue);
                              setSgpOddsEdits(newMap);
                            }}
                            className="text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 p-1.5 bg-purple-200/60 dark:bg-purple-800/60 rounded-lg hover:bg-purple-300/60 dark:hover:bg-purple-700/60 transition-colors"
                            title="Edit combined odds"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* SGP Legs (nested) - now editable */}
                  <div className="space-y-2">
                    {legsWithIndex.map(({ leg, index }) => (
                      <BetLegItem
                        key={index}
                        leg={leg}
                        index={index}
                        onRemove={handleRemoveLeg}
                        onUpdate={updateLeg}
                        showTeaser={false}
                        teaserPoints={0}
                        useDecimalOdds={useDecimalOdds}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Regular Legs */}
            {sgpInfo ? sgpInfo.regularLegs.map(({ leg, index }) => (
              <BetLegItem
                key={index}
                leg={leg}
                index={index}
                onRemove={handleRemoveLeg}
                onUpdate={updateLeg}
                showTeaser={betType === 'teaser'}
                teaserPoints={teaserPoints}
                useDecimalOdds={useDecimalOdds}
              />
            )) : legs.map((leg, index) => (
              <BetLegItem
                key={index}
                leg={leg}
                index={index}
                onRemove={handleRemoveLeg}
                onUpdate={updateLeg}
                showTeaser={betType === 'teaser'}
                teaserPoints={teaserPoints}
                useDecimalOdds={useDecimalOdds}
              />
            ))}

            {/* Futures Legs */}
            {futureLegs && futureLegs.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Futures Bets
                </h3>
                {futureLegs.map((futureLeg) => {
                  const isEditing = editingFutureId === futureLeg.futureId;
                  const currentOdds = futureLeg.userAdjustedOdds ?? futureLeg.odds;
                  
                  const startEditingFuture = () => {
                    setEditingFutureId(futureLeg.futureId);
                    setEditFutureOdds(currentOdds.toString());
                    if (useDecimalOdds) {
                      setEditFutureOddsDecimal(americanToDecimal(currentOdds).toFixed(2));
                    }
                  };
                  
                  const cancelEditingFuture = () => {
                    setEditingFutureId(null);
                    setEditFutureOdds('');
                    setEditFutureOddsDecimal('');
                  };
                  
                  const applyFutureOdds = () => {
                    let newOdds: number;
                    if (useDecimalOdds) {
                      const decimal = parseFloat(editFutureOddsDecimal);
                      newOdds = !isNaN(decimal) && decimal >= 1.01 ? decimalToAmerican(decimal) : currentOdds;
                    } else {
                      newOdds = parseInt(editFutureOdds);
                      if (isNaN(newOdds)) {
                        newOdds = currentOdds;
                      }
                    }
                    updateFutureLeg(futureLeg.futureId, { userAdjustedOdds: newOdds });
                    setEditingFutureId(null);
                    setEditFutureOdds('');
                    setEditFutureOddsDecimal('');
                  };
                  
                  const adjustFutureOdds = (delta: number) => {
                    if (useDecimalOdds) {
                      const current = parseFloat(editFutureOddsDecimal) || 2.00;
                      const newDecimal = Math.max(1.01, +(current + (delta * 0.05)).toFixed(2));
                      setEditFutureOddsDecimal(newDecimal.toFixed(2));
                      setEditFutureOdds(decimalToAmerican(newDecimal).toString());
                    } else {
                      const currentEditOdds = parseInt(editFutureOdds) || 0;
                      let newOdds = currentEditOdds + (delta * 5);
                      
                      if (currentEditOdds < -100 && newOdds > -100) {
                        newOdds = 100;
                      } else if (currentEditOdds > 100 && newOdds < 100) {
                        newOdds = -100;
                      } else if (newOdds > -100 && newOdds < 100) {
                        newOdds = delta > 0 ? 100 : -100;
                      }
                      
                      setEditFutureOdds(newOdds.toString());
                    }
                  };
                  
                  return (
                    <div
                      key={futureLeg.futureId}
                      className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 mb-2 border border-purple-200 dark:border-purple-700"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                            {futureLeg.sportKey?.replace(/_/g, ' ')}
                          </div>
                          <div className="font-semibold text-gray-900 dark:text-white mb-1">
                            {futureLeg.futureTitle}
                          </div>
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            {futureLeg.outcome}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={isEditing ? cancelEditingFuture : startEditingFuture}
                            className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-1"
                            title={isEditing ? "Cancel" : "Edit"}
                          >
                            {isEditing ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => removeFutureLeg(futureLeg.futureId)}
                            className="text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors p-1"
                            title="Remove future"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      
                      {!isEditing ? (
                        <div className="flex items-center justify-between">
                          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                            {formatOdds(currentOdds, useDecimalOdds)}
                            {futureLeg.userAdjustedOdds && futureLeg.userAdjustedOdds !== futureLeg.odds && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 ml-2 font-normal">(adjusted)</span>
                            )}
                          </div>
                          {futureLeg.userAdjustedOdds && futureLeg.userAdjustedOdds !== futureLeg.odds && (
                            <button
                              onClick={() => updateFutureLeg(futureLeg.futureId, { userAdjustedOdds: undefined })}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              Reset Odds
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 mt-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Odds ({useDecimalOdds ? 'Decimal' : 'American'})
                            </label>
                            <div className="flex gap-1">
                              <button
                                onClick={() => adjustFutureOdds(-1)}
                                className="px-3 py-1.5 bg-purple-200 dark:bg-purple-700 hover:bg-purple-300 dark:hover:bg-purple-600 text-purple-700 dark:text-white font-bold rounded transition-colors"
                                title={useDecimalOdds ? "Decrease by 0.05" : "Decrease by 5"}
                              >
                                -
                              </button>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={useDecimalOdds ? editFutureOddsDecimal : editFutureOdds}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (useDecimalOdds) {
                                    // Allow typing decimal values
                                    setEditFutureOddsDecimal(value);
                                    const decimal = parseFloat(value);
                                    if (!isNaN(decimal) && decimal >= 1.01) {
                                      setEditFutureOdds(decimalToAmerican(decimal).toString());
                                    }
                                  } else {
                                    setEditFutureOdds(value);
                                  }
                                }}
                                className="flex-1 px-3 py-1.5 text-sm border border-purple-300 dark:border-purple-600 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                              <button
                                onClick={() => adjustFutureOdds(1)}
                                className="px-3 py-1.5 bg-purple-200 dark:bg-purple-700 hover:bg-purple-300 dark:hover:bg-purple-600 text-purple-700 dark:text-white font-bold rounded transition-colors"
                                title={useDecimalOdds ? "Increase by 0.05" : "Increase by 5"}
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={applyFutureOdds}
                            className="w-full px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700 transition-colors"
                          >
                            Apply Changes
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bet Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bet Name *
            </label>
            <input
              type="text"
              value={betName}
              onChange={(e) => setBetName(e.target.value)}
              placeholder="e.g., Sunday Parlay"
              maxLength={100}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Stake */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Stake Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={stakeInput}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow empty, digits, and decimal point
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setStakeInput(value);
                    const numValue = parseFloat(value);
                    setStake(isNaN(numValue) || value === '' ? 0 : numValue);
                  }
                }}
                onBlur={() => {
                  // Format on blur if there's a value
                  if (stakeInput && stake > 0) {
                    setStakeInput(stake.toString());
                  }
                }}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0.00"
              />
            </div>

            {/* Quick Stakes */}
            <div className="grid grid-cols-3 gap-2 mt-2">
              {quickStakes.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setStake(amount)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded transition-colors"
                >
                  ${amount}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Odds & Submit */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
        {/* Combined Odds */}
        <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Combined Odds:</span>
          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {combinedOdds ? formatOdds(combinedOdds, useDecimalOdds) : '—'}
          </span>
        </div>

        {/* Potential Payout */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-lg p-4 border-2 border-green-200 dark:border-green-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-green-800 dark:text-green-300">Potential Payout:</span>
            <span className="text-2xl font-bold text-green-700 dark:text-green-400">
              {stake > 0 ? formatCurrency(potentialPayout) : '$0.00'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm pt-2 border-t border-green-200 dark:border-green-700/50">
            <span className="text-green-700 dark:text-green-400 font-medium">Profit:</span>
            <span className="font-bold text-green-800 dark:text-green-300">
              {stake > 0 ? formatCurrency(potentialProfit) : '$0.00'}
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || !betName.trim() || isSubmitting}
          className={`
            w-full py-3.5 rounded-lg font-bold text-white text-base transition-all shadow-md
            ${
              isValid && betName.trim() && !isSubmitting
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed opacity-60'
            }
          `}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Placing Bet...
            </span>
          ) : (
            'Place Bet'
          )}
        </button>

        {/* Validation Messages */}
        {!betName.trim() && legs.length > 0 && (
          <p className="text-xs text-red-600 text-center">
            Bet name is required
          </p>
        )}
        {stake <= 0 && legs.length > 0 && (
          <p className="text-xs text-red-600 text-center">
            Enter stake amount
          </p>
        )}
      </div>
    </div>
  );
}
