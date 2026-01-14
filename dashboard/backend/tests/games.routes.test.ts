/**
 * Integration tests for Games Routes
 * 
 * Tests game listing, filtering, and retrieval endpoints
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import app from '../src/app';
// Mock Prisma - external object pattern
const mockPrisma = {
  game: {
    findMany: jest.fn<any>(),
    findUnique: jest.fn<any>(),
    count: jest.fn<any>()
  },
  odds: {
    findMany: jest.fn<any>()
  },
  sport: {
    findUnique: jest.fn<any>()
  }
};

jest.mock('../src/config/database', () => ({
  prisma: mockPrisma
}));

// Get mocked instances after imports
import { prisma } from '../src/config/database';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Games Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/games', () => {
    it('should list all games', async () => {
      const mockGames = [
        {
          id: 'game-1',
          sportKey: 'basketball_nba',
          sportName: 'NBA',
          homeTeamName: 'Los Angeles Lakers',
          awayTeamName: 'Boston Celtics',
          commenceTime: new Date('2026-01-15T19:30:00Z'),
          status: 'scheduled',
          sport: {
            id: 1,
            key: 'basketball_nba',
            name: 'NBA',
            groupName: 'Basketball'
          }
        },
        {
          id: 'game-2',
          sportKey: 'americanfootball_nfl',
          sportName: 'NFL',
          homeTeamName: 'Kansas City Chiefs',
          awayTeamName: 'Buffalo Bills',
          commenceTime: new Date('2026-01-16T18:00:00Z'),
          status: 'scheduled',
          sport: {
            id: 2,
            key: 'americanfootball_nfl',
            name: 'NFL',
            groupName: 'American Football'
          }
        }
      ];

      mockPrisma.game.findMany.mockResolvedValue(mockGames as any);
      mockPrisma.game.count.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/games')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
    });

    it('should filter games by sport', async () => {
      const mockGames = [
        {
          id: 'game-1',
          sportKey: 'basketball_nba',
          sportName: 'NBA',
          homeTeamName: 'Los Angeles Lakers',
          awayTeamName: 'Boston Celtics',
          sport: { 
            id: 1, 
            key: 'basketball_nba', 
            name: 'NBA',
            groupName: 'Basketball'
          }
        }
      ];

      mockPrisma.game.findMany.mockResolvedValue(mockGames as any);
      mockPrisma.game.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/games?sport=basketball_nba')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].sportKey).toBe('basketball_nba');
      expect(mockPrisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sportKey: 'basketball_nba'
          })
        })
      );
    });

    it('should filter games by date with timezone awareness', async () => {
      mockPrisma.game.findMany.mockResolvedValue([]);
      mockPrisma.game.count.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/games?date=2026-01-15&timezoneOffset=420')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(mockPrisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            commenceTime: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date)
            })
          })
        })
      );
    });

    it('should filter games by status', async () => {
      const mockGames = [
        {
          id: 'game-1',
          status: 'completed',
          homeScore: 110,
          awayScore: 105,
          sport: { 
            id: 1,
            key: 'basketball_nba', 
            name: 'NBA',
            groupName: 'Basketball'
          }
        }
      ];

      mockPrisma.game.findMany.mockResolvedValue(mockGames as any);
      mockPrisma.game.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/games?status=completed')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.data[0].status).toBe('completed');
      expect(mockPrisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'completed'
          })
        })
      );
    });

    it('should support pagination', async () => {
      mockPrisma.game.findMany.mockResolvedValue([]);
      mockPrisma.game.count.mockResolvedValue(100);

      const response = await request(app)
        .get('/api/games?page=2&limit=20')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(20);
      expect(response.body.pagination.total).toBe(100);
      expect(response.body.pagination.totalPages).toBe(5);
      expect(mockPrisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20
        })
      );
    });

    it('should handle database errors', async () => {
      mockPrisma.game.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/games')
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/games/:id', () => {
    it('should return game with odds', async () => {
      const mockGame = {
        id: 'game-1',
        sportKey: 'basketball_nba',
        sportName: 'NBA',
        homeTeamName: 'Los Angeles Lakers',
        awayTeamName: 'Boston Celtics',
        commenceTime: new Date('2026-01-15T19:30:00Z'),
        status: 'scheduled',
        sport: {
          id: 1,
          key: 'basketball_nba',
          name: 'NBA',
          groupName: 'Basketball'
        }
      };

      const mockOdds = [
        {
          id: 'odds-1',
          gameId: 'game-1',
          bookmaker: 'draftkings',
          marketType: 'h2h',
          homeOdds: -150,
          awayOdds: 130
        }
      ];

      mockPrisma.game.findUnique.mockResolvedValue(mockGame as any);
      mockPrisma.odds.findMany.mockResolvedValue(mockOdds as any);

      const response = await request(app)
        .get('/api/games/game-1')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.id).toBe('game-1');
      expect(response.body.data.odds).toHaveLength(1);
    });

    it('should return 404 for non-existent game', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/games/nonexistent-id')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('not found');
    });

    it('should handle invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/games/invalid-uuid')
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/games/:id/odds', () => {
    it('should return game odds grouped by market type', async () => {
      const mockGame = {
        id: 'game-1',
        homeTeamName: 'Lakers',
        awayTeamName: 'Celtics'
      };

      const mockOdds = [
        {
          id: 'odds-1',
          bookmaker: 'draftkings',
          marketType: 'h2h',
          homeOdds: -150,
          awayOdds: 130
        },
        {
          id: 'odds-2',
          bookmaker: 'fanduel',
          marketType: 'h2h',
          homeOdds: -145,
          awayOdds: 125
        },
        {
          id: 'odds-3',
          bookmaker: 'draftkings',
          marketType: 'spreads',
          homeOdds: -110,
          homePoint: -3.5,
          awayOdds: -110,
          awayPoint: 3.5
        }
      ];

      mockPrisma.game.findUnique.mockResolvedValue(mockGame as any);
      mockPrisma.odds.findMany.mockResolvedValue(mockOdds as any);

      const response = await request(app)
        .get('/api/games/game-1/odds')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('h2h');
      expect(response.body.data).toHaveProperty('spreads');
      expect(response.body.data.h2h).toHaveLength(2);
      expect(response.body.data.spreads).toHaveLength(1);
    });

    it('should filter odds by bookmaker', async () => {
      const mockGame = { id: 'game-1' };
      const mockOdds = [
        {
          id: 'odds-1',
          bookmaker: 'draftkings',
          marketType: 'h2h'
        }
      ];

      mockPrisma.game.findUnique.mockResolvedValue(mockGame as any);
      mockPrisma.odds.findMany.mockResolvedValue(mockOdds as any);

      const response = await request(app)
        .get('/api/games/game-1/odds?bookmaker=draftkings')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(mockPrisma.odds.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            gameId: 'game-1',
            bookmaker: 'draftkings'
          })
        })
      );
    });

    it('should return 404 for non-existent game', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/games/nonexistent-id/odds')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/games/sport/:sportKey', () => {
    it('should return games for specific sport', async () => {
      const mockSport = {
        id: 1,
        key: 'basketball_nba',
        name: 'NBA',
        groupName: 'Basketball',
        isActive: true
      };

      const mockGames = [
        {
          id: 'game-1',
          sportKey: 'basketball_nba',
          homeTeamName: 'Lakers',
          sport: mockSport
        }
      ];

      mockPrisma.sport.findUnique.mockResolvedValue(mockSport as any);
      mockPrisma.game.findMany.mockResolvedValue(mockGames as any);

      const response = await request(app)
        .get('/api/games/sport/basketball_nba')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveLength(1);
    });

    it('should return 404 for non-existent sport', async () => {
      mockPrisma.sport.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/games/sport/invalid_sport')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body.status).toBe('error');
    });
  });
});