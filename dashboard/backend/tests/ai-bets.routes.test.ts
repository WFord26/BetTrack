import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import aiBetsRoutes from '../src/routes/ai-bets.routes';
import { prisma } from '../src/config/database';

// Mock dependencies
jest.mock('../src/config/database', () => ({
  prisma: {
    game: {
      findMany: jest.fn()
    },
    bet: {
      create: jest.fn()
    }
  }
}));

jest.mock('../src/middleware/api-key-auth', () => ({
  apiKeyAuth: (req: any, res: any, next: any) => next()
}));

describe('AI Bets Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/ai/bets', aiBetsRoutes);
  });

  describe('POST /api/ai/bets - Validation', () => {
    it('should reject request without selections', async () => {
      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          betType: 'single',
          stake: 100
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('selections array is required');
    });

    it('should reject request with empty selections array', async () => {
      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [],
          betType: 'single',
          stake: 100
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('selections array is required');
    });

    it('should reject request with non-array selections', async () => {
      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: 'invalid',
          betType: 'single',
          stake: 100
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('selections array is required');
    });

    it('should reject request without betType', async () => {
      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [{ gameId: 'game1', type: 'moneyline', selection: 'home', odds: -110 }],
          stake: 100
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('betType must be single, parlay, or teaser');
    });

    it('should reject request with invalid betType', async () => {
      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [{ gameId: 'game1', type: 'moneyline', selection: 'home', odds: -110 }],
          betType: 'invalid',
          stake: 100
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('betType must be single, parlay, or teaser');
    });

    it('should reject request without stake', async () => {
      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [{ gameId: 'game1', type: 'moneyline', selection: 'home', odds: -110 }],
          betType: 'single'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('stake must be a positive number');
    });

    it('should reject request with zero stake', async () => {
      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [{ gameId: 'game1', type: 'moneyline', selection: 'home', odds: -110 }],
          betType: 'single',
          stake: 0
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('stake must be a positive number');
    });

    it('should reject request with negative stake', async () => {
      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [{ gameId: 'game1', type: 'moneyline', selection: 'home', odds: -110 }],
          betType: 'single',
          stake: -50
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('stake must be a positive number');
    });

    it('should reject selection without gameId', async () => {
      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [{ type: 'moneyline', selection: 'home', odds: -110 }],
          betType: 'single',
          stake: 100
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Selection 1 missing gameId');
    });

    it('should reject selection without type', async () => {
      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [{ gameId: 'game1', selection: 'home', odds: -110 }],
          betType: 'single',
          stake: 100
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Selection 1 must have type: moneyline, spread, or total');
    });

    it('should reject selection with invalid type', async () => {
      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [{ gameId: 'game1', type: 'invalid', selection: 'home', odds: -110 }],
          betType: 'single',
          stake: 100
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Selection 1 must have type: moneyline, spread, or total');
    });

    it('should reject selection without selection field', async () => {
      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [{ gameId: 'game1', type: 'moneyline', odds: -110 }],
          betType: 'single',
          stake: 100
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Selection 1 must have selection: home, away, over, or under');
    });

    it('should reject selection with invalid selection value', async () => {
      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [{ gameId: 'game1', type: 'moneyline', selection: 'invalid', odds: -110 }],
          betType: 'single',
          stake: 100
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Selection 1 must have selection: home, away, over, or under');
    });

    it('should reject selection without odds', async () => {
      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [{ gameId: 'game1', type: 'moneyline', selection: 'home' }],
          betType: 'single',
          stake: 100
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Selection 1 missing required odds value');
    });

    it('should reject spread bet without line', async () => {
      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [{ gameId: 'game1', type: 'spread', selection: 'home', odds: -110 }],
          betType: 'single',
          stake: 100
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Selection 1 (spread) requires a line value');
    });

    it('should reject total bet without line', async () => {
      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [{ gameId: 'game1', type: 'total', selection: 'over', odds: -110 }],
          betType: 'single',
          stake: 100
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Selection 1 (total) requires a line value');
    });

    it('should validate multiple selections in order', async () => {
      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { gameId: 'game1', type: 'moneyline', selection: 'home', odds: -110 },
            { gameId: 'game2', type: 'spread', selection: 'away', odds: -110 } // Missing line
          ],
          betType: 'parlay',
          stake: 100
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Selection 2 (spread) requires a line value');
    });
  });

  describe('POST /api/ai/bets - Game Validation', () => {
    it('should reject request when games not found', async () => {
      jest.mocked(prisma.game.findMany).mockResolvedValue([]);

      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { gameId: 'game1', type: 'moneyline', selection: 'home', odds: -110 }
          ],
          betType: 'single',
          stake: 100
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Some game IDs not found');
      expect(response.body.details.missingGameIds).toEqual(['game1']);
    });

    it('should reject request when some games not found', async () => {
      const mockGames = [
        { id: 'game1', sport: { key: 'basketball_nba' } }
      ];

      jest.mocked(prisma.game.findMany).mockResolvedValue(mockGames as any);

      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { gameId: 'game1', type: 'moneyline', selection: 'home', odds: -110 },
            { gameId: 'game2', type: 'moneyline', selection: 'away', odds: +120 }
          ],
          betType: 'parlay',
          stake: 100
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Some game IDs not found');
      expect(response.body.details.requestedGames).toBe(2);
      expect(response.body.details.foundGames).toBe(1);
      expect(response.body.details.missingGameIds).toEqual(['game2']);
    });

    it('should handle duplicate game IDs in validation', async () => {
      const mockGames = [
        { id: 'game1', sport: { key: 'basketball_nba' } }
      ];

      jest.mocked(prisma.game.findMany).mockResolvedValue(mockGames as any);
      jest.mocked(prisma.bet.create).mockResolvedValue({
        id: 'bet123',
        name: 'SGP bet',
        betType: 'parlay',
        stake: 100,
        legs: []
      } as any);

      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { gameId: 'game1', type: 'moneyline', selection: 'home', odds: -110 },
            { gameId: 'game1', type: 'total', selection: 'over', odds: -120, line: 220.5 }
          ],
          betType: 'parlay',
          stake: 100
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['game1'] } }
        })
      );
    });
  });

  describe('POST /api/ai/bets - Single Bets', () => {
    it('should create single moneyline bet with negative odds', async () => {
      const mockGames = [
        { id: 'game1', sport: { key: 'basketball_nba' } }
      ];

      const mockBet = {
        id: 'bet123',
        name: 'Single bet - 1 leg',
        betType: 'single',
        stake: 100,
        potentialPayout: 90.91,
        oddsAtPlacement: -110,
        legs: [
          { gameId: 'game1', selectionType: 'moneyline', selection: 'home', odds: -110, line: null }
        ]
      };

      jest.mocked(prisma.game.findMany).mockResolvedValue(mockGames as any);
      jest.mocked(prisma.bet.create).mockResolvedValue(mockBet as any);

      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { gameId: 'game1', type: 'moneyline', selection: 'home', odds: -110 }
          ],
          betType: 'single',
          stake: 100
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.bet.betType).toBe('single');
      expect(response.body.message).toBe('Bet created successfully');
    });

    it('should create single moneyline bet with positive odds', async () => {
      const mockGames = [
        { id: 'game1', sport: { key: 'basketball_nba' } }
      ];

      jest.mocked(prisma.game.findMany).mockResolvedValue(mockGames as any);
      jest.mocked(prisma.bet.create).mockResolvedValue({
        id: 'bet123',
        betType: 'single',
        stake: 100,
        potentialPayout: 150
      } as any);

      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { gameId: 'game1', type: 'moneyline', selection: 'away', odds: 150 }
          ],
          betType: 'single',
          stake: 100
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should create single spread bet', async () => {
      const mockGames = [
        { id: 'game1', sport: { key: 'americanfootball_nfl' } }
      ];

      jest.mocked(prisma.game.findMany).mockResolvedValue(mockGames as any);
      jest.mocked(prisma.bet.create).mockResolvedValue({
        id: 'bet123',
        betType: 'single',
        stake: 50,
        legs: [
          { gameId: 'game1', selectionType: 'spread', selection: 'home', odds: -110, line: -7.5 }
        ]
      } as any);

      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { gameId: 'game1', type: 'spread', selection: 'home', odds: -110, line: -7.5 }
          ],
          betType: 'single',
          stake: 50
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should create single total bet', async () => {
      const mockGames = [
        { id: 'game1', sport: { key: 'basketball_nba' } }
      ];

      jest.mocked(prisma.game.findMany).mockResolvedValue(mockGames as any);
      jest.mocked(prisma.bet.create).mockResolvedValue({
        id: 'bet123',
        betType: 'single',
        stake: 75,
        legs: [
          { gameId: 'game1', selectionType: 'total', selection: 'over', odds: -115, line: 220.5 }
        ]
      } as any);

      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { gameId: 'game1', type: 'total', selection: 'over', odds: -115, line: 220.5 }
          ],
          betType: 'single',
          stake: 75
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/ai/bets - Parlay Bets', () => {
    it('should create 2-leg parlay', async () => {
      const mockGames = [
        { id: 'game1', sport: { key: 'basketball_nba' } },
        { id: 'game2', sport: { key: 'basketball_nba' } }
      ];

      jest.mocked(prisma.game.findMany).mockResolvedValue(mockGames as any);
      jest.mocked(prisma.bet.create).mockResolvedValue({
        id: 'bet123',
        betType: 'parlay',
        stake: 100,
        potentialPayout: 264,
        oddsAtPlacement: 264,
        legs: [
          { gameId: 'game1', selectionType: 'moneyline', selection: 'home', odds: -110 },
          { gameId: 'game2', selectionType: 'moneyline', selection: 'away', odds: -110 }
        ]
      } as any);

      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { gameId: 'game1', type: 'moneyline', selection: 'home', odds: -110 },
            { gameId: 'game2', type: 'moneyline', selection: 'away', odds: -110 }
          ],
          betType: 'parlay',
          stake: 100
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.bet.betType).toBe('parlay');
    });

    it('should create 3-leg parlay with mixed odds', async () => {
      const mockGames = [
        { id: 'game1', sport: { key: 'basketball_nba' } },
        { id: 'game2', sport: { key: 'americanfootball_nfl' } },
        { id: 'game3', sport: { key: 'icehockey_nhl' } }
      ];

      jest.mocked(prisma.game.findMany).mockResolvedValue(mockGames as any);
      jest.mocked(prisma.bet.create).mockResolvedValue({
        id: 'bet123',
        betType: 'parlay',
        stake: 50,
        legs: [
          { gameId: 'game1', selectionType: 'moneyline', selection: 'home', odds: -150 },
          { gameId: 'game2', selectionType: 'spread', selection: 'away', odds: -110, line: 3.5 },
          { gameId: 'game3', selectionType: 'total', selection: 'under', odds: +105, line: 6.5 }
        ]
      } as any);

      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { gameId: 'game1', type: 'moneyline', selection: 'home', odds: -150 },
            { gameId: 'game2', type: 'spread', selection: 'away', odds: -110, line: 3.5 },
            { gameId: 'game3', type: 'total', selection: 'under', odds: 105, line: 6.5 }
          ],
          betType: 'parlay',
          stake: 50
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/ai/bets - Same Game Parlay (SGP)', () => {
    it('should detect and create SGP with 2 legs on same game', async () => {
      const mockGames = [
        { id: 'game1', sport: { key: 'basketball_nba' } }
      ];

      jest.mocked(prisma.game.findMany).mockResolvedValue(mockGames as any);
      jest.mocked(prisma.bet.create).mockResolvedValue({
        id: 'bet123',
        betType: 'parlay',
        stake: 100,
        legs: [
          { gameId: 'game1', selectionType: 'moneyline', selection: 'home', odds: -110, sgpGroupId: 'game1' },
          { gameId: 'game1', selectionType: 'total', selection: 'over', odds: -120, line: 220.5, sgpGroupId: 'game1' }
        ]
      } as any);

      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { gameId: 'game1', type: 'moneyline', selection: 'home', odds: -110 },
            { gameId: 'game1', type: 'total', selection: 'over', odds: -120, line: 220.5 }
          ],
          betType: 'parlay',
          stake: 100
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.bet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            legs: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({ sgpGroupId: 'game1' })
              ])
            })
          })
        })
      );
    });

    it('should handle mixed SGP and regular parlay legs', async () => {
      const mockGames = [
        { id: 'game1', sport: { key: 'basketball_nba' } },
        { id: 'game2', sport: { key: 'americanfootball_nfl' } }
      ];

      jest.mocked(prisma.game.findMany).mockResolvedValue(mockGames as any);
      jest.mocked(prisma.bet.create).mockResolvedValue({
        id: 'bet123',
        betType: 'parlay',
        stake: 100,
        legs: [
          { gameId: 'game1', selectionType: 'moneyline', selection: 'home', odds: -110, sgpGroupId: 'game1' },
          { gameId: 'game1', selectionType: 'total', selection: 'over', odds: -120, line: 220.5, sgpGroupId: 'game1' },
          { gameId: 'game2', selectionType: 'spread', selection: 'away', odds: -110, line: 3.5, sgpGroupId: null }
        ]
      } as any);

      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { gameId: 'game1', type: 'moneyline', selection: 'home', odds: -110 },
            { gameId: 'game1', type: 'total', selection: 'over', odds: -120, line: 220.5 },
            { gameId: 'game2', type: 'spread', selection: 'away', odds: -110, line: 3.5 }
          ],
          betType: 'parlay',
          stake: 100
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should create 3-leg SGP on single game', async () => {
      const mockGames = [
        { id: 'game1', sport: { key: 'basketball_nba' } }
      ];

      jest.mocked(prisma.game.findMany).mockResolvedValue(mockGames as any);
      jest.mocked(prisma.bet.create).mockResolvedValue({
        id: 'bet123',
        betType: 'parlay',
        stake: 50,
        legs: [
          { gameId: 'game1', selectionType: 'moneyline', selection: 'home', odds: -110, sgpGroupId: 'game1' },
          { gameId: 'game1', selectionType: 'spread', selection: 'home', odds: -110, line: -7.5, sgpGroupId: 'game1' },
          { gameId: 'game1', selectionType: 'total', selection: 'over', odds: -120, line: 220.5, sgpGroupId: 'game1' }
        ]
      } as any);

      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { gameId: 'game1', type: 'moneyline', selection: 'home', odds: -110 },
            { gameId: 'game1', type: 'spread', selection: 'home', odds: -110, line: -7.5 },
            { gameId: 'game1', type: 'total', selection: 'over', odds: -120, line: 220.5 }
          ],
          betType: 'parlay',
          stake: 50
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/ai/bets - Additional Fields', () => {
    it('should accept and store notes', async () => {
      const mockGames = [
        { id: 'game1', sport: { key: 'basketball_nba' } }
      ];

      jest.mocked(prisma.game.findMany).mockResolvedValue(mockGames as any);
      jest.mocked(prisma.bet.create).mockResolvedValue({
        id: 'bet123',
        notes: 'Created by AI from mcp\nStrong value bet on Lakers'
      } as any);

      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { gameId: 'game1', type: 'moneyline', selection: 'home', odds: -110 }
          ],
          betType: 'single',
          stake: 100,
          notes: 'Strong value bet on Lakers'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.bet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notes: expect.stringContaining('Strong value bet on Lakers')
          })
        })
      );
    });

    it('should use notes as bet name if provided', async () => {
      const mockGames = [
        { id: 'game1', sport: { key: 'basketball_nba' } }
      ];

      jest.mocked(prisma.game.findMany).mockResolvedValue(mockGames as any);
      jest.mocked(prisma.bet.create).mockResolvedValue({
        id: 'bet123',
        name: 'Lakers ML + Over'
      } as any);

      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { gameId: 'game1', type: 'moneyline', selection: 'home', odds: -110 }
          ],
          betType: 'single',
          stake: 100,
          notes: 'Lakers ML + Over\nDetailed analysis here'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should accept source parameter', async () => {
      const mockGames = [
        { id: 'game1', sport: { key: 'basketball_nba' } }
      ];

      jest.mocked(prisma.game.findMany).mockResolvedValue(mockGames as any);
      jest.mocked(prisma.bet.create).mockResolvedValue({ id: 'bet123' } as any);

      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { gameId: 'game1', type: 'moneyline', selection: 'home', odds: -110 }
          ],
          betType: 'single',
          stake: 100,
          source: 'image'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.bet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notes: expect.stringContaining('from image')
          })
        })
      );
    });

    it('should default source to mcp', async () => {
      const mockGames = [
        { id: 'game1', sport: { key: 'basketball_nba' } }
      ];

      jest.mocked(prisma.game.findMany).mockResolvedValue(mockGames as any);
      jest.mocked(prisma.bet.create).mockResolvedValue({ id: 'bet123' } as any);

      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { gameId: 'game1', type: 'moneyline', selection: 'home', odds: -110 }
          ],
          betType: 'single',
          stake: 100
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.bet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notes: expect.stringContaining('from mcp')
          })
        })
      );
    });

    it('should accept teaserPoints for teaser bets', async () => {
      const mockGames = [
        { id: 'game1', sport: { key: 'americanfootball_nfl' } },
        { id: 'game2', sport: { key: 'americanfootball_nfl' } }
      ];

      jest.mocked(prisma.game.findMany).mockResolvedValue(mockGames as any);
      jest.mocked(prisma.bet.create).mockResolvedValue({
        id: 'bet123',
        betType: 'teaser',
        teaserPoints: 6
      } as any);

      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { gameId: 'game1', type: 'spread', selection: 'home', odds: -110, line: -7.5 },
            { gameId: 'game2', type: 'spread', selection: 'away', odds: -110, line: 3.5 }
          ],
          betType: 'teaser',
          stake: 100,
          teaserPoints: 6
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should accept teamName in selections', async () => {
      const mockGames = [
        { id: 'game1', sport: { key: 'basketball_nba' } }
      ];

      jest.mocked(prisma.game.findMany).mockResolvedValue(mockGames as any);
      jest.mocked(prisma.bet.create).mockResolvedValue({ id: 'bet123' } as any);

      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { 
              gameId: 'game1', 
              type: 'moneyline', 
              selection: 'home', 
              odds: -110,
              teamName: 'Los Angeles Lakers'
            }
          ],
          betType: 'single',
          stake: 100
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/ai/bets - Error Handling', () => {
    it('should handle database errors during game lookup', async () => {
      jest.mocked(prisma.game.findMany).mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { gameId: 'game1', type: 'moneyline', selection: 'home', odds: -110 }
          ],
          betType: 'single',
          stake: 100
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to create bet');
      expect(response.body.details).toBe('Database connection failed');
    });

    it('should handle database errors during bet creation', async () => {
      const mockGames = [
        { id: 'game1', sport: { key: 'basketball_nba' } }
      ];

      jest.mocked(prisma.game.findMany).mockResolvedValue(mockGames as any);
      jest.mocked(prisma.bet.create).mockRejectedValue(new Error('Constraint violation'));

      const response = await request(app)
        .post('/api/ai/bets')
        .send({
          selections: [
            { gameId: 'game1', type: 'moneyline', selection: 'home', odds: -110 }
          ],
          betType: 'single',
          stake: 100
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to create bet');
      expect(response.body.details).toBe('Constraint violation');
    });
  });
});
