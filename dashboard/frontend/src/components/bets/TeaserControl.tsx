import React from 'react';
import { BetLeg } from '../../types/game.types';

interface TeaserControlProps {
  legs: BetLeg[];
  selectedPoints: number;
  onChange: (points: number) => void;
}

/**
 * Get sport from legs (assumes all legs are same sport for teasers)
 */
function getSportFromLegs(legs: BetLeg[]): 'nfl' | 'nba' | 'unknown' {
  if (legs.length === 0) return 'unknown';

  const firstGame = legs[0]?.game;
  if (!firstGame) return 'unknown';

  const sportKey = firstGame.sportKey.toLowerCase();

  if (sportKey.includes('nfl') || sportKey.includes('football')) {
    return 'nfl';
  }
  if (sportKey.includes('nba') || sportKey.includes('basketball')) {
    return 'nba';
  }

  return 'unknown';
}

/**
 * Get available teaser points for sport
 */
function getTeaserOptions(sport: 'nfl' | 'nba' | 'unknown'): number[] {
  if (sport === 'nfl') {
    return [6, 6.5, 7];
  }
  if (sport === 'nba') {
    return [4, 4.5, 5];
  }
  return [6]; // Default
}

/**
 * Get teaser odds for given points
 */
function getTeaserOdds(sport: 'nfl' | 'nba' | 'unknown', points: number): number {
  // Standard teaser odds
  if (sport === 'nfl') {
    if (points === 6) return -110;
    if (points === 6.5) return -120;
    if (points === 7) return -130;
  }
  if (sport === 'nba') {
    if (points === 4) return -110;
    if (points === 4.5) return -115;
    if (points === 5) return -120;
  }
  return -110; // Default
}

export default function TeaserControl({
  legs,
  selectedPoints,
  onChange
}: TeaserControlProps) {
  const sport = getSportFromLegs(legs);
  const options = getTeaserOptions(sport);
  const odds = getTeaserOdds(sport, selectedPoints);

  if (sport === 'unknown') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <p className="text-sm text-yellow-800">
          ⚠️ Unable to determine sport. Add game legs first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Teaser Points ({sport.toUpperCase()})
        </label>
        <span className="text-xs text-gray-500">
          Odds: <span className="font-semibold">{odds}</span>
        </span>
      </div>

      <div className="flex gap-2">
        {options.map((points) => (
          <button
            key={points}
            onClick={() => onChange(points)}
            className={`
              flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-all
              ${
                selectedPoints === points
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            {points} pts
          </button>
        ))}
      </div>

      <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
        <strong>Note:</strong> Teaser adjusts spread/total by {selectedPoints} points in your favor.
        All legs must be spread or total bets.
      </div>
    </div>
  );
}
