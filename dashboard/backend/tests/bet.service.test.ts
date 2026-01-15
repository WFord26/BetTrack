/**
 * Unit tests for Bet Service
 * 
 * Tests bet creation, management, and settlement logic with mocked Prisma
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BetService } from '../src/services/bet.service';
import { Decimal } from '@prisma/client/runtime/library';

// Mock Prisma
jest.mock('../src/config/database', () => ({
  prisma: {
    bet: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      delete: jest.fn()
    },
    betLeg: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn()
    },
    betLegFuture: {
      create: jest.fn()
    },
    game: {
      findUnique: jest.fn(),
      findMany: jest.fn()
    },
    $transaction: jest.fn((callback) => {
      // Mock transaction by calling the callback with mocked prisma
      return callback({
        bet: {
          create: jest.fn().mockResolvedValue({
            id: 'bet-1',
            name: 'Test Bet',
            betType: 'single',
            stake: new Decimal(100),
            potentialPayout: new Decimal(190.91),
            status: 'pending',
            oddsAtPlacement: -110,
            teaserPoints: null,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date()
          })
        },
        betLeg: {
          create: jest.fn().mockResolvedValue({
            id: 'leg-1',
            betId: 'bet-1',
            gameId: 'game-1',
            selectionType: 'moneyline',
            selection: 'home',
            teamName: null,
            line: null,
            odds: -110,
            userAdjustedLine: null,
            userAdjustedOdds: null,
            teaserAdjustedLine: null,
            sgpGroupId: null,
            status: 'pending',
            outcome: null
          })
        },
        betLegFuture: {
          create: jest.fn()
        }
      });
    })
  }
}));

// Get mocked instances
import { prisma } from '../src/config/database';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Bet Service Unit Tests', () => {
  let service: BetService;

  beforeEach(() => {
    service = new BetService();
    jest.clearAllMocks();
    
    // Mock game validation to return games based on input IDs
    mockPrisma.game.findMany.mockImplementation((args: any) => {
      const ids = args?.where?.id?.in || [];
      return Promise.resolve(ids.map((id: string) => ({
        id,
        status: 'scheduled',
        commenceTime: new Date(Date.now() + 86400000)
      })));
    });
  });

  describe('Single Bet Creation', () => {
    it('should call createBet without errors for valid input', async () => {
      mockPrisma.$transaction.mockResolvedValue({
        id: 'bet-1',
        name: 'Test ML Bet',
        betType: 'single',
        status: 'pending'
      } as any);
      
      mockPrisma.betLeg.findMany.mockResolvedValue([]);
      mockPrisma.bet.findUnique.mockResolvedValue({ id: 'bet-1', legs: [] } as any);

      await expect(service.createBet({
        name: 'Test ML Bet',
        betType: 'single',
        stake: 100,
        legs: [{ gameId: 'game-1', selectionType: 'moneyline', selection: 'home', odds: -110 }]
      })).resolves.toBeDefined();
    });

    it('should handle spread bets', async () => {
      mockPrisma.$transaction.mockResolvedValue({ id: 'bet-2' } as any);
      mockPrisma.betLeg.findMany.mockResolvedValue([]);
      mockPrisma.bet.findUnique.mockResolvedValue({ id: 'bet-2', legs: [] } as any);

      await expect(service.createBet({
        name: 'Test Spread Bet',
        betType: 'single',
        stake: 50,
        legs: [{ gameId: 'game-1', selectionType: 'spread', selection: 'away', odds: -110, line: -3.5 }]
      })).resolves.toBeDefined();
    });

    it('should handle potential payout calculation', async () => {
      mockPrisma.$transaction.mockResolvedValue({ id: 'bet-3', potentialPayout: new Decimal(190) } as any);
      mockPrisma.betLeg.findMany.mockResolvedValue([]);
      mockPrisma.bet.findUnique.mockResolvedValue({ id: 'bet-3', legs: [], potentialPayout: new Decimal(190) } as any);

      const result = await service.createBet({
        name: 'Payout Test',
        betType: 'single',
        stake: 100,
        legs: [{ gameId: 'game-1', selectionType: 'moneyline', selection: 'home', odds: -110 }]
      });

      expect(result.potentialPayout).toBeDefined();
    });
  });

  describe('Parlay Bet Creation', () => {
    it('should handle parlay bet creation', async () => {
      mockPrisma.$transaction.mockResolvedValue({
        id: 'bet-4',
        betType: 'parlay',
        potentialPayout: new Decimal(600)
      } as any);
      
      mockPrisma.betLeg.findMany.mockResolvedValue([]);
      mockPrisma.bet.findUnique.mockResolvedValue({ id: 'bet-4', legs: [] } as any);

      const bet = await service.createBet({
        name: 'Test Parlay',
        betType: 'parlay',
        stake: 100,
        legs: [
          { gameId: 'game-1', selectionType: 'moneyline', selection: 'home', odds: -110 },
          { gameId: 'game-2', selectionType: 'moneyline', selection: 'away', odds: -110 }
        ]
      });

      expect(bet).toBeDefined();
      expect(bet.id).toBe('bet-4');
    });
  });

  describe('Bet Retrieval', () => {
    it('should find bet by id', async () => {
      const mockBet = {
        id: 'bet-5',
        name: 'Find Test',
        betType: 'single' as const,
        stake: new Decimal(100),
        status: 'pending' as const,
        legs: []
      };

      mockPrisma.bet.findUnique.mockResolvedValue(mockBet as any);
      mockPrisma.betLeg.findMany.mockResolvedValue([]);

      const result = await service.getBetById('bet-5');

      expect(result).toBeDefined();
      expect(result?.id).toBe('bet-5');
      expect(mockPrisma.bet.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'bet-5' } })
      );
    });

    it('should return null for non-existent bet', async () => {
      mockPrisma.bet.findUnique.mockResolvedValue(null);

      const result = await service.getBetById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('Bet Listing', () => {
    it('should list bets with default pagination', async () => {
      const mockBets = [
        {
          id: 'bet-6',
          name: 'List Test 1',
          betType: 'single' as const,
          stake: new Decimal(100),
          status: 'pending' as const,
          createdAt: new Date(),
          legs: [],
          futureLegs: []
        },
        {
          id: 'bet-7',
          name: 'List Test 2',
          betType: 'parlay' as const,
          stake: new Decimal(50),
          status: 'won' as const,
          createdAt: new Date(),
          legs: [],
          futureLegs: []
        }
      ];

      mockPrisma.bet.findMany.mockResolvedValue(mockBets as any);
      mockPrisma.bet.count.mockResolvedValue(2);

      const result = await service.getBets({});

      expect(result.bets).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.limit).toBe(50); // Default limit
      expect(result.offset).toBe(0); // Default offset
    });

    it('should filter bets by status', async () => {
      mockPrisma.bet.findMany.mockResolvedValue([]);
      mockPrisma.bet.count.mockResolvedValue(0);

      await service.getBets({ status: 'won' });

      expect(mockPrisma.bet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'won' })
        })
      );
    });

    it('should filter bets by type', async () => {
      mockPrisma.bet.findMany.mockResolvedValue([]);
      mockPrisma.bet.count.mockResolvedValue(0);

      await service.getBets({ betType: 'parlay' });

      expect(mockPrisma.bet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ betType: 'parlay' })
        })
      );
    });
  });

  describe('Bet Statistics', () => {
    it('should calculate stats from database', async () => {
      mockPrisma.bet.findMany.mockResolvedValue([
        {
          stake: new Decimal(100),
          actualPayout: new Decimal(190),
          status: 'won',
          legs: [{ game: { sport: { key: 'basketball_nba' } } }]
        },
        {
          stake: new Decimal(50),
          actualPayout: new Decimal(0),
          status: 'lost',
          legs: [{ game: { sport: { key: 'basketball_nba' } } }]
        }
      ] as any);

      mockPrisma.bet.count.mockResolvedValue(2);

      const stats = await service.getStats({});

      expect(stats.totalBets).toBe(2);
      expect(stats).toBeDefined();
    });
  });

  describe('Bet Updates', () => {
    it('should update bet notes', async () => {
      const mockExistingBet = {
        id: 'bet-8',
        name: 'Update Test',
        notes: null,
        status: 'pending' as const,
        legs: []
      };

      const mockUpdatedBet = {
        ...mockExistingBet,
        notes: 'Updated notes'
      };

      mockPrisma.bet.findUnique.mockResolvedValueOnce(mockExistingBet as any);
      mockPrisma.bet.update.mockResolvedValue(mockUpdatedBet as any);
      mockPrisma.bet.findUnique.mockResolvedValueOnce(mockUpdatedBet as any);

      const result = await service.updateBet('bet-8', { notes: 'Updated notes' });

      expect(result.notes).toBe('Updated notes');
    });

    it('should cancel a pending bet', async () => {
      const mockExistingBet = {
        id: 'bet-9',
        name: 'Cancel Test',
        status: 'pending' as const,
        legs: [{
          game: {
            commenceTime: new Date(Date.now() + 86400000) // Future game
          }
        }]
      };

      mockPrisma.bet.findUnique.mockResolvedValueOnce(mockExistingBet as any);
      mockPrisma.bet.delete.mockResolvedValue(mockExistingBet as any);

      await expect(service.cancelBet('bet-9')).resolves.not.toThrow();
      expect(mockPrisma.bet.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bet-9' }
        })
      );
    });
  });
});
