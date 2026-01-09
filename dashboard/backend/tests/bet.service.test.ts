/**
 * Integration tests for Bet Service
 * 
 * Tests bet creation, management, and settlement logic
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { prisma } from '../src/config/database';
import { betService } from '../src/services/bet.service';

describe('Bet Service Integration Tests', () => {
  let testSportId: string;
  let testGameId: string;

  beforeEach(async () => {
    // Create test sport
    const sport = await prisma.sport.create({
      data: {
        key: 'basketball_nba',
        name: 'NBA Basketball',
        active: true
      }
    });
    testSportId = sport.id;

    // Create test game
    const game = await prisma.game.create({
      data: {
        sportId: testSportId,
        externalId: 'test-game-123',
        awayTeamName: 'Test Away Team',
        homeTeamName: 'Test Home Team',
        commenceTime: new Date(Date.now() + 86400000), // Tomorrow
        status: 'scheduled'
      }
    });
    testGameId = game.id;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.betLeg.deleteMany({});
    await prisma.bet.deleteMany({});
    await prisma.game.deleteMany({});
    await prisma.sport.deleteMany({});
  });

  describe('Single Bet Creation', () => {
    it('should create a single moneyline bet', async () => {
      const bet = await betService.createBet({
        name: 'Test ML Bet',
        betType: 'single',
        stake: 100,
        legs: [
          {
            gameId: testGameId,
            selectionType: 'moneyline',
            selection: 'home',
            odds: -110
          }
        ]
      });

      expect(bet.name).toBe('Test ML Bet');
      expect(bet.betType).toBe('single');
      expect(bet.stake.toNumber()).toBe(100);
      expect(bet.status).toBe('pending');
      expect(bet.legs).toHaveLength(1);
      expect(bet.legs[0].selectionType).toBe('moneyline');
      expect(bet.oddsAtPlacement).toBe(-110);
    });

    it('should create a single spread bet with line', async () => {
      const bet = await betService.createBet({
        name: 'Test Spread Bet',
        betType: 'single',
        stake: 50,
        legs: [
          {
            gameId: testGameId,
            selectionType: 'spread',
            selection: 'away',
            odds: -110,
            line: -3.5
          }
        ]
      });

      expect(bet.legs[0].selectionType).toBe('spread');
      expect(bet.legs[0].line?.toNumber()).toBe(-3.5);
      expect(bet.legs[0].selection).toBe('away');
    });

    it('should calculate potential payout correctly for positive odds', async () => {
      const bet = await betService.createBet({
        name: 'Positive Odds Test',
        betType: 'single',
        stake: 100,
        legs: [
          {
            gameId: testGameId,
            selectionType: 'moneyline',
            selection: 'away',
            odds: 150 // +150 odds
          }
        ]
      });

      // Stake $100 at +150 = $100 + ($100 * 150/100) = $250
      expect(bet.potentialPayout?.toNumber()).toBe(250);
    });

    it('should calculate potential payout correctly for negative odds', async () => {
      const bet = await betService.createBet({
        name: 'Negative Odds Test',
        betType: 'single',
        stake: 110,
        legs: [
          {
            gameId: testGameId,
            selectionType: 'moneyline',
            selection: 'home',
            odds: -110
          }
        ]
      });

      // Stake $110 at -110 = $110 + ($110 * 100/110) = $210
      expect(bet.potentialPayout?.toNumber()).toBeCloseTo(210, 0);
    });
  });

  describe('Parlay Bet Creation', () => {
    let testGameId2: string;

    beforeEach(async () => {
      // Create second test game
      const game2 = await prisma.game.create({
        data: {
          sportId: testSportId,
          externalId: 'test-game-456',
          awayTeamName: 'Test Away 2',
          homeTeamName: 'Test Home 2',
          commenceTime: new Date(Date.now() + 86400000),
          status: 'scheduled'
        }
      });
      testGameId2 = game2.id;
    });

    it('should create a 2-leg parlay', async () => {
      const bet = await betService.createBet({
        name: 'Test Parlay',
        betType: 'parlay',
        stake: 50,
        legs: [
          {
            gameId: testGameId,
            selectionType: 'moneyline',
            selection: 'home',
            odds: -110
          },
          {
            gameId: testGameId2,
            selectionType: 'moneyline',
            selection: 'away',
            odds: -110
          }
        ]
      });

      expect(bet.betType).toBe('parlay');
      expect(bet.legs).toHaveLength(2);
      expect(bet.status).toBe('pending');
    });

    it('should calculate parlay odds correctly', async () => {
      const bet = await betService.createBet({
        name: 'Parlay Odds Test',
        betType: 'parlay',
        stake: 100,
        legs: [
          {
            gameId: testGameId,
            selectionType: 'moneyline',
            selection: 'home',
            odds: -110
          },
          {
            gameId: testGameId2,
            selectionType: 'moneyline',
            selection: 'away',
            odds: -110
          }
        ]
      });

      // -110 + -110 parlay should be approximately +264
      expect(bet.oddsAtPlacement).toBeGreaterThan(250);
      expect(bet.oddsAtPlacement).toBeLessThan(280);
    });
  });

  describe('Bet Settlement', () => {
    it('should settle a winning single bet', async () => {
      const bet = await betService.createBet({
        name: 'Winning Bet',
        betType: 'single',
        stake: 100,
        legs: [
          {
            gameId: testGameId,
            selectionType: 'moneyline',
            selection: 'home',
            odds: -110
          }
        ]
      });

      // Update leg status to won
      await prisma.betLeg.update({
        where: { id: bet.legs[0].id },
        data: { status: 'won' }
      });

      // Settle bet
      const settledBet = await betService.settleBet(bet.id);

      expect(settledBet.status).toBe('won');
      expect(settledBet.actualPayout).toBeDefined();
      expect(settledBet.actualPayout?.toNumber()).toBeGreaterThan(100);
      expect(settledBet.settledAt).toBeDefined();
    });

    it('should settle a losing single bet', async () => {
      const bet = await betService.createBet({
        name: 'Losing Bet',
        betType: 'single',
        stake: 100,
        legs: [
          {
            gameId: testGameId,
            selectionType: 'moneyline',
            selection: 'home',
            odds: -110
          }
        ]
      });

      // Update leg status to lost
      await prisma.betLeg.update({
        where: { id: bet.legs[0].id },
        data: { status: 'lost' }
      });

      // Settle bet
      const settledBet = await betService.settleBet(bet.id);

      expect(settledBet.status).toBe('lost');
      expect(settledBet.actualPayout?.toNumber()).toBe(0);
    });

    it('should settle a push bet', async () => {
      const bet = await betService.createBet({
        name: 'Push Bet',
        betType: 'single',
        stake: 100,
        legs: [
          {
            gameId: testGameId,
            selectionType: 'spread',
            selection: 'home',
            odds: -110,
            line: -3
          }
        ]
      });

      // Update leg status to push
      await prisma.betLeg.update({
        where: { id: bet.legs[0].id },
        data: { status: 'push' }
      });

      // Settle bet
      const settledBet = await betService.settleBet(bet.id);

      expect(settledBet.status).toBe('push');
      expect(settledBet.actualPayout?.toNumber()).toBe(100); // Stake returned
    });
  });

  describe('Parlay Settlement', () => {
    let testGameId2: string;

    beforeEach(async () => {
      const game2 = await prisma.game.create({
        data: {
          sportId: testSportId,
          externalId: 'test-game-789',
          awayTeamName: 'Test Away 3',
          homeTeamName: 'Test Home 3',
          commenceTime: new Date(Date.now() + 86400000),
          status: 'scheduled'
        }
      });
      testGameId2 = game2.id;
    });

    it('should win parlay when all legs win', async () => {
      const bet = await betService.createBet({
        name: 'All Win Parlay',
        betType: 'parlay',
        stake: 100,
        legs: [
          {
            gameId: testGameId,
            selectionType: 'moneyline',
            selection: 'home',
            odds: -110
          },
          {
            gameId: testGameId2,
            selectionType: 'moneyline',
            selection: 'away',
            odds: -110
          }
        ]
      });

      // Mark all legs as won
      await prisma.betLeg.updateMany({
        where: { betId: bet.id },
        data: { status: 'won' }
      });

      const settledBet = await betService.settleBet(bet.id);

      expect(settledBet.status).toBe('won');
      expect(settledBet.actualPayout?.toNumber()).toBeGreaterThan(100);
    });

    it('should lose parlay when one leg loses', async () => {
      const bet = await betService.createBet({
        name: 'One Loss Parlay',
        betType: 'parlay',
        stake: 100,
        legs: [
          {
            gameId: testGameId,
            selectionType: 'moneyline',
            selection: 'home',
            odds: -110
          },
          {
            gameId: testGameId2,
            selectionType: 'moneyline',
            selection: 'away',
            odds: -110
          }
        ]
      });

      // Mark first leg as won, second as lost
      await prisma.betLeg.update({
        where: { id: bet.legs[0].id },
        data: { status: 'won' }
      });
      await prisma.betLeg.update({
        where: { id: bet.legs[1].id },
        data: { status: 'lost' }
      });

      const settledBet = await betService.settleBet(bet.id);

      expect(settledBet.status).toBe('lost');
      expect(settledBet.actualPayout?.toNumber()).toBe(0);
    });

    it('should recalculate parlay with pushes', async () => {
      const bet = await betService.createBet({
        name: 'Parlay With Push',
        betType: 'parlay',
        stake: 100,
        legs: [
          {
            gameId: testGameId,
            selectionType: 'moneyline',
            selection: 'home',
            odds: -110
          },
          {
            gameId: testGameId2,
            selectionType: 'spread',
            selection: 'away',
            odds: -110,
            line: -3
          }
        ]
      });

      // Mark first leg as won, second as push
      await prisma.betLeg.update({
        where: { id: bet.legs[0].id },
        data: { status: 'won' }
      });
      await prisma.betLeg.update({
        where: { id: bet.legs[1].id },
        data: { status: 'push' }
      });

      const settledBet = await betService.settleBet(bet.id);

      // Should become single bet with first leg's odds
      expect(settledBet.status).toBe('won');
      expect(settledBet.actualPayout?.toNumber()).toBeGreaterThan(100);
      expect(settledBet.actualPayout?.toNumber()).toBeLessThan(bet.potentialPayout?.toNumber() || 0);
    });

    it('should push parlay when all legs push', async () => {
      const bet = await betService.createBet({
        name: 'All Push Parlay',
        betType: 'parlay',
        stake: 100,
        legs: [
          {
            gameId: testGameId,
            selectionType: 'spread',
            selection: 'home',
            odds: -110,
            line: -3
          },
          {
            gameId: testGameId2,
            selectionType: 'spread',
            selection: 'away',
            odds: -110,
            line: -3
          }
        ]
      });

      // Mark all legs as push
      await prisma.betLeg.updateMany({
        where: { betId: bet.id },
        data: { status: 'push' }
      });

      const settledBet = await betService.settleBet(bet.id);

      expect(settledBet.status).toBe('push');
      expect(settledBet.actualPayout?.toNumber()).toBe(100);
    });
  });
});
