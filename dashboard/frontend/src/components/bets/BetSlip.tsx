import React, { useState } from 'react';
import { useBetSlip } from '../../hooks/useBetSlip';
import BetLegItem from './BetLegItem';
import TeaserControl from './TeaserControl';
import ParlayValidator from '../analytics/ParlayValidator';
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
  const [previousLegsCount, setPreviousLegsCount] = useState(0);
  const [oddsBoostPercentage, setOddsBoostPercentage] = useState(0);

  // Auto-expand bet slip when legs are added (but allow manual minimize)
  React.useEffect(() => {
    const totalLegs = legs.length + (futureLegs?.length || 0);
    // Only auto-expand when legs are actually added, not when user manually minimizes
    if (totalLegs > previousLegsCount && isMinimized) {
      setIsMinimized(false);
    }
    setPreviousLegsCount(totalLegs);
  }, [legs.length, futureLegs?.length]);

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

  // Leg accent dots cycle through the sunset palette by store index.
  const legDotColors = ['bg-gold', 'bg-ember', 'bg-plum'];

  // Calculate boosted payout and odds
  // Boost applies to PROFIT, not odds multiplier
  const { boostedCombinedOdds, boostedPotentialPayout, boostedPotentialProfit } = React.useMemo(() => {
    if (oddsBoostPercentage === 0) {
      return {
        boostedCombinedOdds: combinedOdds,
        boostedPotentialPayout: potentialPayout,
        boostedPotentialProfit: potentialPayout - stake
      };
    }

    // Calculate original profit
    const originalProfit = potentialPayout - stake;

    // Boost the profit by percentage
    const boostedProfit = originalProfit * (1 + oddsBoostPercentage / 100);
    const boostedPayout = stake + boostedProfit;

    // Back-calculate odds needed for boosted payout
    const boostedDecimal = boostedPayout / stake;
    const boostedAmerican = boostedDecimal >= 2.0
      ? Math.round((boostedDecimal - 1) * 100)
      : Math.round(-100 / (boostedDecimal - 1));

    return {
      boostedCombinedOdds: boostedAmerican,
      boostedPotentialPayout: boostedPayout,
      boostedPotentialProfit: boostedProfit
    };
  }, [combinedOdds, potentialPayout, stake, oddsBoostPercentage]);

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

    // For parlay boost, DON'T boost individual legs - only the combined odds
    // Pass boostedCombinedOdds to backend which will apply it to the entire parlay
    const oddsToSubmit = oddsBoostPercentage > 0 ? boostedCombinedOdds : undefined;

    if (oddsBoostPercentage > 0 && import.meta.env.DEV) {
      // Dev-only: keep visibility into the boost math without shipping
      // these logs to production users.
      console.log(
        `Parlay boost +${oddsBoostPercentage}%: ` +
        `${combinedOdds} → ${oddsToSubmit}, ` +
        `$${potentialPayout.toFixed(2)} → $${boostedPotentialPayout.toFixed(2)}`
      );
    }

    // Submit with boosted combined odds (bypasses Redux state entirely)
    const success = await submitBet({
      name: betName.trim(),
      boostedCombinedOdds: oddsToSubmit
    });

    if (success) {
      setBetName('');
      setOddsBoostPercentage(0); // Reset boost slider
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      // Clear selections in parent component
      if (onClear) {
        onClear();
      }
    }
  };

  // Minimized state - show pixel art bet slip icon
  if (isMinimized) {
    const totalLegs = legs.length + (futureLegs?.length || 0);
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 shadow-2xl hover:scale-110 transition-all z-50 block"
        title={`Bet Slip (${totalLegs} ${totalLegs === 1 ? 'selection' : 'selections'})`}
      >
        <div className="relative">
          <img
            src="/betslip.png"
            alt="Bet Slip"
            className="w-20 h-20 block"
          />
          {totalLegs > 0 && (
            <span className="absolute -top-2 -right-2 bg-gold text-dusk rounded-full w-7 h-7 flex items-center justify-center font-display text-[10px] border-2 border-dusk-shadow shadow-lg">
              {totalLegs}
            </span>
          )}
        </div>
      </button>
    );
  }

  // Empty state - show empty message
  if ((legs.length === 0 && (!futureLegs || futureLegs.length === 0))) {

    return (
      <div className="fixed bottom-4 right-4 w-96 ds-panel-lg p-6 text-center z-50 relative">
        <button
          onClick={() => setIsMinimized(true)}
          className="absolute top-3 right-3 font-display text-[9px] text-cream-faint hover:text-cream transition-colors"
          title="Minimize"
        >
          ×
        </button>
        <div className="text-4xl mb-3">🎟️</div>
        <h3 className="font-display text-[11px] text-cream mb-3">
          Bet Slip Empty
        </h3>
        <p className="font-body text-sm text-cream-muted">
          Click on any odds to add them to your bet slip
        </p>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 ds-panel-lg overflow-hidden flex flex-col max-h-[80vh] z-50">
      {/* Sunset stripe cap */}
      <div className="flex h-1.5 shrink-0">
        <div className="flex-1 bg-gold" />
        <div className="flex-1 bg-ember" />
        <div className="flex-1 bg-coral" />
        <div className="flex-1 bg-plum" />
      </div>

      {/* Header */}
      <div className="px-[18px] pt-4 pb-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-[11px] text-cream">BET SLIP</h3>
          <span className="font-display text-[8px] text-dusk bg-gold px-2 py-1.5">
            {legs.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleClearSlip}
            className="font-display text-[7px] text-cream-faint hover:text-cream transition-colors"
          >
            CLEAR ALL
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="font-display text-[9px] text-cream-faint hover:text-cream transition-colors"
            title="Minimize"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Success Message */}
        {showSuccess && (
          <div className="mx-[18px] mt-3 bg-dusk-panel2 shadow-[0_0_0_2px_#6cbf67_inset] px-3 py-2.5">
            <p className="font-body text-sm text-cream font-medium">
              ✅ Bet placed successfully!
            </p>
          </div>
        )}

        {/* Error Message */}
        {submitError && (
          <div className="mx-[18px] mt-3 bg-dusk-panel2 shadow-[0_0_0_2px_#ef5350_inset] px-3 py-2.5">
            <p className="font-body text-sm text-coral">{submitError}</p>
          </div>
        )}

        {/* Bet Type Tabs */}
        <div className="flex gap-1 px-[18px] pt-3.5">
          <button
            onClick={() => setBetType('single')}
            disabled={legs.length > 1}
            className={`
              flex-1 text-center font-display text-[7px] py-2.5 transition-all
              ${
                betType === 'single'
                  ? 'bg-gold text-dusk shadow-[0_3px_0_#8a5a10]'
                  : 'bg-dusk-panel2 text-cream-muted'
              }
              ${legs.length > 1 ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            SINGLE
          </button>
          <button
            onClick={() => setBetType('parlay')}
            disabled={legs.length < 2}
            className={`
              flex-1 text-center font-display text-[7px] py-2.5 transition-all
              ${
                betType === 'parlay'
                  ? 'bg-gold text-dusk shadow-[0_3px_0_#8a5a10]'
                  : 'bg-dusk-panel2 text-cream-muted'
              }
              ${legs.length < 2 ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            PARLAY
          </button>
          <button
            onClick={() => setBetType('teaser')}
            disabled={legs.length < 2}
            className={`
              flex-1 text-center font-display text-[7px] py-2.5 transition-all
              ${
                betType === 'teaser'
                  ? 'bg-gold text-dusk shadow-[0_3px_0_#8a5a10]'
                  : 'bg-dusk-panel2 text-cream-muted'
              }
              ${legs.length < 2 ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            TEASER
          </button>
        </div>

        <div className="px-[18px] py-4 space-y-4">
          {/* Teaser Control */}
          {betType === 'teaser' && (
            <TeaserControl
              legs={legs}
              selectedPoints={teaserPoints}
              onChange={setTeaserPoints}
            />
          )}

          {/* Legs */}
          <div className="flex flex-col gap-2">
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
                <div key={`sgp-${gameId}`} className="bg-dusk-panel2 shadow-[0_0_0_2px_#6d4a9e_inset] p-3.5">
                  {/* SGP Header with Combined Odds */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-plum font-display text-[10px]">⚡</span>
                        <span className="font-display text-[7px] text-cream tracking-wide">
                          SAME GAME PARLAY
                        </span>
                        <span className="font-display text-[6px] text-cream-secondary bg-dusk px-1.5 py-0.5">
                          {legsWithIndex.length} legs
                        </span>
                      </div>
                      <div className="font-body text-xs text-cream-muted truncate">{gameName}</div>
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
                            className="w-20 px-2 py-1.5 font-display text-[10px] bg-dusk shadow-[0_0_0_2px_#6d4a9e_inset] focus:outline-none focus:shadow-[0_0_0_2px_#fcc63a_inset] text-cream text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                            className="text-cream hover:text-cream p-1 bg-dusk transition-colors"
                            title="Apply"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setEditingSGPGame(null)}
                            className="text-coral hover:text-cream p-1 bg-dusk transition-colors"
                            title="Cancel"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="font-display text-[10px] text-gold bg-dusk px-2.5 py-1">
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
                            className="text-cream-faint hover:text-gold p-1.5 bg-dusk transition-colors"
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
                        dotColorClass={legDotColors[index % legDotColors.length]}
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
                dotColorClass={legDotColors[index % legDotColors.length]}
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
                dotColorClass={legDotColors[index % legDotColors.length]}
              />
            ))}

            {/* Futures Legs */}
            {futureLegs && futureLegs.length > 0 && (
              <div className="border-t-2 border-dusk-panel2 pt-4 mt-2">
                <h3 className="font-display text-[7px] text-cream tracking-wide mb-3 flex items-center">
                  <svg className="w-4 h-4 mr-2 text-cream-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  FUTURES BETS
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
                      className="bg-dusk-panel2 shadow-[0_0_0_2px_#43306a_inset] p-3 mb-2"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="font-display text-[6px] text-cream-faint tracking-wide mb-1">
                            {futureLeg.sportKey?.replace(/_/g, ' ')}
                          </div>
                          <div className="font-body font-semibold text-cream mb-1">
                            {futureLeg.futureTitle}
                          </div>
                          <div className="font-body text-sm text-cream-muted">
                            {futureLeg.outcome}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={isEditing ? cancelEditingFuture : startEditingFuture}
                            className="text-cream-faint hover:text-gold transition-colors p-1"
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
                            className="text-cream-faint hover:text-coral transition-colors p-1"
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
                          <div className="font-display text-[13px] text-gold">
                            {formatOdds(currentOdds, useDecimalOdds)}
                            {futureLeg.userAdjustedOdds && futureLeg.userAdjustedOdds !== futureLeg.odds && (
                              <span className="font-body text-xs text-cream-secondary ml-2 font-normal">(adjusted)</span>
                            )}
                          </div>
                          {futureLeg.userAdjustedOdds && futureLeg.userAdjustedOdds !== futureLeg.odds && (
                            <button
                              onClick={() => updateFutureLeg(futureLeg.futureId, { userAdjustedOdds: undefined })}
                              className="font-body text-xs text-cream-secondary hover:text-cream hover:underline"
                            >
                              Reset Odds
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 mt-2">
                          <div>
                            <label className="block font-display text-[6px] text-cream-faint tracking-wide mb-1">
                              Odds ({useDecimalOdds ? 'Decimal' : 'American'})
                            </label>
                            <div className="flex gap-1">
                              <button
                                onClick={() => adjustFutureOdds(-1)}
                                className="px-3 py-1.5 bg-dusk hover:bg-dusk-ring text-cream font-bold transition-colors"
                                title={useDecimalOdds ? "Decrease by 0.05" : "Decrease by 5"}
                              >
                                -
                              </button>
                              <input
                                type="text"
                                inputMode="decimal"
                                aria-label="Future bet odds"
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
                                className="flex-1 px-3 py-1.5 text-sm bg-dusk shadow-[0_0_0_2px_#43306a_inset] focus:outline-none focus:shadow-[0_0_0_2px_#fcc63a_inset] text-cream"
                              />
                              <button
                                onClick={() => adjustFutureOdds(1)}
                                className="px-3 py-1.5 bg-dusk hover:bg-dusk-ring text-cream font-bold transition-colors"
                                title={useDecimalOdds ? "Increase by 0.05" : "Increase by 5"}
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={applyFutureOdds}
                            className="w-full px-3 py-1.5 bg-plum text-cream text-sm font-medium hover:brightness-110 transition-all"
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

          {/* Correlation check (parlays with 2+ game legs) */}
          {betType === 'parlay' && <ParlayValidator legs={legs} useDecimalOdds={useDecimalOdds} />}

          {/* Bet Name */}
          <div>
            <label className="block font-display text-[7px] text-cream-faint tracking-[.08em] mb-1.5">
              BET NAME *
            </label>
            <input
              type="text"
              value={betName}
              onChange={(e) => setBetName(e.target.value)}
              placeholder="e.g., Sunday Parlay"
              maxLength={100}
              className="w-full px-3 py-2 bg-dusk shadow-[0_0_0_2px_#43306a_inset] font-body text-sm text-cream placeholder:text-cream-faint focus:outline-none focus:shadow-[0_0_0_2px_#fcc63a_inset] transition-shadow"
            />
          </div>

          {/* Odds Boost Slider */}
          <div className="bg-dusk-panel2 shadow-[0_0_0_2px_#8a5a10_inset] p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <label className="font-display text-[7px] text-gold tracking-[.06em]">
                  ODDS BOOST
                </label>
              </div>
              <span className="font-display text-[11px] text-gold">
                +{oddsBoostPercentage}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={oddsBoostPercentage}
              onChange={(e) => setOddsBoostPercentage(parseInt(e.target.value))}
              className="w-full h-2 bg-dusk rounded-lg appearance-none cursor-pointer accent-gold"
              aria-label="Odds boost percentage"
              style={{
                background: `linear-gradient(to right, #fcc63a 0%, #fcc63a ${oddsBoostPercentage}%, #1d1130 ${oddsBoostPercentage}%, #1d1130 100%)`
              }}
            />
            <div className="flex justify-between font-body text-[10px] text-cream-faint mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
            {oddsBoostPercentage > 0 && (
              <div className="mt-3 p-2 bg-dusk font-body text-xs text-cream-muted">
                <div className="flex justify-between mb-1">
                  <span>Original odds:</span>
                  <span className="font-display text-[9px] text-cream">{formatOdds(combinedOdds, useDecimalOdds)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Boosted odds:</span>
                  <span className="font-display text-[9px] text-gold">{formatOdds(boostedCombinedOdds, useDecimalOdds)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer - Odds & Submit */}
      <div className="px-[18px] pb-4.5 shrink-0">
        {/* Combined Odds */}
        <div className="flex justify-between items-center font-body text-[13px] text-cream-muted py-2.5 border-t-2 border-dusk-panel2">
          <span>Combined odds</span>
          <div className="flex items-center gap-2">
            {oddsBoostPercentage > 0 && (
              <span className="font-body text-xs text-cream-faint line-through">
                {formatOdds(combinedOdds, useDecimalOdds)}
              </span>
            )}
            <span className="font-display text-[10px] text-cream">
              {combinedOdds ? formatOdds(oddsBoostPercentage > 0 ? boostedCombinedOdds : combinedOdds, useDecimalOdds) : '—'}
            </span>
            {oddsBoostPercentage > 0 && (
              <span className="font-display text-[7px] bg-gold text-dusk px-1.5 py-0.5">+{oddsBoostPercentage}%</span>
            )}
          </div>
        </div>

        {/* Stake / To Win */}
        <div className="flex gap-2.5 mt-1.5">
          <div className="flex-1 bg-dusk px-3 py-2.5 shadow-[0_0_0_2px_#43306a_inset]">
            <label className="block font-display text-[6px] text-cream-faint tracking-[.1em]">STAKE</label>
            <div className="relative mt-1 flex items-baseline">
              <span className="font-body text-[18px] font-bold text-cream-faint">$</span>
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
                className="w-full bg-transparent border-0 outline-none font-body text-[18px] font-bold text-cream [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="flex-1 bg-dusk px-3 py-2.5 shadow-[0_0_0_2px_#8a5a10_inset]">
            <label className="block font-display text-[6px] text-gold tracking-[.1em]">TO WIN</label>
            <div className="font-display text-[15px] text-gold mt-1.5">
              {stake > 0 ? formatCurrency(oddsBoostPercentage > 0 ? boostedPotentialPayout : potentialPayout) : '$0.00'}
            </div>
            <div className="font-body text-[10px] text-cream-faint mt-1">
              Profit: {stake > 0 ? formatCurrency(oddsBoostPercentage > 0 ? boostedPotentialProfit : potentialProfit) : '$0.00'}
            </div>
          </div>
        </div>

        {/* Quick Stakes */}
        <div className="grid grid-cols-3 gap-1.5 mt-2.5">
          {quickStakes.map((amount) => (
            <button
              key={amount}
              onClick={() => setStake(amount)}
              className="px-2 py-1.5 bg-dusk-panel2 hover:bg-dusk-ring text-cream-muted font-display text-[7px] transition-colors"
            >
              ${amount}
            </button>
          ))}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || !betName.trim() || isSubmitting}
          className={`
            w-full mt-3.5 font-display text-[10px] py-4 text-center transition-all
            ${
              isValid && betName.trim() && !isSubmitting
                ? 'ds-btn-press'
                : 'bg-dusk-panel2 text-cream-faint cursor-not-allowed'
            }
          `}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Placing Bet...
            </span>
          ) : (
            'Place Bet'
          )}
        </button>

        {/* Disclaimer */}
        <div className="flex items-center justify-center gap-2 mt-3 font-body text-[11px] text-cream-faint">
          <img src="/animations/coin.gif" alt="" className="w-3.5 h-3.5" />
          <span>Tracking only — logged to your ledger, no money moves.</span>
        </div>

        {/* Validation Messages */}
        {!betName.trim() && legs.length > 0 && (
          <p className="font-body text-xs text-coral text-center mt-2">
            Bet name is required
          </p>
        )}
        {stake <= 0 && legs.length > 0 && (
          <p className="font-body text-xs text-coral text-center mt-1">
            Enter stake amount
          </p>
        )}
      </div>
    </div>
  );
}
