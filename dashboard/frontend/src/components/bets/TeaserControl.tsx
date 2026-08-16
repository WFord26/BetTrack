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
      <div className="bg-dusk-panel2 shadow-[0_0_0_2px_#8a5a10_inset] p-3">
        <p className="font-body text-sm text-gold">
          ⚠️ Unable to determine sport. Add game legs first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="font-display text-[7px] text-cream-faint tracking-[.06em]">
          TEASER POINTS ({sport.toUpperCase()})
        </label>
        <span className="font-body text-xs text-cream-muted">
          Odds: <span className="font-display text-[8px] text-gold">{odds}</span>
        </span>
      </div>

      <div className="flex gap-2">
        {options.map((points) => (
          <button
            key={points}
            onClick={() => onChange(points)}
            className={`
              flex-1 py-2.5 font-display text-[8px] transition-all
              ${
                selectedPoints === points
                  ? 'bg-gold text-dusk shadow-[0_3px_0_#8a5a10]'
                  : 'bg-dusk-panel2 text-cream-muted'
              }
            `}
          >
            {points} PTS
          </button>
        ))}
      </div>

      <div className="font-body text-xs text-cream-faint bg-dusk p-2">
        <strong className="text-cream-muted">Note:</strong> Teaser adjusts spread/total by {selectedPoints} points in your favor.
        All legs must be spread or total bets.
      </div>
    </div>
  );
}
