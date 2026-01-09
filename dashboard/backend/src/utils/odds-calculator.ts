import { BetLegOdds, BetOutcome, BetSelection, Sport } from '../types/betting.types';

/**
 * Odds Calculator Utility
 * 
 * Provides comprehensive betting mathematics including:
 * - Odds format conversions
 * - Payout calculations
 * - Teaser adjustments
 * - Bet outcome settlement
 */

// ============================================================================
// ODDS CONVERSION
// ============================================================================

/**
 * Convert American odds to decimal format
 * 
 * @param american - American odds (e.g., -110, +150)
 * @returns Decimal odds (e.g., 1.91, 2.50)
 * 
 * @example
 * americanToDecimal(-110) // Returns 1.909090...
 * americanToDecimal(+150) // Returns 2.50
 */
export function americanToDecimal(american: number): number {
  if (american === 0) {
    throw new Error('American odds cannot be zero');
  }

  if (american > 0) {
    // Positive odds: (odds / 100) + 1
    return (american / 100) + 1;
  } else {
    // Negative odds: (100 / |odds|) + 1
    return (100 / Math.abs(american)) + 1;
  }
}

/**
 * Convert decimal odds to American format
 * 
 * @param decimal - Decimal odds (must be >= 1.01)
 * @returns American odds
 * 
 * @example
 * decimalToAmerican(1.91) // Returns -110
 * decimalToAmerican(2.50) // Returns +150
 */
export function decimalToAmerican(decimal: number): number {
  if (decimal < 1.01) {
    throw new Error('Decimal odds must be at least 1.01');
  }

  if (decimal >= 2.0) {
    // Convert to positive American odds
    return Math.round((decimal - 1) * 100);
  } else {
    // Convert to negative American odds
    return Math.round(-100 / (decimal - 1));
  }
}

// ============================================================================
// PAYOUT CALCULATIONS
// ============================================================================

/**
 * Calculate payout for a single bet
 * 
 * @param stake - Amount wagered
 * @param americanOdds - American odds
 * @returns Total payout (stake + profit)
 * 
 * @example
 * calculatePayout(100, -110) // Returns 190.91 (100 stake + 90.91 profit)
 * calculatePayout(100, +150) // Returns 250.00 (100 stake + 150 profit)
 */
export function calculatePayout(stake: number, americanOdds: number): number {
  if (stake <= 0) {
    throw new Error('Stake must be positive');
  }

  const decimal = americanToDecimal(americanOdds);
  return stake * decimal;
}

/**
 * Calculate combined decimal odds for a parlay
 * 
 * @param legs - Array of bet legs with American odds
 * @returns Combined decimal odds
 * 
 * @example
 * calculateParlayOdds([{odds: -110}, {odds: -110}]) // Returns ~3.64
 */
export function calculateParlayOdds(legs: BetLegOdds[]): number {
  if (legs.length === 0) {
    throw new Error('Parlay must have at least one leg');
  }

  // Convert all to decimal and multiply
  return legs.reduce((acc, leg) => {
    return acc * americanToDecimal(leg.odds);
  }, 1);
}

/**
 * Calculate total payout for a parlay bet
 * 
 * @param stake - Amount wagered
 * @param legs - Array of bet legs with American odds
 * @returns Total payout (stake + profit)
 * 
 * @example
 * calculateParlayPayout(100, [{odds: -110}, {odds: -110}]) // Returns ~364
 */
export function calculateParlayPayout(stake: number, legs: BetLegOdds[]): number {
  if (stake <= 0) {
    throw new Error('Stake must be positive');
  }

  const decimalOdds = calculateParlayOdds(legs);
  return stake * decimalOdds;
}

// ============================================================================
// TEASER CALCULATIONS
// ============================================================================

/**
 * Standard teaser odds lookup table
 * Format: [sport][points][legCount] = americanOdds
 */
const TEASER_ODDS_TABLE: Record<string, Record<number, Record<number, number>>> = {
  nfl: {
    6: {
      2: -110,
      3: 180,
      4: 300,
      5: 450,
      6: 600
    },
    6.5: {
      2: -120,
      3: 160,
      4: 250,
      5: 400,
      6: 550
    },
    7: {
      2: -130,
      3: 140,
      4: 200,
      5: 350,
      6: 500
    }
  },
  nba: {
    4: {
      2: -110,
      3: 180,
      4: 300,
      5: 450
    },
    4.5: {
      2: -115,
      3: 170,
      4: 275,
      5: 425
    },
    5: {
      2: -120,
      3: 160,
      4: 250,
      5: 400
    }
  },
  mlb: {
    // MLB typically doesn't support teasers
  },
  nhl: {
    // NHL typically doesn't support teasers
  }
};

/**
 * Get standard teaser odds for given parameters
 * 
 * @param legCount - Number of legs in teaser (2-6)
 * @param points - Teaser points adjustment
 * @param sport - Sport type
 * @returns American odds for the teaser, or null if not found
 * 
 * @example
 * getTeaserOdds(2, 6, 'nfl') // Returns -110
 * getTeaserOdds(3, 6, 'nfl') // Returns +180
 */
export function getTeaserOdds(
  legCount: number,
  points: number,
  sport: Sport
): number | null {
  const sportTable = TEASER_ODDS_TABLE[sport];
  if (!sportTable) return null;

  const pointsTable = sportTable[points];
  if (!pointsTable) return null;

  return pointsTable[legCount] ?? null;
}

/**
 * Apply teaser point adjustment to a line
 * 
 * Teaser adjustments favor the bettor:
 * - Spread: Move line toward bettor (home gets more points, away gives fewer)
 * - Total: Move line away from middle (over gets lower line, under gets higher)
 * 
 * @param line - Original line
 * @param points - Teaser points to apply
 * @param selection - What side was selected
 * @returns Adjusted line
 * 
 * @example
 * applyTeaserAdjustment(-3.5, 6, 'home') // Returns +2.5 (home gets points)
 * applyTeaserAdjustment(48.5, 6, 'under') // Returns 54.5 (under gets higher line)
 */
export function applyTeaserAdjustment(
  line: number,
  points: number,
  selection: BetSelection
): number {
  if (selection === 'over') {
    // Over benefits from lower total
    return line - points;
  } else if (selection === 'under') {
    // Under benefits from higher total
    return line + points;
  } else if (selection === 'home') {
    // Home benefits from more points (less negative or more positive spread)
    return line + points;
  } else if (selection === 'away') {
    // Away benefits from fewer points to give (more negative spread becomes less negative)
    return line - points;
  }

  throw new Error(`Invalid selection: ${selection}`);
}

// ============================================================================
// BET SETTLEMENT
// ============================================================================

/**
 * Determine outcome of a moneyline bet
 * 
 * @param selection - Team selected ('home' or 'away')
 * @param homeScore - Final home team score
 * @param awayScore - Final away team score
 * @returns Bet outcome
 * 
 * @example
 * determineMoneylineOutcome('home', 24, 21) // Returns 'won'
 * determineMoneylineOutcome('away', 24, 21) // Returns 'lost'
 * determineMoneylineOutcome('home', 21, 21) // Returns 'push'
 */
export function determineMoneylineOutcome(
  selection: 'home' | 'away',
  homeScore: number,
  awayScore: number
): BetOutcome {
  if (homeScore === awayScore) {
    return 'push';
  }

  const homeWon = homeScore > awayScore;

  if (selection === 'home') {
    return homeWon ? 'won' : 'lost';
  } else {
    return homeWon ? 'lost' : 'won';
  }
}

/**
 * Determine outcome of a spread bet
 * 
 * Line is from home team's perspective:
 * - Negative line: home is favored (must win by more than |line|)
 * - Positive line: home is underdog (can lose by less than line)
 * 
 * @param selection - Team selected ('home' or 'away')
 * @param line - Spread line (home team perspective)
 * @param homeScore - Final home team score
 * @param awayScore - Final away team score
 * @returns Bet outcome
 * 
 * @example
 * determineSpreadOutcome('home', -3.5, 24, 20) // Returns 'won' (won by 4)
 * determineSpreadOutcome('home', -3.5, 23, 20) // Returns 'lost' (won by 3, didn't cover)
 * determineSpreadOutcome('home', -3, 23, 20)   // Returns 'push' (won by exactly 3)
 */
export function determineSpreadOutcome(
  selection: 'home' | 'away',
  line: number,
  homeScore: number,
  awayScore: number
): BetOutcome {
  // Calculate actual point differential (home - away)
  const differential = homeScore - awayScore;

  // Calculate cover differential (actual - line)
  // Positive means home covered, negative means away covered
  const coverDifferential = differential - line;

  // Check for push (exactly on the line)
  if (coverDifferential === 0) {
    return 'push';
  }

  // Determine winner
  const homeCovered = coverDifferential > 0;

  if (selection === 'home') {
    return homeCovered ? 'won' : 'lost';
  } else {
    return homeCovered ? 'lost' : 'won';
  }
}

/**
 * Determine outcome of a total (over/under) bet
 * 
 * @param selection - 'over' or 'under'
 * @param line - Total points line
 * @param totalScore - Combined final score
 * @returns Bet outcome
 * 
 * @example
 * determineTotalOutcome('over', 48.5, 52) // Returns 'won'
 * determineTotalOutcome('over', 48.5, 45) // Returns 'lost'
 * determineTotalOutcome('over', 48, 48)   // Returns 'push'
 */
export function determineTotalOutcome(
  selection: 'over' | 'under',
  line: number,
  totalScore: number
): BetOutcome {
  // Check for push
  if (totalScore === line) {
    return 'push';
  }

  const wentOver = totalScore > line;

  if (selection === 'over') {
    return wentOver ? 'won' : 'lost';
  } else {
    return wentOver ? 'lost' : 'won';
  }
}

/**
 * Calculate implied probability from American odds
 * 
 * @param americanOdds - American odds
 * @returns Implied probability (0-1)
 * 
 * @example
 * calculateImpliedProbability(-110) // Returns 0.5238 (52.38%)
 * calculateImpliedProbability(+150) // Returns 0.40 (40%)
 */
export function calculateImpliedProbability(americanOdds: number): number {
  const decimal = americanToDecimal(americanOdds);
  return 1 / decimal;
}

/**
 * Calculate profit from a winning bet
 * 
 * @param stake - Amount wagered
 * @param americanOdds - American odds
 * @returns Profit (not including stake)
 * 
 * @example
 * calculateProfit(100, -110) // Returns 90.91
 * calculateProfit(100, +150) // Returns 150.00
 */
export function calculateProfit(stake: number, americanOdds: number): number {
  return calculatePayout(stake, americanOdds) - stake;
}
