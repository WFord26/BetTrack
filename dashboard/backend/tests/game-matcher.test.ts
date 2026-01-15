import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { fuzzyMatchGames, generateBetName } from '../src/utils/game-matcher';
import { prisma } from '../src/config/database';

// Mock Prisma
jest.mock('../src/config/database', () => ({
  prisma: {
    game: {
      findMany: jest.fn()
    }
  }
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('GameMatcher Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fuzzyMatchGames', () => {
    const mockGames = [
      {
        id: 'game-1',
        homeTeamName: 'Los Angeles Lakers',
        awayTeamName: 'Boston Celtics',
        commenceTime: new Date('2026-01-20T00:00:00Z'),
        status: 'scheduled',
        sport: { key: 'basketball_nba', title: 'NBA' }
      },
      {
        id: 'game-2',
        homeTeamName: 'Golden State Warriors',
        awayTeamName: 'Miami Heat',
        commenceTime: new Date('2026-01-20T00:30:00Z'),
        status: 'scheduled',
        sport: { key: 'basketball_nba', title: 'NBA' }
      },
      {
        id: 'game-3',
        homeTeamName: 'New York Knicks',
        awayTeamName: 'Brooklyn Nets',
        commenceTime: new Date('2026-01-20T01:00:00Z'),
        status: 'scheduled',
        sport: { key: 'basketball_nba', title: 'NBA' }
      },
      {
        id: 'game-4',
        homeTeamName: 'Tampa Bay Buccaneers',
        awayTeamName: 'Carolina Panthers',
        commenceTime: new Date('2026-01-21T18:00:00Z'),
        status: 'scheduled',
        sport: { key: 'americanfootball_nfl', title: 'NFL' }
      }
    ];

    beforeEach(() => {
      mockPrisma.game.findMany.mockResolvedValue(mockGames as any);
    });

    describe('Exact matching', () => {
      it('should match game description with both full team names', async () => {
        const results = await fuzzyMatchGames(['Los Angeles Lakers vs Boston Celtics']);

        expect(results).toHaveLength(1);
        expect(results[0].game?.id).toBe('game-1');
        expect(results[0].confidence).toBe('high');
        expect(results[0].matchedTeam).toContain('Boston Celtics @ Los Angeles Lakers');
      });

      it('should match game description with last words of team names', async () => {
        const results = await fuzzyMatchGames(['Lakers vs Celtics']);

        expect(results).toHaveLength(1);
        expect(results[0].game?.id).toBe('game-1');
        expect(results[0].confidence).toBe('high');
      });

      it('should handle descriptions with different separators', async () => {
        const results = await fuzzyMatchGames([
          'Warriors @ Heat',
          'Warriors - Heat',
          'Warriors Heat'
        ]);

        expect(results).toHaveLength(3);
        results.forEach(result => {
          expect(result.game?.id).toBe('game-2');
          expect(result.confidence).toBe('high');
        });
      });

      it('should be case insensitive', async () => {
        const results = await fuzzyMatchGames(['GOLDEN STATE WARRIORS vs miami heat']);

        expect(results).toHaveLength(1);
        expect(results[0].game?.id).toBe('game-2');
        expect(results[0].confidence).toBe('high');
      });
    });

    describe('Partial matching', () => {
      it('should match with only home team name', async () => {
        const results = await fuzzyMatchGames(['Los Angeles Lakers']);

        expect(results).toHaveLength(1);
        expect(results[0].game?.id).toBe('game-1');
        expect(results[0].confidence).toBe('medium');
        expect(results[0].matchedTeam).toContain('Los Angeles Lakers');
      });

      it('should match with only away team name', async () => {
        const results = await fuzzyMatchGames(['Boston Celtics']);

        expect(results).toHaveLength(1);
        expect(results[0].game?.id).toBe('game-1');
        expect(results[0].confidence).toBe('medium');
        expect(results[0].matchedTeam).toContain('Boston Celtics');
      });

      it('should identify which team was matched', async () => {
        const results = await fuzzyMatchGames(['Golden State Warriors']);

        expect(results[0].matchedTeam).toContain('(matched: Golden State Warriors)');
      });
    });

    describe('Fuzzy matching', () => {
      it('should match using keywords >= 4 characters', async () => {
        const results = await fuzzyMatchGames(['Knicks vs Nets']);

        expect(results).toHaveLength(1);
        expect(results[0].game?.id).toBe('game-3');
        // This matches as 'high' because both team last names are present
        expect(results[0].confidence).toBe('high');
        expect(results[0].matchedTeam).toContain('Brooklyn Nets @ New York Knicks');
      });

      it('should match partial team names (e.g., "Bucs" for "Buccaneers")', async () => {
        const results = await fuzzyMatchGames(['Bucs vs Panthers']);

        expect(results).toHaveLength(1);
        expect(results[0].game?.id).toBe('game-4');
        expect(results[0].confidence).toBe('low');
      });

      it('should ignore keywords shorter than 4 characters', async () => {
        const results = await fuzzyMatchGames(['NY vs LA']);

        expect(results).toHaveLength(1);
        expect(results[0].confidence).toBe('none');
        expect(results[0].game).toBeNull();
      });

      it('should match on significant keywords', async () => {
        const results = await fuzzyMatchGames(['Warriors game tonight']);

        expect(results).toHaveLength(1);
        expect(results[0].game?.id).toBe('game-2');
        expect(results[0].confidence).toBe('low');
      });
    });

    describe('No match scenarios', () => {
      it('should return none confidence when no match found', async () => {
        const results = await fuzzyMatchGames(['Nonexistent Team vs Another Team']);

        expect(results).toHaveLength(1);
        expect(results[0].game).toBeNull();
        expect(results[0].confidence).toBe('none');
        expect(results[0].matchedTeam).toBeUndefined();
      });

      it('should handle empty descriptions', async () => {
        const results = await fuzzyMatchGames(['']);

        expect(results).toHaveLength(1);
        expect(results[0].game).toBeNull();
        expect(results[0].confidence).toBe('none');
      });
    });

    describe('Multiple game descriptions', () => {
      it('should match multiple descriptions independently', async () => {
        const results = await fuzzyMatchGames([
          'Lakers vs Celtics',
          'Warriors vs Heat',
          'Nonexistent Team'
        ]);

        expect(results).toHaveLength(3);
        expect(results[0].game?.id).toBe('game-1');
        expect(results[0].confidence).toBe('high');
        expect(results[1].game?.id).toBe('game-2');
        expect(results[1].confidence).toBe('high');
        expect(results[2].game).toBeNull();
        expect(results[2].confidence).toBe('none');
      });

      it('should handle descriptions with varying match quality', async () => {
        const results = await fuzzyMatchGames([
          'Los Angeles Lakers vs Boston Celtics', // High
          'Golden State Warriors',                // Medium
          'Heat',                                  // Low (keyword)
          'Unknown Team'                           // None
        ]);

        expect(results[0].confidence).toBe('high');
        expect(results[1].confidence).toBe('medium');
        expect(results[2].confidence).toBe('low');
        expect(results[3].confidence).toBe('none');
      });
    });

    describe('Database query constraints', () => {
      it('should query only future and non-completed games', async () => {
        await fuzzyMatchGames(['Lakers vs Celtics']);

        expect(mockPrisma.game.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              commenceTime: expect.objectContaining({ gte: expect.any(Date) }),
              status: { notIn: ['final', 'completed'] }
            }),
            take: 500
          })
        );
      });

      it('should include sport information in query', async () => {
        await fuzzyMatchGames(['Lakers']);

        expect(mockPrisma.game.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            include: { sport: true }
          })
        );
      });

      it('should order games by commence time', async () => {
        await fuzzyMatchGames(['Lakers']);

        expect(mockPrisma.game.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { commenceTime: 'asc' }
          })
        );
      });
    });

    describe('Edge cases', () => {
      it('should handle games with one-word team names', async () => {
        mockPrisma.game.findMany.mockResolvedValue([
          {
            id: 'game-5',
            homeTeamName: 'Hurricanes',
            awayTeamName: 'Lightning',
            commenceTime: new Date('2026-01-20T00:00:00Z'),
            status: 'scheduled',
            sport: { key: 'icehockey_nhl', title: 'NHL' }
          }
        ] as any);

        const results = await fuzzyMatchGames(['Hurricanes vs Lightning']);

        expect(results[0].game?.id).toBe('game-5');
        expect(results[0].confidence).toBe('high');
      });

      it('should handle special characters in team names', async () => {
        mockPrisma.game.findMany.mockResolvedValue([
          {
            id: 'game-6',
            homeTeamName: "Portland Trail Blazers",
            awayTeamName: 'Phoenix Suns',
            commenceTime: new Date('2026-01-20T00:00:00Z'),
            status: 'scheduled',
            sport: { key: 'basketball_nba', title: 'NBA' }
          }
        ] as any);

        const results = await fuzzyMatchGames(['Trail Blazers vs Suns']);

        expect(results[0].game?.id).toBe('game-6');
        expect(results[0].confidence).toBe('high');
      });

      it('should handle database errors gracefully', async () => {
        mockPrisma.game.findMany.mockRejectedValue(new Error('Database error'));

        await expect(fuzzyMatchGames(['Lakers'])).rejects.toThrow('Database error');
      });
    });
  });

  describe('generateBetName', () => {
    it('should generate name for single bet', () => {
      const selections = [
        { teamName: 'Lakers', type: 'moneyline' }
      ];

      const name = generateBetName(selections);

      expect(name).toBe('Lakers moneyline');
    });

    it('should handle single bet with no team name', () => {
      const selections = [
        { type: 'spread' }
      ];

      const name = generateBetName(selections);

      expect(name).toBe('Single spread');
    });

    it('should generate name for 2-leg parlay', () => {
      const selections = [
        { teamName: 'Lakers', type: 'moneyline' },
        { teamName: 'Warriors', type: 'spread' }
      ];

      const name = generateBetName(selections);

      expect(name).toBe('2-Leg Parlay');
    });

    it('should generate name for 3-leg parlay', () => {
      const selections = [
        { teamName: 'Lakers', type: 'moneyline' },
        { teamName: 'Warriors', type: 'spread' },
        { teamName: 'Celtics', type: 'totals' }
      ];

      const name = generateBetName(selections);

      expect(name).toBe('3-Leg Parlay');
    });

    it('should generate name for parlays with more than 3 legs', () => {
      const selections = Array(5).fill({ teamName: 'Team', type: 'moneyline' });

      const name = generateBetName(selections);

      expect(name).toBe('5-Leg Parlay');
    });

    it('should handle empty selections array', () => {
      const selections: any[] = [];

      const name = generateBetName(selections);

      expect(name).toBe('0-Leg Parlay');
    });

    it('should handle large parlay counts', () => {
      const selections = Array(10).fill({ teamName: 'Team', type: 'moneyline' });

      const name = generateBetName(selections);

      expect(name).toBe('10-Leg Parlay');
    });
  });
});
