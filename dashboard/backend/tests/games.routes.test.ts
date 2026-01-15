/**
 * Integration tests for Games Routes
 * 
 * Tests game listing, filtering, and retrieval endpoints
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';

// Mock Prisma FIRST - before any imports that use database
jest.mock('../src/config/database', () => ({
  prisma: {
    game: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn()
    },
    currentOdds: {
      findMany: jest.fn()
    },
    sport: {
      findUnique: jest.fn()
    }
  }
}));

// Import app AFTER mock is set up
import app from '../src/app';
import { prisma } from '../src/config/database';

// Type assertion for mocked methods
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
          currentOdds: [],
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
          currentOdds: [],
          sport: {
            id: 2,
            key: 'americanfootball_nfl',
            name: 'NFL',
            groupName: 'American Football'
          }
        }
      ];

      mockPrisma.game.findMany.mockResolvedValue(mockGames as any);

      const response = await request(app)
        .get('/api/games')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.games).toHaveLength(2);
      expect(response.body.data.count).toBe(2);
    });

    it('should filter games by sport', async () => {
      const mockSport = {
        id: 1,
        key: 'basketball_nba',
        name: 'NBA'
      };

      const mockGames = [
        {
          id: 'game-1',
          homeTeamName: 'Los Angeles Lakers',
          awayTeamName: 'Boston Celtics',
          currentOdds: [],
          sport: mockSport
        }
      ];

      mockPrisma.sport.findUnique.mockResolvedValue(mockSport as any);
      mockPrisma.game.findMany.mockResolvedValue(mockGames as any);

      const response = await request(app)
        .get('/api/games?sport=basketball_nba')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.data.games).toHaveLength(1);
      expect(response.body.data.games[0].sportKey).toBe('basketball_nba');
    });

    it('should filter games by date with timezone awareness', async () => {
      mockPrisma.game.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/games?date=2026-01-15&timezoneOffset=420')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.games).toHaveLength(0);
      expect(mockPrisma.game.findMany).toHaveBeenCalled();
    });

    it('should filter games by status', async () => {
      const mockGames = [
        {
          id: 'game-1',
          status: 'completed',
          homeScore: 110,
          awayScore: 105,
          currentOdds: [],
          sport: { 
            id: 1,
            key: 'basketball_nba', 
            name: 'NBA'
          }
        }
      ];

      mockPrisma.game.findMany.mockResolvedValue(mockGames as any);

      const response = await request(app)
        .get('/api/games?status=completed')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.data.games[0].status).toBe('completed');
    });

    it('should handle empty results', async () => {
      mockPrisma.game.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/games')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.data.games).toHaveLength(0);
      expect(response.body.data.count).toBe(0);
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
    it('should return game with currentOdds', async () => {
      const mockGame = {
        id: 'game-1',
        homeTeamName: 'Los Angeles Lakers',
        awayTeamName: 'Boston Celtics',
        commenceTime: new Date('2026-01-15T19:30:00Z'),
        status: 'scheduled',
        currentOdds: [
          {
            id: 'odds-1',
            bookmaker: 'draftkings',
            marketType: 'h2h',
            homePrice: -150,
            awayPrice: 130
          }
        ],
        sport: {
          id: 1,
          key: 'basketball_nba',
          name: 'NBA'
        }
      };

      mockPrisma.game.findUnique.mockResolvedValue(mockGame as any);

      const response = await request(app)
        .get('/api/games/game-1')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.id).toBe('game-1');
      expect(response.body.data.currentOdds).toHaveLength(1);
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
  });

  describe('GET /api/games/:id/odds', () => {
    it('should return game odds', async () => {
      const mockOdds = [
        {
          id: 'odds-1',
          bookmaker: 'draftkings',
          marketType: 'h2h',
          homePrice: -150,
          awayPrice: 130
        },
        {
          id: 'odds-2',
          bookmaker: 'fanduel',
          marketType: 'h2h',
          homePrice: -145,
          awayPrice: 125
        }
      ];

      mockPrisma.currentOdds.findMany.mockResolvedValue(mockOdds as any);

      const response = await request(app)
        .get('/api/games/game-1/odds')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveLength(2);
    });

    it('should filter odds by bookmaker', async () => {
      const mockOdds = [
        {
          id: 'odds-1',
          bookmaker: 'draftkings',
          marketType: 'h2h'
        }
      ];

      mockPrisma.currentOdds.findMany.mockResolvedValue(mockOdds as any);

      const response = await request(app)
        .get('/api/games/game-1/odds?bookmaker=draftkings')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveLength(1);
    });

    it('should return empty array when no odds', async () => {
      mockPrisma.currentOdds.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/games/game-1/odds')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveLength(0);
    });
  });
});