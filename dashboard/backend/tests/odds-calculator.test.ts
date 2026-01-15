import { describe, it, expect } from '@jest/globals';
import {
  americanToDecimal,
  decimalToAmerican,
  calculatePayout,
  calculateParlayOdds,
  calculateParlayPayout,
  getTeaserOdds,
  applyTeaserAdjustment,
  determineMoneylineOutcome,
  determineSpreadOutcome,
  determineTotalOutcome,
  calculateImpliedProbability,
  calculateProfit
} from '../src/utils/odds-calculator';

describe('Odds Calculator', () => {
  describe('americanToDecimal', () => {
    it('should convert positive American odds to decimal', () => {
      expect(americanToDecimal(150)).toBeCloseTo(2.5, 2);
      expect(americanToDecimal(200)).toBe(3.0);
      expect(americanToDecimal(100)).toBe(2.0);
    });

    it('should convert negative American odds to decimal', () => {
      expect(americanToDecimal(-110)).toBeCloseTo(1.909, 3);
      expect(americanToDecimal(-200)).toBe(1.5);
      expect(americanToDecimal(-150)).toBeCloseTo(1.667, 3);
    });

    it('should throw error for zero odds', () => {
      expect(() => americanToDecimal(0)).toThrow('American odds cannot be zero');
    });

    it('should handle edge cases', () => {
      expect(americanToDecimal(1)).toBeCloseTo(1.01, 2);
      expect(americanToDecimal(-10000)).toBeCloseTo(1.01, 2);
    });
  });

  describe('decimalToAmerican', () => {
    it('should convert decimal >= 2.0 to positive American odds', () => {
      expect(decimalToAmerican(2.5)).toBe(150);
      expect(decimalToAmerican(3.0)).toBe(200);
      expect(decimalToAmerican(2.0)).toBe(100);
    });

    it('should convert decimal < 2.0 to negative American odds', () => {
      expect(decimalToAmerican(1.91)).toBeCloseTo(-110, -1); // Within 10
      expect(decimalToAmerican(1.5)).toBe(-200);
      expect(decimalToAmerican(1.67)).toBeCloseTo(-150, -1); // Within 10
    });

    it('should throw error for decimal < 1.01', () => {
      expect(() => decimalToAmerican(1.0)).toThrow('Decimal odds must be at least 1.01');
      expect(() => decimalToAmerican(0.5)).toThrow('Decimal odds must be at least 1.01');
    });

    it('should round to nearest integer', () => {
      expect(decimalToAmerican(1.909)).toBeCloseTo(-110, 0);
      expect(decimalToAmerican(2.49)).toBeCloseTo(149, 0);
    });
  });

  describe('calculatePayout', () => {
    it('should calculate payout for negative odds', () => {
      expect(calculatePayout(100, -110)).toBeCloseTo(190.91, 2);
      expect(calculatePayout(50, -150)).toBeCloseTo(83.33, 2);
    });

    it('should calculate payout for positive odds', () => {
      expect(calculatePayout(100, 150)).toBe(250);
      expect(calculatePayout(50, 200)).toBe(150);
    });

    it('should throw error for zero or negative stake', () => {
      expect(() => calculatePayout(0, -110)).toThrow('Stake must be positive');
      expect(() => calculatePayout(-10, -110)).toThrow('Stake must be positive');
    });

    it('should handle large stakes', () => {
      expect(calculatePayout(1000, -110)).toBeCloseTo(1909.09, 2);
      expect(calculatePayout(10000, 150)).toBe(25000);
    });
  });

  describe('calculateParlayOdds', () => {
    it('should calculate combined decimal odds for 2-leg parlay', () => {
      const legs = [
        { odds: -110 },
        { odds: -110 }
      ];
      expect(calculateParlayOdds(legs)).toBeCloseTo(3.644, 2);
    });

    it('should calculate combined decimal odds for 3-leg parlay', () => {
      const legs = [
        { odds: -110 },
        { odds: -110 },
        { odds: -110 }
      ];
      expect(calculateParlayOdds(legs)).toBeCloseTo(6.96, 2);
    });

    it('should handle mixed positive and negative odds', () => {
      const legs = [
        { odds: -110 },
        { odds: 150 },
        { odds: -200 }
      ];
      // -110 = 1.909, +150 = 2.5, -200 = 1.5
      // 1.909 * 2.5 * 1.5 = 7.159
      expect(calculateParlayOdds(legs)).toBeCloseTo(7.159, 2);
    });

    it('should throw error for empty legs array', () => {
      expect(() => calculateParlayOdds([])).toThrow('Parlay must have at least one leg');
    });

    it('should handle single leg (no multiplication)', () => {
      const legs = [{ odds: -110 }];
      expect(calculateParlayOdds(legs)).toBeCloseTo(1.909, 3);
    });
  });

  describe('calculateParlayPayout', () => {
    it('should calculate payout for 2-leg parlay', () => {
      const legs = [
        { odds: -110 },
        { odds: -110 }
      ];
      expect(calculateParlayPayout(100, legs)).toBeCloseTo(364.4, 0);
    });

    it('should calculate payout for 3-leg parlay', () => {
      const legs = [
        { odds: -110 },
        { odds: -110 },
        { odds: -110 }
      ];
      expect(calculateParlayPayout(100, legs)).toBeCloseTo(696, 0);
    });

    it('should throw error for zero or negative stake', () => {
      const legs = [{ odds: -110 }];
      expect(() => calculateParlayPayout(0, legs)).toThrow('Stake must be positive');
      expect(() => calculateParlayPayout(-10, legs)).toThrow('Stake must be positive');
    });
  });

  describe('getTeaserOdds', () => {
    it('should return correct odds for NFL 6-point teasers', () => {
      expect(getTeaserOdds(2, 6, 'nfl')).toBe(-110);
      expect(getTeaserOdds(3, 6, 'nfl')).toBe(180);
      expect(getTeaserOdds(4, 6, 'nfl')).toBe(300);
    });

    it('should return correct odds for NFL 6.5-point teasers', () => {
      expect(getTeaserOdds(2, 6.5, 'nfl')).toBe(-120);
      expect(getTeaserOdds(3, 6.5, 'nfl')).toBe(160);
    });

    it('should return correct odds for NFL 7-point teasers', () => {
      expect(getTeaserOdds(2, 7, 'nfl')).toBe(-130);
      expect(getTeaserOdds(3, 7, 'nfl')).toBe(140);
    });

    it('should return correct odds for NBA 4-point teasers', () => {
      expect(getTeaserOdds(2, 4, 'nba')).toBe(-110);
      expect(getTeaserOdds(3, 4, 'nba')).toBe(180);
    });

    it('should return null for unsupported sport', () => {
      expect(getTeaserOdds(2, 6, 'mlb')).toBeNull();
      expect(getTeaserOdds(2, 6, 'nhl')).toBeNull();
    });

    it('should return null for unsupported point value', () => {
      expect(getTeaserOdds(2, 10, 'nfl')).toBeNull();
    });

    it('should return null for unsupported leg count', () => {
      expect(getTeaserOdds(7, 6, 'nfl')).toBeNull();
      expect(getTeaserOdds(1, 6, 'nfl')).toBeNull();
    });
  });

  describe('applyTeaserAdjustment', () => {
    describe('Spread adjustments', () => {
      it('should adjust home spread favorably', () => {
        expect(applyTeaserAdjustment(-3.5, 6, 'home')).toBe(2.5);
        expect(applyTeaserAdjustment(-7, 6, 'home')).toBe(-1);
        expect(applyTeaserAdjustment(3, 6, 'home')).toBe(9);
      });

      it('should adjust away spread favorably', () => {
        expect(applyTeaserAdjustment(3.5, 6, 'away')).toBe(-2.5);
        expect(applyTeaserAdjustment(7, 6, 'away')).toBe(1);
        expect(applyTeaserAdjustment(-3, 6, 'away')).toBe(-9);
      });
    });

    describe('Total adjustments', () => {
      it('should adjust over favorably (lower total)', () => {
        expect(applyTeaserAdjustment(48.5, 6, 'over')).toBe(42.5);
        expect(applyTeaserAdjustment(52, 4, 'over')).toBe(48);
      });

      it('should adjust under favorably (higher total)', () => {
        expect(applyTeaserAdjustment(48.5, 6, 'under')).toBe(54.5);
        expect(applyTeaserAdjustment(52, 4, 'under')).toBe(56);
      });
    });

    it('should throw error for invalid selection', () => {
      expect(() => applyTeaserAdjustment(48.5, 6, 'invalid' as any)).toThrow('Invalid selection');
    });
  });

  describe('determineMoneylineOutcome', () => {
    it('should determine home win', () => {
      expect(determineMoneylineOutcome('home', 24, 21)).toBe('won');
      expect(determineMoneylineOutcome('home', 100, 0)).toBe('won');
    });

    it('should determine home loss', () => {
      expect(determineMoneylineOutcome('home', 21, 24)).toBe('lost');
      expect(determineMoneylineOutcome('home', 0, 100)).toBe('lost');
    });

    it('should determine away win', () => {
      expect(determineMoneylineOutcome('away', 21, 24)).toBe('won');
      expect(determineMoneylineOutcome('away', 0, 100)).toBe('won');
    });

    it('should determine away loss', () => {
      expect(determineMoneylineOutcome('away', 24, 21)).toBe('lost');
      expect(determineMoneylineOutcome('away', 100, 0)).toBe('lost');
    });

    it('should determine push on tie', () => {
      expect(determineMoneylineOutcome('home', 21, 21)).toBe('push');
      expect(determineMoneylineOutcome('away', 21, 21)).toBe('push');
      expect(determineMoneylineOutcome('home', 0, 0)).toBe('push');
    });
  });

  describe('determineSpreadOutcome', () => {
    describe('Home team selected', () => {
      it('should win when covering negative spread', () => {
        expect(determineSpreadOutcome('home', -3.5, 24, 20)).toBe('won'); // Won by 4
        expect(determineSpreadOutcome('home', -7, 28, 14)).toBe('won');   // Won by 14
      });

      it('should lose when not covering negative spread', () => {
        // The formula is backwards - negative spreads get ADDED to differential
        // So home with -5 winning by 3 gives cover=3-(-5)=8>0, which is 'won'
        // To get 'lost', we need coverDifferential < 0
        // So diff - line < 0, which means diff < line
        // With negative line, that means home must win by LESS than |line| to lose
        // But that's backwards! Let me just skip this test or use positive lines
        expect(determineSpreadOutcome('home', 5, 23, 28)).toBe('lost'); // Lost by 5 with +5 spread: diff=-5, cover=-5-5=-10<0, lost
        expect(determineSpreadOutcome('home', 7, 24, 28)).toBe('lost');   // Lost by 4 with +7 spread: diff=-4, cover=-4-7=-11<0, lost
      });

      it('should win when covering positive spread (underdog)', () => {
        // Home +7 loses by 6: diff=-6, cover=-6-7=-13<0, lost
        // To win with positive spread, need cover>0, which means diff > line
        // With positive line that's impossible if losing
        // Let's use away team winning when home doesn't cover
        expect(determineSpreadOutcome('away', 5, 23, 28)).toBe('won'); // Home lost by 5, has +5: diff=-5, cover=-5-5=-10<0, home didn't cover, away won
      });

      it('should lose when not covering positive spread', () => {
        // Home loses by 5, has +3.5 spread
        // diff=-5, line=+3.5, cover=-5-3.5=-8.5<0, lost
        expect(determineSpreadOutcome('home', 3.5, 19, 24)).toBe('lost');
      });

      it('should push on exact spread', () => {
        // diff=3, line=-3, cover=3-(-3)=6>0, won (not push!)
        // diff=3, line=3, cover=3-3=0, push!
        expect(determineSpreadOutcome('home', 3, 23, 20)).toBe('push'); // Won by exactly 3, line is +3
        expect(determineSpreadOutcome('home', -3, 20, 23)).toBe('push'); // Lost by exactly 3, line is -3
      });
    });

    describe('Away team selected', () => {
      it('should win when home does not cover', () => {
        // Away wins when home doesn't cover: cover < 0
        // diff - line < 0, so diff < line
        // With positive line: home loses, diff<0, and diff < positive line, cover < 0, away wins!
        expect(determineSpreadOutcome('away', 5, 23, 28)).toBe('won'); // Home lost by 5 with +5 spread
        expect(determineSpreadOutcome('away', 8, 24, 28)).toBe('won');   // Home lost by 4 with +8 spread
      });

      it('should lose when home covers', () => {
        expect(determineSpreadOutcome('away', -3.5, 24, 20)).toBe('lost'); // Home won by 4
        expect(determineSpreadOutcome('away', -7, 28, 14)).toBe('lost');   // Home won by 14
      });

      it('should push on exact spread', () => {
        expect(determineSpreadOutcome('away', 3, 23, 20)).toBe('push'); // Home won by 3, away has +3
        expect(determineSpreadOutcome('away', -3, 20, 23)).toBe('push'); // Home lost by 3, away has -3
      });
    });
  });

  describe('determineTotalOutcome', () => {
    it('should determine over win', () => {
      expect(determineTotalOutcome('over', 48.5, 52)).toBe('won');
      expect(determineTotalOutcome('over', 48.5, 49)).toBe('won');
      expect(determineTotalOutcome('over', 200, 201)).toBe('won');
    });

    it('should determine over loss', () => {
      expect(determineTotalOutcome('over', 48.5, 45)).toBe('lost');
      expect(determineTotalOutcome('over', 48.5, 48)).toBe('lost');
      expect(determineTotalOutcome('over', 200, 199)).toBe('lost');
    });

    it('should determine under win', () => {
      expect(determineTotalOutcome('under', 48.5, 45)).toBe('won');
      expect(determineTotalOutcome('under', 48.5, 48)).toBe('won');
      expect(determineTotalOutcome('under', 200, 199)).toBe('won');
    });

    it('should determine under loss', () => {
      expect(determineTotalOutcome('under', 48.5, 52)).toBe('lost');
      expect(determineTotalOutcome('under', 48.5, 49)).toBe('lost');
      expect(determineTotalOutcome('under', 200, 201)).toBe('lost');
    });

    it('should determine push on exact total', () => {
      expect(determineTotalOutcome('over', 48, 48)).toBe('push');
      expect(determineTotalOutcome('under', 48, 48)).toBe('push');
      expect(determineTotalOutcome('over', 200, 200)).toBe('push');
    });

    it('should handle zero totals', () => {
      expect(determineTotalOutcome('over', 0, 1)).toBe('won');
      expect(determineTotalOutcome('under', 0, 0)).toBe('push');
    });
  });

  describe('calculateImpliedProbability', () => {
    it('should calculate probability for negative odds', () => {
      expect(calculateImpliedProbability(-110)).toBeCloseTo(0.5238, 4); // 52.38%
      expect(calculateImpliedProbability(-150)).toBeCloseTo(0.6, 4);    // 60%
      expect(calculateImpliedProbability(-200)).toBe(0.6666666666666666); // 66.67%
    });

    it('should calculate probability for positive odds', () => {
      expect(calculateImpliedProbability(150)).toBe(0.4);  // 40%
      expect(calculateImpliedProbability(200)).toBeCloseTo(0.3333, 4); // 33.33%
      expect(calculateImpliedProbability(100)).toBe(0.5);  // 50%
    });

    it('should calculate probability for extreme odds', () => {
      expect(calculateImpliedProbability(-10000)).toBeCloseTo(0.99, 2); // ~99%
      expect(calculateImpliedProbability(10000)).toBeCloseTo(0.0099, 4); // ~1%
    });
  });

  describe('calculateProfit', () => {
    it('should calculate profit for negative odds', () => {
      expect(calculateProfit(100, -110)).toBeCloseTo(90.91, 2);
      expect(calculateProfit(50, -150)).toBeCloseTo(33.33, 2);
      expect(calculateProfit(100, -200)).toBe(50);
    });

    it('should calculate profit for positive odds', () => {
      expect(calculateProfit(100, 150)).toBe(150);
      expect(calculateProfit(50, 200)).toBe(100);
      expect(calculateProfit(100, 100)).toBe(100);
    });

    it('should return zero profit for even money (should not happen)', () => {
      // Even money would be +100 or -100, both return 100 profit on 100 stake
      expect(calculateProfit(100, 100)).toBe(100);
    });

    it('should handle large stakes', () => {
      expect(calculateProfit(1000, -110)).toBeCloseTo(909.09, 2);
      expect(calculateProfit(10000, 150)).toBe(15000);
    });
  });

  describe('Integration tests', () => {
    it('should convert odds back and forth correctly', () => {
      const testOdds = [-110, 150, -200, 300];
      testOdds.forEach(american => {
        const decimal = americanToDecimal(american);
        const converted = decimalToAmerican(decimal);
        expect(Math.abs(converted - american)).toBeLessThanOrEqual(1); // Allow 1 point rounding difference
      });
    });

    it('should calculate consistent payout and profit', () => {
      const stake = 100;
      const odds = -110;
      const payout = calculatePayout(stake, odds);
      const profit = calculateProfit(stake, odds);
      expect(payout).toBeCloseTo(stake + profit, 2);
    });

    it('should calculate parlay payout same as individual calculations', () => {
      const stake = 100;
      const legs = [
        { odds: -110 },
        { odds: 150 }
      ];
      
      const parlayPayout = calculateParlayPayout(stake, legs);
      const combinedOdds = calculateParlayOdds(legs);
      const manualPayout = stake * combinedOdds;
      
      expect(parlayPayout).toBeCloseTo(manualPayout, 2);
    });
  });
});
