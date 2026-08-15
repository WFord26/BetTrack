import React, { useState } from 'react';
import { BetLeg } from '../../types/game.types';
import { formatOdds, formatSpread, formatTotal, americanToDecimal, decimalToAmerican } from '../../utils/format';

interface BetLegItemProps {
  leg: BetLeg;
  index: number;
  onRemove: (index: number) => void;
  onUpdate: (index: number, updates: Partial<BetLeg>) => void;
  showTeaser?: boolean;
  teaserPoints?: number;
  useDecimalOdds?: boolean;
  /** Tailwind bg-* class for the per-leg accent dot. Cycled by the parent from the sunset palette. */
  dotColorClass?: string;
}

export default function BetLegItem({
  leg,
  index,
  onRemove,
  onUpdate,
  showTeaser = false,
  teaserPoints = 0,
  useDecimalOdds = false,
  dotColorClass = 'bg-gold'
}: BetLegItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editLine, setEditLine] = useState(leg.line?.toString() || '');
  const [editOdds, setEditOdds] = useState(leg.odds.toString());
  const [editOddsDisplay, setEditOddsDisplay] = useState('');

  // Handle odds increment/decrement based on format
  const adjustOdds = (delta: number) => {
    const currentOdds = parseInt(editOdds) || 0;

    if (useDecimalOdds) {
      // For decimal odds, adjust by 0.05 increments (delta is 1 or -1)
      const decimal = americanToDecimal(currentOdds);
      const newDecimal = Math.max(1.01, +(decimal + (delta * 0.05)).toFixed(2));
      const newAmerican = decimalToAmerican(newDecimal);
      setEditOdds(newAmerican.toString());
      setEditOddsDisplay(newDecimal.toFixed(2));
    } else {
      // For American odds, adjust by 5 point increments
      let newOdds = currentOdds + (delta * 5);

      // Handle crossing the -100 to +100 boundary
      if (currentOdds < -100 && newOdds > -100) {
        newOdds = 100;
      } else if (currentOdds > 100 && newOdds < 100) {
        newOdds = -100;
      } else if (newOdds > -100 && newOdds < 100) {
        // Snap to nearest valid value
        newOdds = delta > 0 ? 100 : -100;
      }

      setEditOdds(newOdds.toString());
      setEditOddsDisplay(newOdds.toString());
    }
  };

  // Format selection display
  const getSelectionDisplay = () => {
    const parts: string[] = [];

    // Team name (if applicable)
    if (leg.teamName) {
      parts.push(leg.teamName);
    }

    // Selection type and value
    if (leg.selectionType === 'moneyline') {
      parts.push('ML');
    } else if (leg.selectionType === 'spread') {
      const line = leg.line || 0;
      const adjustedLine = showTeaser
        ? leg.selection === 'home'
          ? line + teaserPoints
          : line - teaserPoints
        : line;
      parts.push(formatSpread(adjustedLine));
    } else if (leg.selectionType === 'total') {
      const line = leg.line || 0;
      const adjustedLine = showTeaser
        ? leg.selection === 'over'
          ? line - teaserPoints
          : line + teaserPoints
        : line;
      parts.push(`${leg.selection === 'over' ? 'O' : 'U'} ${formatTotal(adjustedLine)}`);
    }

    return parts.join(' ');
  };

  // Get game name
  const getGameName = () => {
    if (leg.game) {
      return `${leg.game.awayTeamName} vs ${leg.game.homeTeamName}`;
    }
    // Fallback to gameName if game object not available
    if ((leg as any).gameName) {
      return (leg as any).gameName;
    }
    return 'Game';
  };

  // Handle apply edits
  const handleApply = () => {
    const updates: Partial<BetLeg> = {
      odds: parseInt(editOdds) || leg.odds
    };

    if (leg.selectionType === 'spread' || leg.selectionType === 'total') {
      updates.line = parseFloat(editLine) || leg.line;
    }

    onUpdate(index, updates);
    setIsEditing(false);
    setEditOddsDisplay('');
  };

  // Check if adjusted
  const isAdjusted = false; // TODO: Track original values to detect changes

  return (
    <div className="bg-dusk-panel2 px-3.5 py-3 space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${dotColorClass}`} />
            <span className="font-body text-[14px] font-semibold text-cream truncate">
              {getSelectionDisplay()}
            </span>
            {isAdjusted && (
              <span className="font-body text-xs text-cream-secondary font-normal">(adjusted)</span>
            )}
            {showTeaser && (
              <span className="font-display text-[6px] bg-plum text-cream px-1.5 py-0.5 font-normal">
                +{teaserPoints}
              </span>
            )}
            <span className="font-display text-[9px] text-gold ml-auto shrink-0">
              {formatOdds(leg.odds, useDecimalOdds)}
            </span>
          </div>
          <div className="font-body text-[12px] text-cream-muted mt-1.5 truncate pl-4">{getGameName()}</div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-cream-faint hover:text-gold transition-colors p-1"
            title="Edit"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button
            onClick={() => onRemove(index)}
            className="font-display text-[8px] text-cream-faint hover:text-coral transition-colors p-1"
            title="Remove"
            aria-label="Remove"
          >
            ×
          </button>
        </div>
      </div>

      {/* Edit Mode */}
      {isEditing && (
        <div className="space-y-3">
          {/* Line input for spread/total */}
          {(leg.selectionType === 'spread' || leg.selectionType === 'total') && (
            <div>
              <label htmlFor={`line-${leg.gameId}`} className="block font-display text-[6px] text-cream-faint tracking-wide mb-1">
                Line
              </label>
              <input
                id={`line-${leg.gameId}`}
                type="number"
                step="0.5"
                value={editLine}
                onChange={(e) => setEditLine(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-dusk shadow-[0_0_0_2px_#43306a_inset] focus:outline-none focus:shadow-[0_0_0_2px_#fcc63a_inset] text-cream"
              />
            </div>
          )}

          {/* Odds input */}
          <div>
            <label className="block font-display text-[6px] text-cream-faint tracking-wide mb-1">
              Odds ({useDecimalOdds ? 'Decimal' : 'American'})
            </label>
            <div className="flex gap-1">
              <button
                onClick={() => adjustOdds(-1)}
                className="px-3 py-1.5 bg-dusk hover:bg-dusk-ring text-cream font-bold transition-colors"
                title={useDecimalOdds ? "Decrease by 0.05" : "Decrease by 5"}
              >
                -
              </button>
              <input
                id={`odds-${leg.gameId}`}
                type="text"
                inputMode="decimal"
                aria-label="Odds value"
                value={editOddsDisplay || (useDecimalOdds ? americanToDecimal(parseInt(editOdds) || 0).toFixed(2) : editOdds)}
                onChange={(e) => {
                  const value = e.target.value;
                  setEditOddsDisplay(value);

                  if (useDecimalOdds) {
                    // Allow typing decimal values freely
                    const decimal = parseFloat(value);
                    if (!isNaN(decimal) && decimal >= 1.01) {
                      setEditOdds(decimalToAmerican(decimal).toString());
                    }
                  } else {
                    // Allow typing American odds freely (including negatives)
                    setEditOdds(value);
                  }
                }}
                onFocus={() => {
                  if (!editOddsDisplay) {
                    setEditOddsDisplay(useDecimalOdds ? americanToDecimal(parseInt(editOdds) || 0).toFixed(2) : editOdds);
                  }
                }}
                className="flex-1 px-3 py-1.5 text-sm bg-dusk shadow-[0_0_0_2px_#43306a_inset] focus:outline-none focus:shadow-[0_0_0_2px_#fcc63a_inset] text-cream [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => adjustOdds(1)}
                className="px-3 py-1.5 bg-dusk hover:bg-dusk-ring text-cream font-bold transition-colors"
                title={useDecimalOdds ? "Increase by 0.05" : "Increase by 5"}
              >
                +
              </button>
            </div>
          </div>

          <button
            onClick={handleApply}
            className="w-full px-3 py-1.5 bg-gold text-dusk font-display text-[8px] hover:brightness-95 transition-all"
          >
            APPLY CHANGES
          </button>
        </div>
      )}
    </div>
  );
}
