import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import futuresRoutes from '../src/routes/futures.routes';
import { prisma } from '../src/config/database';

// Mock dependencies
jest.mock('../src/config/database', () => ({
  prisma: {
    sport: {
      findUnique: jest.fn()
    },
    future: {
      findMany: jest.fn(),
      findUnique: jest.fn()
    }
  }
}));

jest.mock('../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Futures Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/futures', futuresRoutes);
  });

  describe('GET /api/futures', () => {
    it('should return all active futures by default', async () => {
      const mockFutures = [
        {
          id: 'future1',
          externalId: 'nba_championship_2026',
          title: 'NBA Championship 2026',
          description: 'Winner of the 2026 NBA Championship',
          sportId: 'sport1',
          status: 'active',
          commenceTime: new Date('2026-06-01'),
          sport: {
            key: 'basketball_nba',
            name: 'NBA'
          },
          currentOdds: [
            {
              id: 'odds1',
              outcome: 'Boston Celtics',
              bookmaker: 'draftkings',
              price: 450,
              lastUpdated: new Date('2026-01-15')
            },
            {
              id: 'odds2',
              outcome: 'Boston Celtics',
              bookmaker: 'fanduel',
              price: 475,
              lastUpdated: new Date('2026-01-15')
            },
            {
              id: 'odds3',
              outcome: 'Los Angeles Lakers',
              bookmaker: 'draftkings',
              price: 650,
              lastUpdated: new Date('2026-01-15')
            }
          ],
          outcomes: []
        }
      ];

      jest.mocked(prisma.future.findMany).mockResolvedValue(mockFutures as any);

      const response = await request(app)
        .get('/api/futures')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe('future1');
      expect(response.body[0].groupedOutcomes).toBeDefined();
      expect(prisma.future.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'active' }
        })
      );
    });

    it('should group odds by outcome with best odds calculation', async () => {
      const mockFutures = [
        {
          id: 'future1',
          title: 'NBA Championship',
          sportId: 'sport1',
          status: 'active',
          sport: { key: 'basketball_nba', name: 'NBA' },
          currentOdds: [
            { outcome: 'Celtics', bookmaker: 'draftkings', price: 450 },
            { outcome: 'Celtics', bookmaker: 'fanduel', price: 475 },
            { outcome: 'Lakers', bookmaker: 'draftkings', price: 650 }
          ],
          outcomes: []
        }
      ];

      jest.mocked(prisma.future.findMany).mockResolvedValue(mockFutures as any);

      const response = await request(app)
        .get('/api/futures')
        .expect(200);

      const groupedOutcomes = response.body[0].groupedOutcomes;
      expect(groupedOutcomes).toHaveLength(2);
      
      const celticsOutcome = groupedOutcomes.find((o: any) => o.outcome === 'Celtics');
      expect(celticsOutcome.bookmakers).toHaveLength(2);
      expect(celticsOutcome.bestOdds).toBe(475);
      
      const lakersOutcome = groupedOutcomes.find((o: any) => o.outcome === 'Lakers');
      expect(lakersOutcome.bookmakers).toHaveLength(1);
      expect(lakersOutcome.bestOdds).toBe(650);
    });

    it('should filter by sportKey when provided', async () => {
      const mockSport = {
        id: 'sport-nba',
        key: 'basketball_nba'
      };

      const mockFutures = [
        {
          id: 'future1',
          title: 'NBA Championship',
          sportId: 'sport-nba',
          status: 'active',
          sport: { key: 'basketball_nba', name: 'NBA' },
          currentOdds: [],
          outcomes: []
        }
      ];

      jest.mocked(prisma.sport.findUnique).mockResolvedValue(mockSport as any);
      jest.mocked(prisma.future.findMany).mockResolvedValue(mockFutures as any);

      const response = await request(app)
        .get('/api/futures?sportKey=basketball_nba')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(prisma.sport.findUnique).toHaveBeenCalledWith({
        where: { key: 'basketball_nba' },
        select: { id: true }
      });
      expect(prisma.future.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'active', sportId: 'sport-nba' }
        })
      );
    });

    it('should filter by status when provided', async () => {
      jest.mocked(prisma.future.findMany).mockResolvedValue([]);

      await request(app)
        .get('/api/futures?status=completed')
        .expect(200);

      expect(prisma.future.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'completed' }
        })
      );
    });

    it('should filter by both sportKey and status', async () => {
      const mockSport = {
        id: 'sport-nfl',
        key: 'americanfootball_nfl'
      };

      jest.mocked(prisma.sport.findUnique).mockResolvedValue(mockSport as any);
      jest.mocked(prisma.future.findMany).mockResolvedValue([]);

      await request(app)
        .get('/api/futures?sportKey=americanfootball_nfl&status=completed')
        .expect(200);

      expect(prisma.future.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'completed', sportId: 'sport-nfl' }
        })
      );
    });

    it('should not filter by sportId when sport not found', async () => {
      jest.mocked(prisma.sport.findUnique).mockResolvedValue(null);
      jest.mocked(prisma.future.findMany).mockResolvedValue([]);

      await request(app)
        .get('/api/futures?sportKey=invalid_sport')
        .expect(200);

      expect(prisma.future.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'active' }
        })
      );
    });

    it('should return empty array when no futures exist', async () => {
      jest.mocked(prisma.future.findMany).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/futures')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should order futures by title ascending', async () => {
      jest.mocked(prisma.future.findMany).mockResolvedValue([]);

      await request(app)
        .get('/api/futures')
        .expect(200);

      expect(prisma.future.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { title: 'asc' }
        })
      );
    });

    it('should include sport details in response', async () => {
      const mockFutures = [
        {
          id: 'future1',
          title: 'Super Bowl Winner',
          sportId: 'sport-nfl',
          status: 'active',
          sport: {
            key: 'americanfootball_nfl',
            name: 'NFL'
          },
          currentOdds: [],
          outcomes: []
        }
      ];

      jest.mocked(prisma.future.findMany).mockResolvedValue(mockFutures as any);

      const response = await request(app)
        .get('/api/futures')
        .expect(200);

      expect(response.body[0].sport.key).toBe('americanfootball_nfl');
      expect(response.body[0].sport.name).toBe('NFL');
    });

    it('should order currentOdds by outcome ascending', async () => {
      jest.mocked(prisma.future.findMany).mockResolvedValue([]);

      await request(app)
        .get('/api/futures')
        .expect(200);

      expect(prisma.future.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            currentOdds: {
              orderBy: { outcome: 'asc' }
            }
          })
        })
      );
    });

    it('should handle database errors', async () => {
      jest.mocked(prisma.future.findMany).mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/futures')
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch futures');
    });

    it('should handle multiple outcomes with varying bookmaker counts', async () => {
      const mockFutures = [
        {
          id: 'future1',
          title: 'NBA MVP',
          sportId: 'sport1',
          status: 'active',
          sport: { key: 'basketball_nba', name: 'NBA' },
          currentOdds: [
            { outcome: 'Luka Doncic', bookmaker: 'draftkings', price: 300 },
            { outcome: 'Luka Doncic', bookmaker: 'fanduel', price: 325 },
            { outcome: 'Luka Doncic', bookmaker: 'betmgm', price: 310 },
            { outcome: 'Nikola Jokic', bookmaker: 'draftkings', price: 400 },
            { outcome: 'Giannis Antetokounmpo', bookmaker: 'fanduel', price: 550 }
          ],
          outcomes: []
        }
      ];

      jest.mocked(prisma.future.findMany).mockResolvedValue(mockFutures as any);

      const response = await request(app)
        .get('/api/futures')
        .expect(200);

      const groupedOutcomes = response.body[0].groupedOutcomes;
      expect(groupedOutcomes).toHaveLength(3);
      
      const lukaOutcome = groupedOutcomes.find((o: any) => o.outcome === 'Luka Doncic');
      expect(lukaOutcome.bookmakers).toHaveLength(3);
      expect(lukaOutcome.bestOdds).toBe(325);
    });

    it('should handle futures with no current odds', async () => {
      const mockFutures = [
        {
          id: 'future1',
          title: 'NBA Championship',
          sportId: 'sport1',
          status: 'active',
          sport: { key: 'basketball_nba', name: 'NBA' },
          currentOdds: [],
          outcomes: []
        }
      ];

      jest.mocked(prisma.future.findMany).mockResolvedValue(mockFutures as any);

      const response = await request(app)
        .get('/api/futures')
        .expect(200);

      expect(response.body[0].groupedOutcomes).toEqual([]);
    });
  });

  describe('GET /api/futures/:id', () => {
    it('should return specific future with grouped outcomes', async () => {
      const mockFuture = {
        id: 'future1',
        externalId: 'nba_championship_2026',
        title: 'NBA Championship 2026',
        description: 'Winner of the 2026 NBA Championship',
        sportId: 'sport1',
        status: 'active',
        commenceTime: new Date('2026-06-01'),
        sport: {
          key: 'basketball_nba',
          name: 'NBA'
        },
        currentOdds: [
          {
            id: 'odds1',
            outcome: 'Boston Celtics',
            bookmaker: 'draftkings',
            price: 450,
            lastUpdated: new Date('2026-01-15')
          },
          {
            id: 'odds2',
            outcome: 'Boston Celtics',
            bookmaker: 'fanduel',
            price: 475,
            lastUpdated: new Date('2026-01-15')
          }
        ],
        outcomes: [],
        oddsSnapshots: []
      };

      jest.mocked(prisma.future.findUnique).mockResolvedValue(mockFuture as any);

      const response = await request(app)
        .get('/api/futures/future1')
        .expect(200);

      expect(response.body.id).toBe('future1');
      expect(response.body.title).toBe('NBA Championship 2026');
      expect(response.body.groupedOutcomes).toBeDefined();
    });

    it('should calculate best odds and average odds per outcome', async () => {
      const mockFuture = {
        id: 'future1',
        title: 'NBA Championship',
        sportId: 'sport1',
        status: 'active',
        sport: { key: 'basketball_nba', name: 'NBA' },
        currentOdds: [
          { outcome: 'Celtics', bookmaker: 'draftkings', price: 450, lastUpdated: new Date() },
          { outcome: 'Celtics', bookmaker: 'fanduel', price: 500, lastUpdated: new Date() },
          { outcome: 'Celtics', bookmaker: 'betmgm', price: 475, lastUpdated: new Date() }
        ],
        outcomes: [],
        oddsSnapshots: []
      };

      jest.mocked(prisma.future.findUnique).mockResolvedValue(mockFuture as any);

      const response = await request(app)
        .get('/api/futures/future1')
        .expect(200);

      const celticsOutcome = response.body.groupedOutcomes.find((o: any) => o.outcome === 'Celtics');
      expect(celticsOutcome.bestOdds).toBe(500);
      expect(celticsOutcome.averageOdds).toBe(Math.round((450 + 500 + 475) / 3));
    });

    it('should include line movement data from snapshots', async () => {
      const mockFuture = {
        id: 'future1',
        title: 'NBA Championship',
        sportId: 'sport1',
        status: 'active',
        sport: { key: 'basketball_nba', name: 'NBA' },
        currentOdds: [
          { outcome: 'Celtics', bookmaker: 'draftkings', price: 450, lastUpdated: new Date() }
        ],
        outcomes: [],
        oddsSnapshots: [
          {
            id: 'snap1',
            outcome: 'Celtics',
            bookmaker: 'draftkings',
            price: 400,
            capturedAt: new Date('2026-01-10')
          },
          {
            id: 'snap2',
            outcome: 'Celtics',
            bookmaker: 'draftkings',
            price: 425,
            capturedAt: new Date('2026-01-12')
          },
          {
            id: 'snap3',
            outcome: 'Lakers',
            bookmaker: 'fanduel',
            price: 600,
            capturedAt: new Date('2026-01-12')
          }
        ]
      };

      jest.mocked(prisma.future.findUnique).mockResolvedValue(mockFuture as any);

      const response = await request(app)
        .get('/api/futures/future1')
        .expect(200);

      expect(response.body.lineMovement).toBeDefined();
      expect(response.body.lineMovement.Celtics).toHaveLength(2);
      expect(response.body.lineMovement.Lakers).toHaveLength(1);
    });

    it('should return 404 when future not found', async () => {
      jest.mocked(prisma.future.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/futures/nonexistent')
        .expect(404);

      expect(response.body.error).toBe('Future not found');
    });

    it('should order currentOdds by outcome and price', async () => {
      jest.mocked(prisma.future.findUnique).mockResolvedValue({
        id: 'future1',
        currentOdds: [],
        outcomes: [],
        oddsSnapshots: []
      } as any);

      await request(app)
        .get('/api/futures/future1')
        .expect(200);

      expect(prisma.future.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            currentOdds: {
              orderBy: [
                { outcome: 'asc' },
                { price: 'desc' }
              ]
            }
          })
        })
      );
    });

    it('should limit oddsSnapshots to last 100', async () => {
      jest.mocked(prisma.future.findUnique).mockResolvedValue({
        id: 'future1',
        currentOdds: [],
        outcomes: [],
        oddsSnapshots: []
      } as any);

      await request(app)
        .get('/api/futures/future1')
        .expect(200);

      expect(prisma.future.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            oddsSnapshots: {
              orderBy: { capturedAt: 'desc' },
              take: 100
            }
          })
        })
      );
    });

    it('should order oddsSnapshots by capturedAt descending', async () => {
      jest.mocked(prisma.future.findUnique).mockResolvedValue({
        id: 'future1',
        currentOdds: [],
        outcomes: [],
        oddsSnapshots: []
      } as any);

      await request(app)
        .get('/api/futures/future1')
        .expect(200);

      expect(prisma.future.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            oddsSnapshots: expect.objectContaining({
              orderBy: { capturedAt: 'desc' }
            })
          })
        })
      );
    });

    it('should include sport details', async () => {
      const mockFuture = {
        id: 'future1',
        title: 'Super Bowl Winner',
        sportId: 'sport-nfl',
        status: 'active',
        sport: {
          key: 'americanfootball_nfl',
          name: 'NFL'
        },
        currentOdds: [],
        outcomes: [],
        oddsSnapshots: []
      };

      jest.mocked(prisma.future.findUnique).mockResolvedValue(mockFuture as any);

      const response = await request(app)
        .get('/api/futures/future1')
        .expect(200);

      expect(response.body.sport.key).toBe('americanfootball_nfl');
      expect(response.body.sport.name).toBe('NFL');
    });

    it('should handle database errors', async () => {
      jest.mocked(prisma.future.findUnique).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/futures/future1')
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch future');
    });

    it('should handle future with no snapshots', async () => {
      const mockFuture = {
        id: 'future1',
        title: 'NBA Championship',
        sportId: 'sport1',
        status: 'active',
        sport: { key: 'basketball_nba', name: 'NBA' },
        currentOdds: [
          { outcome: 'Celtics', bookmaker: 'draftkings', price: 450, lastUpdated: new Date() }
        ],
        outcomes: [],
        oddsSnapshots: []
      };

      jest.mocked(prisma.future.findUnique).mockResolvedValue(mockFuture as any);

      const response = await request(app)
        .get('/api/futures/future1')
        .expect(200);

      expect(response.body.lineMovement).toEqual({});
    });

    it('should handle multiple outcomes in line movement', async () => {
      const mockFuture = {
        id: 'future1',
        title: 'NBA Championship',
        sportId: 'sport1',
        status: 'active',
        sport: { key: 'basketball_nba', name: 'NBA' },
        currentOdds: [],
        outcomes: [],
        oddsSnapshots: [
          { outcome: 'Celtics', bookmaker: 'draftkings', price: 400, capturedAt: new Date('2026-01-10') },
          { outcome: 'Celtics', bookmaker: 'draftkings', price: 450, capturedAt: new Date('2026-01-12') },
          { outcome: 'Lakers', bookmaker: 'fanduel', price: 600, capturedAt: new Date('2026-01-10') },
          { outcome: 'Lakers', bookmaker: 'fanduel', price: 650, capturedAt: new Date('2026-01-12') },
          { outcome: 'Warriors', bookmaker: 'betmgm', price: 800, capturedAt: new Date('2026-01-12') }
        ]
      };

      jest.mocked(prisma.future.findUnique).mockResolvedValue(mockFuture as any);

      const response = await request(app)
        .get('/api/futures/future1')
        .expect(200);

      expect(Object.keys(response.body.lineMovement)).toHaveLength(3);
      expect(response.body.lineMovement.Celtics).toHaveLength(2);
      expect(response.body.lineMovement.Lakers).toHaveLength(2);
      expect(response.body.lineMovement.Warriors).toHaveLength(1);
    });

    it('should include lastUpdated timestamp in bookmaker data', async () => {
      const lastUpdatedDate = new Date('2026-01-15T10:00:00Z');
      const mockFuture = {
        id: 'future1',
        title: 'NBA Championship',
        sportId: 'sport1',
        status: 'active',
        sport: { key: 'basketball_nba', name: 'NBA' },
        currentOdds: [
          { outcome: 'Celtics', bookmaker: 'draftkings', price: 450, lastUpdated: lastUpdatedDate }
        ],
        outcomes: [],
        oddsSnapshots: []
      };

      jest.mocked(prisma.future.findUnique).mockResolvedValue(mockFuture as any);

      const response = await request(app)
        .get('/api/futures/future1')
        .expect(200);

      const celticsOutcome = response.body.groupedOutcomes.find((o: any) => o.outcome === 'Celtics');
      expect(celticsOutcome.bookmakers[0].lastUpdated).toBeDefined();
    });

    it('should handle edge case with single bookmaker', async () => {
      const mockFuture = {
        id: 'future1',
        title: 'NBA Championship',
        sportId: 'sport1',
        status: 'active',
        sport: { key: 'basketball_nba', name: 'NBA' },
        currentOdds: [
          { outcome: 'Celtics', bookmaker: 'draftkings', price: 450, lastUpdated: new Date() }
        ],
        outcomes: [],
        oddsSnapshots: []
      };

      jest.mocked(prisma.future.findUnique).mockResolvedValue(mockFuture as any);

      const response = await request(app)
        .get('/api/futures/future1')
        .expect(200);

      const celticsOutcome = response.body.groupedOutcomes.find((o: any) => o.outcome === 'Celtics');
      expect(celticsOutcome.bestOdds).toBe(450);
      expect(celticsOutcome.averageOdds).toBe(450);
    });

    it('should correctly round average odds', async () => {
      const mockFuture = {
        id: 'future1',
        title: 'NBA Championship',
        sportId: 'sport1',
        status: 'active',
        sport: { key: 'basketball_nba', name: 'NBA' },
        currentOdds: [
          { outcome: 'Celtics', bookmaker: 'draftkings', price: 450, lastUpdated: new Date() },
          { outcome: 'Celtics', bookmaker: 'fanduel', price: 453, lastUpdated: new Date() }
        ],
        outcomes: [],
        oddsSnapshots: []
      };

      jest.mocked(prisma.future.findUnique).mockResolvedValue(mockFuture as any);

      const response = await request(app)
        .get('/api/futures/future1')
        .expect(200);

      const celticsOutcome = response.body.groupedOutcomes.find((o: any) => o.outcome === 'Celtics');
      expect(celticsOutcome.averageOdds).toBe(Math.round((450 + 453) / 2));
    });
  });
});
