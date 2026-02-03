import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

const router = Router();
const prisma = new PrismaClient();

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

        const avgStats: any = {};
        
        // Aggregate stats based on sport type
        if (game.sport.key.includes('basketball')) {
          const totals = teamGames.reduce((acc, g: any) => ({
            points: acc.points + (g.stats.points || 0),
            rebounds: acc.rebounds + (g.stats.rebounds || 0),
            assists: acc.assists + (g.stats.assists || 0),
          }), { points: 0, rebounds: 0, assists: 0 });

          avgStats.points = (totals.points / totalGames).toFixed(1);
          avgStats.rebounds = (totals.rebounds / totalGames).toFixed(1);
          avgStats.assists = (totals.assists / totalGames).toFixed(1);
        } else if (game.sport.key.includes('football')) {
          const totals = teamGames.reduce((acc, g: any) => ({
            yards: acc.yards + (g.stats.yards?.total || 0),
            touchdowns: acc.touchdowns + (g.stats.touchdowns?.total || 0),
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
    const where: any = {
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
    const calculateAvgStats = (games: any[]) => {
      if (games.length === 0) return null;
      
      const totals = games.reduce((acc, game) => {
        const stats = game.stats as any;
        Object.keys(stats).forEach(key => {
          if (typeof stats[key] === 'number') {
            acc[key] = (acc[key] || 0) + stats[key];
          }
        });
        return acc;
      }, {} as any);

      const averages: any = {};
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
