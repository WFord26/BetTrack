/**
 * Formatting utilities for odds, spreads, totals, dates, and times
 */

/**
 * Format American odds with + or - prefix
 * @param american - American odds number
 * @param asDecimal - If true, convert to decimal odds format
 * @returns Formatted string like "+150" or "-110" (or "2.50" for decimal)
 */
export function formatOdds(american: number, asDecimal: boolean = false): string {
  if (asDecimal) {
    return americanToDecimal(american).toFixed(2);
  }
  if (american > 0) {
    return `+${american}`;
  }
  return american.toString();
}

/**
 * Convert American odds to decimal odds
 * @param american - American odds number
 * @returns Decimal odds
 */
export function americanToDecimal(american: number): number {
  if (american > 0) {
    return (american / 100) + 1;
  } else {
    return (100 / Math.abs(american)) + 1;
  }
}

/**
 * Convert decimal odds to American odds
 * @param decimal - Decimal odds number
 * @returns American odds
 */
export function decimalToAmerican(decimal: number): number {
  if (decimal >= 2.0) {
    return Math.round((decimal - 1) * 100);
  } else {
    return Math.round(-100 / (decimal - 1));
  }
}

/**
 * Format spread with + or - prefix
 * @param spread - Spread number (positive means underdog, negative means favorite)
 * @returns Formatted string like "+3.5" or "-3.5"
 */
export function formatSpread(spread: number): string {
  if (spread > 0) {
    return `+${spread}`;
  }
  return spread.toString();
}

/**
 * Format total as plain number
 * @param total - Total number
 * @returns Formatted string like "220.5"
 */
export function formatTotal(total: number): string {
  return total.toString();
}

/**
 * Format time as local time string
 * @param date - ISO date string
 * @returns Formatted time like "7:30 PM"
 */
export function formatTime(date: string): string {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format date as short date string
 * @param date - ISO date string (YYYY-MM-DD format)
 * @returns Formatted date like "Mon, Jan 8"
 */
export function formatDate(date: string): string {
  // Parse date string as local date to avoid UTC conversion
  // "2026-01-09" should display as "Thu, Jan 9" regardless of timezone
  const [year, month, day] = date.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format currency as USD
 * @param amount - Dollar amount
 * @returns Formatted string like "$150.00"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format percentage
 * @param value - Percentage value (0-100)
 * @returns Formatted string like "54.2%"
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param date - ISO date string
 * @returns Formatted relative time string
 */
export function formatRelativeTime(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }
}

/**
 * Get sport display name from key
 * @param sportKey - Sport key like "basketball_nba"
 * @returns Display name like "NBA"
 */
export function getSportDisplayName(sportKey: string): string {
  const sportMap: Record<string, string> = {
    'basketball_nba': 'NBA',
    'americanfootball_nfl': 'NFL',
    'icehockey_nhl': 'NHL',
    'baseball_mlb': 'MLB',
    'americanfootball_ncaaf': 'NCAAF',
    'basketball_ncaab': 'NCAAB',
    'soccer_epl': 'EPL',
    'soccer_uefa_champs_league': 'UEFA CL'
  };
  return sportMap[sportKey] || sportKey.toUpperCase();
}

/**
 * Get sport color class for Tailwind
 * @param sportKey - Sport key like "basketball_nba"
 * @returns Tailwind color class
 */
export function getSportColorClass(sportKey: string): string {
  const colorMap: Record<string, string> = {
    'basketball_nba': 'bg-orange-500',
    'americanfootball_nfl': 'bg-blue-600',
    'icehockey_nhl': 'bg-cyan-500',
    'baseball_mlb': 'bg-red-500',
    'americanfootball_ncaaf': 'bg-purple-600',
    'basketball_ncaab': 'bg-orange-600',
    'soccer_epl': 'bg-green-600',
    'soccer_uefa_champs_league': 'bg-indigo-600'
  };
  return colorMap[sportKey] || 'bg-gray-500';
}
