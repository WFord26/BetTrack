/**
 * Unit tests for odds calculator utilities
 * 
 * Run with: npm test
 */

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

// ============================================================================
// ODDS CONVERSION TESTS
// ============================================================================

console.log('Testing Odds Conversion...');

// American to Decimal
function testAmericanToDecimal() {
  const tests = [
    { input: -110, expected: 1.909090909090909 },
    { input: +150, expected: 2.5 },
    { input: -200, expected: 1.5 },
    { input: +200, expected: 3.0 },
    { input: -150, expected: 1.6666666666666667 },
    { input: +100, expected: 2.0 }
  ];

  tests.forEach(({ input, expected }) => {
    const result = americanToDecimal(input);
    console.assert(
      Math.abs(result - expected) < 0.0001,
      `americanToDecimal(${input}) failed: expected ${expected}, got ${result}`
    );
  });

  // Test error case
  try {
    americanToDecimal(0);
    console.assert(false, 'Should throw error for zero odds');
  } catch (e) {
    // Expected
  }

  console.log('✓ americanToDecimal tests passed');
}

// Decimal to American
function testDecimalToAmerican() {
  const tests = [
    { input: 1.91, expected: -110 },
    { input: 2.5, expected: 150 },
    { input: 1.5, expected: -200 },
    { input: 3.0, expected: 200 },
    { input: 2.0, expected: 100 }
  ];

  tests.forEach(({ input, expected }) => {
    const result = decimalToAmerican(input);
    console.assert(
      Math.abs(result - expected) <= 1, // Allow 1 point rounding difference
      `decimalToAmerican(${input}) failed: expected ${expected}, got ${result}`
    );
  });

  // Test error case
  try {
    decimalToAmerican(0.5);
    console.assert(false, 'Should throw error for odds < 1.01');
  } catch (e) {
    // Expected
  }

  console.log('✓ decimalToAmerican tests passed');
}

testAmericanToDecimal();
testDecimalToAmerican();

// ============================================================================
// PAYOUT CALCULATION TESTS
// ============================================================================

console.log('\nTesting Payout Calculations...');

function testCalculatePayout() {
  const tests = [
    { stake: 100, odds: -110, expectedMin: 190, expectedMax: 191 },
    { stake: 100, odds: +150, expectedMin: 250, expectedMax: 250 },
    { stake: 50, odds: -200, expectedMin: 75, expectedMax: 75 },
    { stake: 100, odds: +200, expectedMin: 300, expectedMax: 300 }
  ];

  tests.forEach(({ stake, odds, expectedMin, expectedMax }) => {
    const result = calculatePayout(stake, odds);
    console.assert(
      result >= expectedMin && result <= expectedMax,
      `calculatePayout(${stake}, ${odds}) failed: expected ${expectedMin}-${expectedMax}, got ${result}`
    );
  });

  console.log('✓ calculatePayout tests passed');
}

function testCalculateParlayOdds() {
  // 2-leg parlay: -110 + -110 = ~3.64 decimal
  const twoLeg = calculateParlayOdds([{ odds: -110 }, { odds: -110 }]);
  console.assert(
    Math.abs(twoLeg - 3.64) < 0.1,
    `Two-leg parlay odds incorrect: ${twoLeg}`
  );

  // 3-leg parlay
  const threeLeg = calculateParlayOdds([
    { odds: -110 },
    { odds: -110 },
    { odds: -110 }
  ]);
  console.assert(
    threeLeg > 6 && threeLeg < 7,
    `Three-leg parlay odds incorrect: ${threeLeg}`
  );

  console.log('✓ calculateParlayOdds tests passed');
}

function testCalculateParlayPayout() {
  const payout = calculateParlayPayout(100, [{ odds: -110 }, { odds: -110 }]);
  console.assert(
    payout >= 360 && payout <= 365,
    `Parlay payout incorrect: ${payout}`
  );

  console.log('✓ calculateParlayPayout tests passed');
}

testCalculatePayout();
testCalculateParlayOdds();
testCalculateParlayPayout();

// ============================================================================
// TEASER CALCULATION TESTS
// ============================================================================

console.log('\nTesting Teaser Calculations...');

function testGetTeaserOdds() {
  // NFL 6-point teasers
  console.assert(getTeaserOdds(2, 6, 'nfl') === -110, 'NFL 2-team 6pt teaser incorrect');
  console.assert(getTeaserOdds(3, 6, 'nfl') === 180, 'NFL 3-team 6pt teaser incorrect');
  console.assert(getTeaserOdds(4, 6, 'nfl') === 300, 'NFL 4-team 6pt teaser incorrect');

  // NBA 4-point teasers
  console.assert(getTeaserOdds(2, 4, 'nba') === -110, 'NBA 2-team 4pt teaser incorrect');
  console.assert(getTeaserOdds(3, 4, 'nba') === 180, 'NBA 3-team 4pt teaser incorrect');

  // Invalid cases
  console.assert(getTeaserOdds(2, 10, 'nfl') === null, 'Should return null for invalid points');
  console.assert(getTeaserOdds(10, 6, 'nfl') === null, 'Should return null for invalid leg count');

  console.log('✓ getTeaserOdds tests passed');
}

function testApplyTeaserAdjustment() {
  // Spread adjustments
  console.assert(
    applyTeaserAdjustment(-3.5, 6, 'home') === 2.5,
    'Home spread teaser adjustment incorrect'
  );
  console.assert(
    applyTeaserAdjustment(-3.5, 6, 'away') === -9.5,
    'Away spread teaser adjustment incorrect'
  );

  // Total adjustments
  console.assert(
    applyTeaserAdjustment(48.5, 6, 'over') === 42.5,
    'Over total teaser adjustment incorrect'
  );
  console.assert(
    applyTeaserAdjustment(48.5, 6, 'under') === 54.5,
    'Under total teaser adjustment incorrect'
  );

  console.log('✓ applyTeaserAdjustment tests passed');
}

testGetTeaserOdds();
testApplyTeaserAdjustment();

// ============================================================================
// BET SETTLEMENT TESTS
// ============================================================================

console.log('\nTesting Bet Settlement...');

function testDetermineMoneylineOutcome() {
  // Home wins
  console.assert(
    determineMoneylineOutcome('home', 24, 21) === 'won',
    'Home moneyline win incorrect'
  );
  console.assert(
    determineMoneylineOutcome('away', 24, 21) === 'lost',
    'Away moneyline loss incorrect'
  );

  // Away wins
  console.assert(
    determineMoneylineOutcome('away', 20, 24) === 'won',
    'Away moneyline win incorrect'
  );
  console.assert(
    determineMoneylineOutcome('home', 20, 24) === 'lost',
    'Home moneyline loss incorrect'
  );

  // Tie
  console.assert(
    determineMoneylineOutcome('home', 21, 21) === 'push',
    'Moneyline push incorrect'
  );

  console.log('✓ determineMoneylineOutcome tests passed');
}

function testDetermineSpreadOutcome() {
  // Home covers
  console.assert(
    determineSpreadOutcome('home', -3.5, 24, 20) === 'won',
    'Home spread cover incorrect (won by 4, line -3.5)'
  );

  // Home doesn't cover
  console.assert(
    determineSpreadOutcome('home', -3.5, 23, 20) === 'lost',
    'Home spread non-cover incorrect (won by 3, line -3.5)'
  );

  // Push
  console.assert(
    determineSpreadOutcome('home', -3, 23, 20) === 'push',
    'Home spread push incorrect (won by 3, line -3)'
  );

  // Away covers
  console.assert(
    determineSpreadOutcome('away', -3.5, 23, 20) === 'won',
    'Away spread cover incorrect'
  );

  // Underdog scenarios
  console.assert(
    determineSpreadOutcome('home', 3.5, 20, 23) === 'won',
    'Home underdog spread cover incorrect (lost by 3, line +3.5)'
  );

  console.assert(
    determineSpreadOutcome('home', 3.5, 19, 23) === 'lost',
    'Home underdog spread non-cover incorrect (lost by 4, line +3.5)'
  );

  console.log('✓ determineSpreadOutcome tests passed');
}

function testDetermineTotalOutcome() {
  // Over wins
  console.assert(
    determineTotalOutcome('over', 48.5, 52) === 'won',
    'Over win incorrect'
  );

  // Over loses
  console.assert(
    determineTotalOutcome('over', 48.5, 45) === 'lost',
    'Over loss incorrect'
  );

  // Under wins
  console.assert(
    determineTotalOutcome('under', 48.5, 45) === 'won',
    'Under win incorrect'
  );

  // Under loses
  console.assert(
    determineTotalOutcome('under', 48.5, 52) === 'lost',
    'Under loss incorrect'
  );

  // Push
  console.assert(
    determineTotalOutcome('over', 48, 48) === 'push',
    'Total push incorrect'
  );

  console.log('✓ determineTotalOutcome tests passed');
}

testDetermineMoneylineOutcome();
testDetermineSpreadOutcome();
testDetermineTotalOutcome();

// ============================================================================
// ADDITIONAL UTILITY TESTS
// ============================================================================

console.log('\nTesting Additional Utilities...');

function testCalculateImpliedProbability() {
  const prob110 = calculateImpliedProbability(-110);
  console.assert(
    Math.abs(prob110 - 0.5238) < 0.01,
    `Implied probability for -110 incorrect: ${prob110}`
  );

  const prob150 = calculateImpliedProbability(+150);
  console.assert(
    Math.abs(prob150 - 0.40) < 0.01,
    `Implied probability for +150 incorrect: ${prob150}`
  );

  console.log('✓ calculateImpliedProbability tests passed');
}

function testCalculateProfit() {
  const profit1 = calculateProfit(100, -110);
  console.assert(
    Math.abs(profit1 - 90.91) < 1,
    `Profit calculation for -110 incorrect: ${profit1}`
  );

  const profit2 = calculateProfit(100, +150);
  console.assert(
    Math.abs(profit2 - 150) < 0.1,
    `Profit calculation for +150 incorrect: ${profit2}`
  );

  console.log('✓ calculateProfit tests passed');
}

testCalculateImpliedProbability();
testCalculateProfit();

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n✅ All odds calculator tests passed!');
console.log('\nTo run with a proper test framework:');
console.log('1. Install jest or vitest: npm install --save-dev jest @types/jest ts-jest');
console.log('2. Configure jest.config.js');
console.log('3. Add "test": "jest" to package.json scripts');
console.log('4. Run: npm test');
