/**
 * Tests for the formatting utilities.
 *
 * These are the pure functions every odds surface goes through, so the odds
 * conversions are checked against the actual American/decimal identities
 * rather than against whatever the implementation happens to return.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  formatCurrency,
  formatOdds,
  formatDate,
  formatPercentage,
  americanToDecimal,
  decimalToAmerican,
  formatSpread,
  formatTotal,
  formatTime,
  formatRelativeTime,
  getSportDisplayName,
  getSportColorClass,
} from '@/utils/format';

describe('Format Utilities', () => {
  describe('formatCurrency', () => {
    it('formats positive numbers correctly', () => {
      expect(formatCurrency(100)).toBe('$100.00');
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('formats negative numbers correctly', () => {
      expect(formatCurrency(-50)).toBe('-$50.00');
      expect(formatCurrency(-1234.56)).toBe('-$1,234.56');
    });

    it('handles decimal precision', () => {
      expect(formatCurrency(100.123)).toBe('$100.12');
      expect(formatCurrency(100.999)).toBe('$101.00');
    });
  });

  describe('formatOdds', () => {
    it('formats American odds correctly', () => {
      expect(formatOdds(-110)).toBe('-110');
      expect(formatOdds(150)).toBe('+150');
      expect(formatOdds(100)).toBe('+100');
      expect(formatOdds(-100)).toBe('-100');
    });

    it('handles edge cases', () => {
      expect(formatOdds(0)).toBe('0');
      expect(formatOdds(-200)).toBe('-200');
      expect(formatOdds(300)).toBe('+300');
    });
  });

  describe('formatDate', () => {
    it('formats dates correctly', () => {
      // Use noon local time to avoid UTC midnight timezone boundary crossing
      const dateString = '2026-01-15T12:00:00';
      const formatted = formatDate(dateString);
      
      expect(formatted).toMatch(/Jan 15/);
    });

    it('handles different dates', () => {
      // Use noon local time to avoid UTC midnight timezone boundary crossing
      const dateString = '2026-12-25T12:00:00';
      const formatted = formatDate(dateString);
      
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
      expect(formatted).toMatch(/Dec 25/);
    });
  });

  describe('formatPercentage', () => {
    it('formats percentages correctly', () => {
      expect(formatPercentage(50)).toBe('50.0%');
      expect(formatPercentage(12.3)).toBe('12.3%');
      expect(formatPercentage(100)).toBe('100.0%');
      expect(formatPercentage(0)).toBe('0.0%');
    });

    it('handles decimal precision', () => {
      expect(formatPercentage(12.345)).toBe('12.3%');
      expect(formatPercentage(12.999)).toBe('13.0%');
    });

    it('handles edge cases', () => {
      expect(formatPercentage(150)).toBe('150.0%');
      expect(formatPercentage(-10)).toBe('-10.0%');
    });
  });

  describe('americanToDecimal', () => {
    it('converts an underdog price to its decimal payout multiplier', () => {
      // +150 returns $1.50 profit per $1 staked, plus the stake back.
      expect(americanToDecimal(150)).toBeCloseTo(2.5, 10);
      expect(americanToDecimal(300)).toBeCloseTo(4, 10);
    });

    it('converts a favourite price to its decimal payout multiplier', () => {
      // -110 needs $110 staked to win $100, so the multiplier is 1 + 100/110.
      expect(americanToDecimal(-110)).toBeCloseTo(1.909090909, 8);
      expect(americanToDecimal(-200)).toBeCloseTo(1.5, 10);
    });

    it('treats +100 and -100 as the same even-money price', () => {
      expect(americanToDecimal(100)).toBe(2);
      expect(americanToDecimal(-100)).toBe(2);
    });

    it('produces decimal prices whose implied probabilities behave', () => {
      // A favourite is implied to win more often than an underdog.
      const favourite = 1 / americanToDecimal(-200);
      const underdog = 1 / americanToDecimal(200);
      expect(favourite).toBeGreaterThan(underdog);
      // -200/+200 is the fair, no-vig pair: the two sides sum to exactly 1.
      expect(favourite + underdog).toBeCloseTo(1, 10);

      // A standard -110/-110 market carries the bookmaker's margin, so its
      // two sides over-round to about 4.8%.
      const vigged = 2 * (1 / americanToDecimal(-110));
      expect(vigged).toBeGreaterThan(1);
      expect(vigged).toBeCloseTo(1.0476, 3);
    });
  });

  describe('decimalToAmerican', () => {
    it('converts decimal prices at or above evens to a positive American price', () => {
      expect(decimalToAmerican(2.5)).toBe(150);
      expect(decimalToAmerican(4)).toBe(300);
      expect(decimalToAmerican(2)).toBe(100);
    });

    it('converts decimal prices below evens to a negative American price', () => {
      expect(decimalToAmerican(1.5)).toBe(-200);
      expect(decimalToAmerican(1.909090909)).toBe(-110);
    });

    it('round-trips back to the original American price', () => {
      for (const american of [-500, -200, -110, 100, 150, 300, 1000]) {
        expect(decimalToAmerican(americanToDecimal(american))).toBe(american);
      }
    });
  });

  describe('formatOdds in decimal mode', () => {
    it('renders the decimal price to two places', () => {
      expect(formatOdds(150, true)).toBe('2.50');
      expect(formatOdds(-110, true)).toBe('1.91');
      expect(formatOdds(-200, true)).toBe('1.50');
    });

    it('still reports N/A for a missing price in either mode', () => {
      expect(formatOdds(null)).toBe('N/A');
      expect(formatOdds(undefined)).toBe('N/A');
      expect(formatOdds(null, true)).toBe('N/A');
    });
  });

  describe('formatSpread', () => {
    it('prefixes a plus only for the underdog side', () => {
      expect(formatSpread(3.5)).toBe('+3.5');
      expect(formatSpread(-3.5)).toBe('-3.5');
    });

    it('leaves a pick-em unsigned', () => {
      expect(formatSpread(0)).toBe('0');
    });
  });

  describe('formatTotal', () => {
    it('renders the line as-is, keeping the hook', () => {
      expect(formatTotal(220.5)).toBe('220.5');
      expect(formatTotal(41)).toBe('41');
    });
  });

  describe('formatTime', () => {
    it('renders a 12-hour clock time with meridiem', () => {
      // Local-time input avoids a UTC boundary shifting the hour.
      expect(formatTime('2026-01-15T19:30:00')).toBe('7:30 PM');
      expect(formatTime('2026-01-15T09:05:00')).toBe('9:05 AM');
    });

    it('renders midnight and noon distinctly', () => {
      expect(formatTime('2026-01-15T00:00:00')).toBe('12:00 AM');
      expect(formatTime('2026-01-15T12:00:00')).toBe('12:00 PM');
    });
  });

  describe('formatDate', () => {
    it('reports a missing date rather than rendering "Invalid Date"', () => {
      expect(formatDate(null)).toBe('Unknown Date');
      expect(formatDate(undefined)).toBe('Unknown Date');
      expect(formatDate('')).toBe('Unknown Date');
    });

    it('reports an unparseable date', () => {
      expect(formatDate('not-a-date')).toBe('Invalid Date');
    });

    it('includes the weekday', () => {
      // 2026-01-15 is a Thursday.
      expect(formatDate('2026-01-15T12:00:00')).toBe('Thu, Jan 15');
    });
  });

  describe('formatRelativeTime', () => {
    const NOW = new Date('2026-01-15T18:00:00.000Z');

    afterEach(() => {
      vi.useRealTimers();
    });

    function at(minutesAgo: number): string {
      vi.useFakeTimers({ now: NOW });
      return new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();
    }

    it('reports sub-minute ages as "just now"', () => {
      expect(formatRelativeTime(at(0))).toBe('just now');
    });

    it('singularises exactly one minute', () => {
      expect(formatRelativeTime(at(1))).toBe('1 min ago');
    });

    it('pluralises multiple minutes', () => {
      expect(formatRelativeTime(at(45))).toBe('45 mins ago');
    });

    it('switches to hours at the 60-minute boundary', () => {
      expect(formatRelativeTime(at(59))).toBe('59 mins ago');
      expect(formatRelativeTime(at(60))).toBe('1 hour ago');
      expect(formatRelativeTime(at(180))).toBe('3 hours ago');
    });

    it('switches to days at the 24-hour boundary', () => {
      expect(formatRelativeTime(at(60 * 24 - 1))).toBe('23 hours ago');
      expect(formatRelativeTime(at(60 * 24))).toBe('1 day ago');
      expect(formatRelativeTime(at(60 * 24 * 5))).toBe('5 days ago');
    });

    it('handles missing and unparseable inputs', () => {
      expect(formatRelativeTime(null)).toBe('Unknown');
      expect(formatRelativeTime(undefined)).toBe('Unknown');
      expect(formatRelativeTime('not-a-date')).toBe('Invalid Date');
    });
  });

  describe('getSportDisplayName', () => {
    it('maps known sport keys to their league abbreviation', () => {
      expect(getSportDisplayName('basketball_nba')).toBe('NBA');
      expect(getSportDisplayName('americanfootball_nfl')).toBe('NFL');
      expect(getSportDisplayName('soccer_uefa_champs_league')).toBe('UEFA CL');
    });

    it('upper-cases an unmapped key rather than returning nothing', () => {
      expect(getSportDisplayName('cricket_ipl')).toBe('CRICKET_IPL');
    });
  });

  describe('getSportColorClass', () => {
    it('gives each mapped sport its own colour', () => {
      expect(getSportColorClass('basketball_nba')).toBe('bg-orange-500');
      expect(getSportColorClass('icehockey_nhl')).toBe('bg-cyan-500');
    });

    it('distinguishes the professional and college tiers of a sport', () => {
      expect(getSportColorClass('basketball_nba')).not.toBe(
        getSportColorClass('basketball_ncaab')
      );
    });

    it('falls back to grey for an unmapped key', () => {
      expect(getSportColorClass('cricket_ipl')).toBe('bg-gray-500');
    });
  });
});
