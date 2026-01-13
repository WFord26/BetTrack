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
}

export default function BetLegItem({
  leg,
  index,
  onRemove,
  onUpdate,
  showTeaser = false,
  teaserPoints = 0,
  useDecimalOdds = false
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
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{getGameName()}</div>
          <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
            {getSelectionDisplay()}
            {isAdjusted && (
              <span className="text-xs text-blue-600 font-normal">(adjusted)</span>
            )}
            {showTeaser && (
              <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-normal">
                +{teaserPoints}
              </span>
            )}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300">{formatOdds(leg.odds, useDecimalOdds)}</div>
        </div>

        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-1"
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
            className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1"
            title="Remove"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Edit Mode */}
      {isEditing && (
        <div className="space-y-3">
          {/* Line input for spread/total */}
          {(leg.selectionType === 'spread' || leg.selectionType === 'total') && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Line
              </label>
              <input
                type="number"
                step="0.5"
                value={editLine}
                onChange={(e) => setEditLine(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          )}

          {/* Odds input */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Odds ({useDecimalOdds ? 'Decimal' : 'American'})
            </label>
            <div className="flex gap-1">
              <button
                onClick={() => adjustOdds(-1)}
                className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-white font-bold rounded transition-colors"
                title={useDecimalOdds ? "Decrease by 0.05" : "Decrease by 5"}
              >
                -
              </button>
              <input
                type="text"
                inputMode="decimal"
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
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => adjustOdds(1)}
                className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-white font-bold rounded transition-colors"
                title={useDecimalOdds ? "Increase by 0.05" : "Increase by 5"}
              >
                +
              </button>
            </div>
          </div>

          <button
            onClick={handleApply}
            className="w-full px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
          >
            Apply Changes
          </button>
        </div>
      )}
    </div>
  );
}
