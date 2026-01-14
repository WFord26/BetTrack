/**
 * Unit tests for Outcome Resolver Service
 * 
 * Tests bet settlement and game outcome resolution from ESPN API
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { OutcomeResolverService } from '../src/services/outcome-resolver.service';
import { Decimal } from '@prisma/client/runtime/library';

// GameResult type definition
interface GameResult {
  homeScore: number;
  awayScore: number;
  status: string;
  completed: boolean;
}

// Mock Prisma - create inside factory to avoid hoisting issues
jest.mock('../src/config/database', () => ({
  prisma: {
    game: {
      findMany: jest.fn(),
      update: jest.fn()
    },
    betLeg: {
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    bet: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn()
    }
  }
}));

// Get mocked instances after imports
import { prisma } from '../src/config/database';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Mock odds calculator utilities
jest.mock('../src/utils/odds-calculator', () => ({
  determineMoneylineOutcome: jest.fn(),
  determineSpreadOutcome: jest.fn(),
  determineTotalOutcome: jest.fn(),
  calculateParlayOdds: jest.fn(),
  calculatePayout: jest.fn(),
  decimalToAmerican: jest.fn()
}));

describe('OutcomeResolverService', () => {
  let service: OutcomeResolverService;
  let mockAxios: MockAdapter;

  beforeEach(() => {
    service = new OutcomeResolverService();
    mockAxios = new MockAdapter(axios);
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockAxios.reset();
  });

  describe('resolveOutcomes', () => {
    it('should resolve outcomes for completed games', async () => {
      const mockGames = [
        {
          id: 'game-1',
          externalId: 'event-123',
          sportKey: 'basketball_nba',
          awayTeamName: 'Boston Celtics',
          homeTeamName: 'Los Angeles Lakers',
          status: 'scheduled'
        }
      ];

      const mockEspnResponse = {
        events: [{
          id: '401585578',
          competitions: [{
            status: {
              type: { completed: true }
            },
            competitors: [
              {
                homeAway: 'home',
                team: { displayName: 'Los Angeles Lakers' },
                score: '110'
              },
              {
                homeAway: 'away',
                team: { displayName: 'Boston Celtics' },
                score: '105'
              }
            ]
          }]
        }]
      };

      mockPrisma.game.findMany.mockResolvedValue(mockGames as any);
      mockPrisma.game.update.mockResolvedValue(mockGames[0] as any);
      mockPrisma.betLeg.findMany.mockResolvedValue([]);
      mockAxios.onGet(/scoreboard/).reply(200, mockEspnResponse);

      const result = await service.resolveOutcomes();

      expect(result.success).toBe(true);
      expect(result.gamesChecked).toBeGreaterThan(0);
    });

    it('should handle API errors gracefully', async () => {
      const mockGames = [
        {
          id: 'game-1',
          sportKey: 'basketball_nba',
          awayTeamName: 'Boston Celtics',
          homeTeamName: 'Los Angeles Lakers',
          status: 'scheduled'
        }
      ];

      mockPrisma.game.findMany.mockResolvedValue(mockGames as any);
      mockAxios.onGet(/scoreboard/).networkError();

      const result = await service.resolveOutcomes();

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should skip games that are not completed', async () => {
      const mockGames = [
        {
          id: 'game-1',
          sportKey: 'basketball_nba',
          awayTeamName: 'Boston Celtics',
          homeTeamName: 'Los Angeles Lakers',
          status: 'scheduled'
        }
      ];

      const mockEspnResponse = {
        events: [{
          competitions: [{
            status: {
              type: { completed: false }
            },
            competitors: []
          }]
        }]
      };

      mockPrisma.game.findMany.mockResolvedValue(mockGames as any);
      mockAxios.onGet(/scoreboard/).reply(200, mockEspnResponse);

      const result = await service.resolveOutcomes();

      expect(result.success).toBe(true);
      expect(result.betsSettled).toBe(0);
    });
  });

  describe('checkGameResult', () => {
    it('should fetch and parse game result from ESPN', async () => {
      const mockGame = {
        id: 'game-1',
        externalId: 'event-123',
        sportKey: 'basketball_nba',
        awayTeamName: 'Boston Celtics',
        homeTeamName: 'Los Angeles Lakers'
      };

      const mockEspnResponse = {
        events: [{
          competitions: [{
            status: {
              type: { completed: true }
            },
            competitors: [
              {
                homeAway: 'home',
                team: { displayName: 'Los Angeles Lakers' },
                score: '110'
              },
              {
                homeAway: 'away',
                team: { displayName: 'Boston Celtics' },
                score: '105'
              }
            ]
          }]
        }]
      };

      mockAxios.onGet(/scoreboard/).reply(200, mockEspnResponse);

      const result = await service.checkGameResult(mockGame);

      expect(result).not.toBeNull();
      expect(result?.homeScore).toBe(110);
      expect(result?.awayScore).toBe(105);
    });

    it('should return null when game is not found', async () => {
      const mockGame = {
        id: 'game-1',
        sportKey: 'basketball_nba',
        awayTeamName: 'Nonexistent Team',
        homeTeamName: 'Another Fake Team'
      };

      const mockEspnResponse = {
        events: []
      };

      mockAxios.onGet(/scoreboard/).reply(200, mockEspnResponse);

      const result = await service.checkGameResult(mockGame);

      expect(result).toBeNull();
    });

    it('should return null when game is not completed', async () => {
      const mockGame = {
        id: 'game-1',
        sportKey: 'basketball_nba',
        awayTeamName: 'Boston Celtics',
        homeTeamName: 'Los Angeles Lakers'
      };

      const mockEspnResponse = {
        events: [{
          competitions: [{
            status: {
              type: { completed: false }
            },
            competitors: []
          }]
        }]
      };

      mockAxios.onGet(/scoreboard/).reply(200, mockEspnResponse);

      const result = await service.checkGameResult(mockGame);

      expect(result).toBeNull();
    });

    it('should handle API timeout', async () => {
      const mockGame = {
        id: 'game-1',
        sportKey: 'basketball_nba',
        awayTeamName: 'Boston Celtics',
        homeTeamName: 'Los Angeles Lakers'
      };

      mockAxios.onGet(/scoreboard/).timeout();

      const result = await service.checkGameResult(mockGame);

      expect(result).toBeNull();
    });

    it('should parse scores correctly for different sports', async () => {
      const mockGame = {
        id: 'game-1',
        sportKey: 'americanfootball_nfl',
        awayTeamName: 'Buffalo Bills',
        homeTeamName: 'Kansas City Chiefs'
      };

      const mockEspnResponse = {
        events: [{
          competitions: [{
            status: {
              type: { completed: true }
            },
            competitors: [
              {
                homeAway: 'home',
                team: { displayName: 'Kansas City Chiefs' },
                score: '28'
              },
              {
                homeAway: 'away',
                team: { displayName: 'Buffalo Bills' },
                score: '24'
              }
            ]
          }]
        }]
      };

      mockAxios.onGet(/scoreboard/).reply(200, mockEspnResponse);

      const result = await service.checkGameResult(mockGame);

      expect(result).not.toBeNull();
      expect(result?.homeScore).toBe(28);
      expect(result?.awayScore).toBe(24);
    });
  });

  describe('updateGameScore', () => {
    it('should update game with final scores and mark as completed', async () => {
      const gameResult: GameResult = {
        homeScore: 110,
        awayScore: 105,
        status: 'completed',
        completed: true
      };

      mockPrisma.game.update.mockResolvedValue({
        id: 'game-1',
        homeScore: 110,
        awayScore: 105,
        status: 'completed'
      } as any);

      await service.updateGameScore('game-1', gameResult);

      expect(mockPrisma.game.update).toHaveBeenCalledWith({
        where: { id: 'game-1' },
        data: {
          homeScore: 110,
          awayScore: 105,
          status: 'completed'
        }
      });
    });

    it('should handle update errors', async () => {
      const gameResult: GameResult = {
        homeScore: 110,
        awayScore: 105,
        status: 'completed',
        completed: true
      };

      mockPrisma.game.update.mockRejectedValue(new Error('Database error'));

      await expect(service.updateGameScore('game-1', gameResult)).rejects.toThrow();
    });
  });

  describe('settleBetLegs', () => {
    it('should settle moneyline bet legs', async () => {
      const mockBetLegs = [
        {
          id: 'leg-1',
          betId: 'bet-1',
          selectionType: 'moneyline',
          selection: 'home',
          oddsAtPlacement: -110
        }
      ];

      const gameResult: GameResult = {
        homeScore: 110,
        awayScore: 105,
        status: 'completed',
        completed: true
      };

      const { determineMoneylineOutcome } = await import('../src/utils/odds-calculator');
      (determineMoneylineOutcome as jest.Mock).mockReturnValue('won');
      mockPrisma.betLeg.findMany.mockResolvedValue(mockBetLegs as any);
      mockPrisma.betLeg.update.mockResolvedValue({ ...mockBetLegs[0], status: 'won' } as any);

      const result = await service.settleBetLegs('game-1', gameResult);

      expect(result.legsSettled).toBe(1);
      expect(mockPrisma.betLeg.update).toHaveBeenCalledWith({
        where: { id: 'leg-1' },
        data: { outcome: 'won' }
      });
    });

    it('should settle spread bet legs', async () => {
      const mockBetLegs = [
        {
          id: 'leg-1',
          betId: 'bet-1',
          selectionType: 'spread',
          selection: 'home',
          line: -3.5,
          oddsAtPlacement: -110
        }
      ];

      const gameResult: GameResult = {
        homeScore: 110,
        awayScore: 105,
        status: 'completed',
        completed: true
      };

      const { determineSpreadOutcome } = await import('../src/utils/odds-calculator');
      (determineSpreadOutcome as jest.Mock).mockReturnValue('won');
      mockPrisma.betLeg.findMany.mockResolvedValue(mockBetLegs as any);
      mockPrisma.betLeg.update.mockResolvedValue({ ...mockBetLegs[0], status: 'won' } as any);

      const result = await service.settleBetLegs('game-1', gameResult);

      expect(result.legsSettled).toBe(1);
      expect(determineSpreadOutcome).toHaveBeenCalled();
    });

    it('should settle totals bet legs', async () => {
      const mockBetLegs = [
        {
          id: 'leg-1',
          betId: 'bet-1',
          selectionType: 'total',
          selection: 'over',
          line: 225.5,
          oddsAtPlacement: -110
        }
      ];

      const gameResult: GameResult = {
        homeScore: 110,
        awayScore: 105,
        status: 'completed',
        completed: true
      };

      const { determineTotalOutcome } = await import('../src/utils/odds-calculator');
      (determineTotalOutcome as jest.Mock).mockReturnValue('lost');
      mockPrisma.betLeg.findMany.mockResolvedValue(mockBetLegs as any);
      mockPrisma.betLeg.update.mockResolvedValue({ ...mockBetLegs[0], status: 'lost' } as any);

      const result = await service.settleBetLegs('game-1', gameResult);

      expect(result.legsSettled).toBe(1);
      expect(determineTotalOutcome).toHaveBeenCalled();
    });

    it('should handle push outcomes', async () => {
      const mockBetLegs = [
        {
          id: 'leg-1',
          betId: 'bet-1',
          selectionType: 'spread',
          selection: 'home',
          line: -5.0,
          oddsAtPlacement: -110
        }
      ];

      const gameResult: GameResult = {
        homeScore: 110,
        awayScore: 105,
        status: 'completed',
        completed: true
      };

      const { determineSpreadOutcome } = await import('../src/utils/odds-calculator');
      (determineSpreadOutcome as jest.Mock).mockReturnValue('push');
      mockPrisma.betLeg.findMany.mockResolvedValue(mockBetLegs as any);
      mockPrisma.betLeg.update.mockResolvedValue({ ...mockBetLegs[0], status: 'push' } as any);

      const result = await service.settleBetLegs('game-1', gameResult);

      expect(result.legsSettled).toBe(1);
      expect(result.betsSettled).toBeGreaterThanOrEqual(0);
    });
  });

  describe('checkAndSettleBet', () => {
    it('should settle won single bet', async () => {
      const mockBet = {
        id: 'bet-1',
        betType: 'single',
        stake: new Decimal(100),
        status: 'pending',
        legs: [
          {
            id: 'leg-1',
            outcome: 'won'
          }
        ]
      };

      const { calculatePayout } = await import('../src/utils/odds-calculator');
      (calculatePayout as jest.Mock).mockReturnValue(190.91);
      mockPrisma.bet.findUnique.mockResolvedValue(mockBet as any);
      mockPrisma.bet.update.mockResolvedValue({
        ...mockBet,
        status: 'won',
        actualPayout: new Decimal(264)
      } as any);

      const result = await service.checkAndSettleBet('bet-1');

      expect(result).toBe(true);
      expect(mockPrisma.bet.update).toHaveBeenCalledWith({
        where: { id: 'bet-1' },
        data: {
          status: 'won',
          payout: expect.any(Number)
        }
      });
    });

    it('should settle lost single bet', async () => {
      const mockBet = {
        id: 'bet-1',
        betType: 'single',
        stake: new Decimal(100),
        status: 'pending',
        legs: [
          {
            id: 'leg-1',
            outcome: 'lost'
          }
        ]
      };

      mockPrisma.bet.findUnique.mockResolvedValue(mockBet as any);
      mockPrisma.bet.update.mockResolvedValue({
        ...mockBet,
        status: 'lost',
        actualPayout: new Decimal(0)
      } as any);

      const result = await service.checkAndSettleBet('bet-1');

      expect(result).toBe(true);
      expect(mockPrisma.bet.update).toHaveBeenCalledWith({
        where: { id: 'bet-1' },
        data: {
          status: 'lost',
          payout: 0
        }
      });
    });

    it('should settle won parlay bet', async () => {
      const mockBet = {
        id: 'bet-1',
        betType: 'parlay',
        stake: new Decimal(100),
        status: 'pending',
        legs: [
          {
            id: 'leg-1',
            outcome: 'won',
            oddsAtPlacement: -110
          },
          {
            id: 'leg-2',
            outcome: 'won',
            oddsAtPlacement: -110
          }
        ]
      };

      const { calculateParlayOdds, calculatePayout } = await import('../src/utils/odds-calculator');
      (calculateParlayOdds as jest.Mock).mockReturnValue(2.64);
      (calculatePayout as jest.Mock).mockReturnValue(264);
      mockPrisma.bet.findUnique.mockResolvedValue(mockBet as any);
      mockPrisma.bet.update.mockResolvedValue({
        ...mockBet,
        status: 'won',
        actualPayout: new Decimal(264)
      } as any);

      const result = await service.checkAndSettleBet('bet-1');

      expect(result).toBe(true);
      expect(calculateParlayOdds).toHaveBeenCalled();
    });

    it('should settle lost parlay bet when any leg loses', async () => {
      const mockBet = {
        id: 'bet-1',
        betType: 'parlay',
        stake: new Decimal(100),
        status: 'pending',
        legs: [
          {
            id: 'leg-1',
            outcome: 'won',
            oddsAtPlacement: -110
          },
          {
            id: 'leg-2',
            outcome: 'lost',
            oddsAtPlacement: -110
          }
        ]
      };

      mockPrisma.bet.findUnique.mockResolvedValue(mockBet as any);
      mockPrisma.bet.update.mockResolvedValue({
        ...mockBet,
        status: 'lost',
        payout: new Decimal(0)
      } as any);

      const result = await service.checkAndSettleBet('bet-1');

      expect(result).toBe(true);
      expect(mockPrisma.bet.update).toHaveBeenCalledWith({
        where: { id: 'bet-1' },
        data: {
          status: 'lost',
          actualPayout: 0
        }
      });
    });

    it('should handle push in parlay by removing leg from calculation', async () => {
      const mockBet = {
        id: 'bet-1',
        betType: 'parlay',
        stake: new Decimal(100),
        status: 'pending',
        legs: [
          {
            id: 'leg-1',
            outcome: 'won',
            oddsAtPlacement: -110
          },
          {
            id: 'leg-2',
            outcome: 'push',
            oddsAtPlacement: -110
          },
          {
            id: 'leg-3',
            outcome: 'won',
            oddsAtPlacement: -110
          }
        ]
      };

      const { calculateParlayOdds, calculatePayout } = await import('../src/utils/odds-calculator');
      (calculateParlayOdds as jest.Mock).mockReturnValue(2.64);
      (calculatePayout as jest.Mock).mockReturnValue(264);
      mockPrisma.bet.findUnique.mockResolvedValue(mockBet as any);
      mockPrisma.bet.update.mockResolvedValue({
        ...mockBet,
        status: 'won',
        actualPayout: new Decimal(264)
      } as any);

      const result = await service.checkAndSettleBet('bet-1');

      expect(result).toBe(true);
    });

    it('should not settle bet if legs are still pending', async () => {
      const mockBet = {
        id: 'bet-1',
        betType: 'parlay',
        stake: new Decimal(100),
        status: 'pending',
        legs: [
          {
            id: 'leg-1',
            outcome: 'won'
          },
          {
            id: 'leg-2',
            outcome: null
          }
        ]
      };

      mockPrisma.bet.findUnique.mockResolvedValue(mockBet as any);

      const result = await service.checkAndSettleBet('bet-1');

      expect(result).toBe(false);
      expect(mockPrisma.bet.update).not.toHaveBeenCalled();
    });

    it('should return false when bet is not found', async () => {
      mockPrisma.bet.findUnique.mockResolvedValue(null);

      const result = await service.checkAndSettleBet('nonexistent-bet');

      expect(result).toBe(false);
    });
  });
});
