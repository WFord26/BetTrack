/**
 * Example utility function tests - Format utilities
 * Demonstrates testing pure functions
 */

import { describe, it, expect } from 'vitest';
import { formatCurrency, formatOdds, formatDate, formatPercentage } from '@/utils/format';

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
      const dateString = '2026-01-15';
      const formatted = formatDate(dateString);
      
      expect(formatted).toMatch(/Jan 15/);
    });

    it('handles different dates', () => {
      const dateString = '2026-12-25';
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
});
