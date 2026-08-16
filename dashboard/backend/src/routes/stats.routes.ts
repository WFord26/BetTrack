import { Router, Request, Response, NextFunction } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { requireSessionAuth } from '../middleware/auth-session.middleware';

const router = Router();
const prisma = new PrismaClient();

router.use(requireSessionAuth);

// `GameStats.stats` and `PlayerGameStats.stats` are free-form JSON whose shape
// varies by sport, so they are read defensively rather than typed per sport.

/** Narrows a JSON column to an object, falling back to `{}` for null/array/scalar. */
const toStatsObject = (stats: Prisma.JsonValue): Prisma.JsonObject =>
  stats !== null && typeof stats === 'object' && !Array.isArray(stats) ? stats : {};

/** Reads a nested numeric stat by key path, returning 0 when absent or non-numeric. */
const readStatNumber = (stats: Prisma.JsonValue, ...path: string[]): number => {
  let current: Prisma.JsonValue = stats;

  for (const key of path) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) {
      return 0;
    }
    current = current[key] ?? null;
  }

  return typeof current === 'number' ? current : 0;
};

// GET /api/stats/game/:gameId
// Enhanced with historical team averages
router.get('/game/:gameId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gameId } = req.params;

    // Fetch game info first
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        sport: true,
      },
    });

    if (!game) {
      return res.status(404).json({
        success: false,
        error: 'Game not found',
      });
    }

    // Fetch team stats for the game
    const gameStats = await prisma.gameStats.findMany({
      where: { gameId },
      include: {
        team: true,
      },
    });

    // Fetch player stats for the game
    const playerStats = await prisma.playerGameStats.findMany({
      where: { gameId },
      include: {
        player: true,
        team: {
          select: {
            id: true,
            name: true,
            abbreviation: true,
            logoUrl: true,
          },
        },
      },
      orderBy: [
        { teamId: 'asc' },
        { started: 'desc' },
      ],
    });

    // Fetch season averages for both teams
    const seasonAverages = await Promise.all(
      gameStats.map(async (stat) => {
        // Get all games this season for this team
        const teamGames = await prisma.gameStats.findMany({
          where: {
            teamId: stat.teamId,
            game: {
              sport: {
                key: game.sport.key,
              },
              commenceTime: {
                gte: new Date(new Date().getFullYear(), 0, 1), // Start of current year
              },
            },
          },
          include: {
            game: true,
          },
        });

        // Calculate averages
        const totalGames = teamGames.length;
        if (totalGames === 0) return null;

        const avgStats: Record<string, string> = {};

        // Aggregate stats based on sport type
        if (game.sport.key.includes('basketball')) {
          const totals = teamGames.reduce((acc, g) => ({
            points: acc.points + readStatNumber(g.stats, 'points'),
            rebounds: acc.rebounds + readStatNumber(g.stats, 'rebounds'),
            assists: acc.assists + readStatNumber(g.stats, 'assists'),
          }), { points: 0, rebounds: 0, assists: 0 });

          avgStats.points = (totals.points / totalGames).toFixed(1);
          avgStats.rebounds = (totals.rebounds / totalGames).toFixed(1);
          avgStats.assists = (totals.assists / totalGames).toFixed(1);
        } else if (game.sport.key.includes('football')) {
          const totals = teamGames.reduce((acc, g) => ({
            yards: acc.yards + readStatNumber(g.stats, 'yards', 'total'),
            touchdowns: acc.touchdowns + readStatNumber(g.stats, 'touchdowns', 'total'),
          }), { yards: 0, touchdowns: 0 });

          avgStats.yards = (totals.yards / totalGames).toFixed(1);
          avgStats.touchdowns = (totals.touchdowns / totalGames).toFixed(1);
        }

        return {
          teamId: stat.teamId,
          totalGames,
          homeGames: teamGames.filter(g => g.isHome).length,
          awayGames: teamGames.filter(g => !g.isHome).length,
          avgStats,
        };
      })
    );

    res.json({
      success: true,
      data: {
        teamStats: gameStats,
        playerStats,
        seasonAverages: seasonAverages.filter(Boolean),
      },
    });
  } catch (error) {
    logger.error('Error fetching game stats:', error);
    next(error);
  }
});

// GET /api/stats/team/:teamId
// Enhanced with home/away filtering
router.get('/team/:teamId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const { season, location } = req.query; // location: 'home', 'away', or 'all'

    if (isNaN(teamId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid team ID',
      });
    }

    // Build filter
    const where: Prisma.GameStatsWhereInput = {
      teamId,
    };

    // Filter by home/away
    if (location === 'home') {
      where.isHome = true;
    } else if (location === 'away') {
      where.isHome = false;
    }

    // Filter by season if provided
    if (season) {
      where.game = {
        commenceTime: {
          gte: new Date(parseInt(season as string), 0, 1),
          lt: new Date(parseInt(season as string) + 1, 0, 1),
        },
      };
    }

    // Fetch team season stats
    const teamStats = await prisma.teamStats.findFirst({
      where: {
        teamId,
        season: season ? parseInt(season as string) : new Date().getFullYear(),
      },
      include: {
        team: true,
      },
    });

    // Fetch game history with filter
    const gameHistory = await prisma.gameStats.findMany({
      where,
      include: {
        game: {
          select: {
            id: true,
            homeTeamName: true,
            awayTeamName: true,
            commenceTime: true,
            status: true,
            homeScore: true,
            awayScore: true,
          },
        },
      },
      orderBy: {
        game: { commenceTime: 'desc' },
      },
      take: 20,
    });

    // Calculate split stats (home vs away)
    const homeGames = await prisma.gameStats.findMany({
      where: {
        teamId,
        isHome: true,
        game: season ? {
          commenceTime: {
            gte: new Date(parseInt(season as string), 0, 1),
            lt: new Date(parseInt(season as string) + 1, 0, 1),
          },
        } : undefined,
      },
    });

    const awayGames = await prisma.gameStats.findMany({
      where: {
        teamId,
        isHome: false,
        game: season ? {
          commenceTime: {
            gte: new Date(parseInt(season as string), 0, 1),
            lt: new Date(parseInt(season as string) + 1, 0, 1),
          },
        } : undefined,
      },
    });

    // Calculate averages
    const calculateAvgStats = (games: { stats: Prisma.JsonValue }[]) => {
      if (games.length === 0) return null;

      const totals = games.reduce<Record<string, number>>((acc, game) => {
        const stats = toStatsObject(game.stats);
        Object.entries(stats).forEach(([key, value]) => {
          if (typeof value === 'number') {
            acc[key] = (acc[key] || 0) + value;
          }
        });
        return acc;
      }, {});

      const averages: Record<string, string> = {};
      Object.keys(totals).forEach(key => {
        averages[key] = (totals[key] / games.length).toFixed(1);
      });

      return averages;
    };

    res.json({
      success: true,
      data: {
        seasonStats: teamStats,
        gameHistory,
        splits: {
          home: {
            games: homeGames.length,
            averages: calculateAvgStats(homeGames),
          },
          away: {
            games: awayGames.length,
            averages: calculateAvgStats(awayGames),
          },
          overall: {
            games: homeGames.length + awayGames.length,
            averages: calculateAvgStats([...homeGames, ...awayGames]),
          },
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching team stats:', error);
    next(error);
  }
});

// GET /api/stats/teams/:league/:teamName
// Look up team stats by sport league key and team name (used by /teams/:league/:teamName URL pattern)
router.get('/teams/:league/:teamName', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { league, teamName } = req.params;
    const { season, location } = req.query;

    // Find the sport by league key
    const sport = await prisma.sport.findFirst({
      where: { key: league },
    });

    if (!sport) {
      return res.status(404).json({ success: false, error: `League not found: ${league}` });
    }

    // Find team by name (case-insensitive) within the sport
    const team = await prisma.team.findFirst({
      where: {
        sportId: sport.id,
        name: { equals: decodeURIComponent(teamName), mode: 'insensitive' },
      },
    });

    if (!team) {
      // Team not in DB yet — return basic info with empty stats so the page renders
      return res.json({
        success: true,
        data: {
          team: { id: null, name: decodeURIComponent(teamName), abbreviation: null, logoUrl: null, league },
          seasonStats: null,
          gameHistory: [],
          splits: {
            home: { games: 0, averages: {} },
            away: { games: 0, averages: {} },
            overall: { games: 0, averages: {} },
          },
        },
      });
    }

    // Reuse existing team stats logic with the resolved numeric teamId
    const teamId = team.id;
    const where: Prisma.GameStatsWhereInput = { teamId };

    if (location === 'home') where.isHome = true;
    else if (location === 'away') where.isHome = false;

    if (season) {
      where.game = {
        commenceTime: {
          gte: new Date(parseInt(season as string), 0, 1),
          lt: new Date(parseInt(season as string) + 1, 0, 1),
        },
      };
    }

    const teamStats = await prisma.teamStats.findFirst({
      where: {
        teamId,
        season: season ? parseInt(season as string) : new Date().getFullYear(),
      },
      include: { team: true },
    });

    const gameHistory = await prisma.gameStats.findMany({
      where,
      include: {
        game: {
          select: {
            id: true,
            homeTeamName: true,
            awayTeamName: true,
            commenceTime: true,
            status: true,
            homeScore: true,
            awayScore: true,
          },
        },
      },
      orderBy: { game: { commenceTime: 'desc' } },
      take: 20,
    });

    const homeGames = await prisma.gameStats.findMany({ where: { teamId, isHome: true } });
    const awayGames = await prisma.gameStats.findMany({ where: { teamId, isHome: false } });

    const calculateAvgStats = (games: { stats: Prisma.JsonValue }[]) => {
      if (games.length === 0) return {};
      const totals = games.reduce<Record<string, number>>((acc, game) => {
        const stats = toStatsObject(game.stats);
        Object.entries(stats).forEach(([key, value]) => {
          if (typeof value === 'number') acc[key] = (acc[key] || 0) + value;
        });
        return acc;
      }, {});
      const averages: Record<string, string> = {};
      Object.keys(totals).forEach(key => { averages[key] = (totals[key] / games.length).toFixed(1); });
      return averages;
    };

    res.json({
      success: true,
      data: {
        team: { id: team.id, name: team.name, abbreviation: team.abbreviation, logoUrl: team.logoUrl, league },
        seasonStats: teamStats,
        gameHistory,
        splits: {
          home: { games: homeGames.length, averages: calculateAvgStats(homeGames) },
          away: { games: awayGames.length, averages: calculateAvgStats(awayGames) },
          overall: { games: homeGames.length + awayGames.length, averages: calculateAvgStats([...homeGames, ...awayGames]) },
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching team stats by league/name:', error);
    next(error);
  }
});

// GET /api/stats/player/:playerId
router.get('/player/:playerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playerId = parseInt(req.params.playerId);

    if (isNaN(playerId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid player ID',
      });
    }

    // Fetch player details
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: {
        team: true,
      },
    });

    if (!player) {
      return res.status(404).json({
        success: false,
        error: 'Player not found',
      });
    }

    // Fetch player game log
    const gameStats = await prisma.playerGameStats.findMany({
      where: { playerId },
      include: {
        game: {
          select: {
            id: true,
            homeTeamName: true,
            awayTeamName: true,
            commenceTime: true,
            status: true,
            homeScore: true,
            awayScore: true,
          },
        },
      },
      orderBy: {
        game: { commenceTime: 'desc' },
      },
      take: 20,
    });

    res.json({
      success: true,
      data: {
        player,
        gameLog: gameStats,
      },
    });
  } catch (error) {
    logger.error('Error fetching player stats:', error);
    next(error);
  }
});

export default router;
