import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

const router = Router();

/**
 * GET /api/games
 * List games with filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { date, sport, status, timezoneOffset, bookmaker } = req.query;
    
    // Build where clause
    const where: any = {};
    
    // Filter by date (timezone-aware filtering)
    if (date && typeof date === 'string') {
      // Get timezone offset in minutes from client
      // JavaScript getTimezoneOffset() returns positive for UTC-west (e.g., 420 for MST/UTC-7)
      const offsetMinutes = timezoneOffset ? parseInt(timezoneOffset as string) : 0;
      
      // User sends "2026-01-09" meaning their local date
      // We need to find games that occur during that local date
      
      // Start of day in user's timezone, converted to UTC
      // For MST (offset=420): "2026-01-09 00:00" MST = "2026-01-09 07:00" UTC
      const userLocalMidnight = new Date(date + 'T00:00:00');
      const startOfDayUTC = new Date(userLocalMidnight.getTime() + (offsetMinutes * 60000));
      
      // End of day in user's timezone, converted to UTC  
      // For MST (offset=420): "2026-01-09 23:59:59" MST = "2026-01-10 06:59:59" UTC
      const endOfDayUTC = new Date(startOfDayUTC.getTime() + (24 * 60 * 60 * 1000) - 1);
      
      logger.info('Date filtering:', {
        userDate: date,
        offsetMinutes,
        startOfDayUTC: startOfDayUTC.toISOString(),
        endOfDayUTC: endOfDayUTC.toISOString()
      });
      
      where.commenceTime = {
        gte: startOfDayUTC,
        lte: endOfDayUTC
      };
    }
    
    // Filter by sport key
    if (sport && typeof sport === 'string' && sport !== 'all') {
      const sportRecord = await prisma.sport.findUnique({
        where: { key: sport }
      });
      if (sportRecord) {
        where.sportId = sportRecord.id;
      }
    }
    
    // Filter by status
    if (status && typeof status === 'string') {
      where.status = status;
    }
    
    // Fetch games with sport and odds
    const games = await prisma.game.findMany({
      where,
      include: {
        sport: true,
        homeTeam: true,
        awayTeam: true,
        currentOdds: {
          where: bookmaker && typeof bookmaker === 'string' 
            ? { bookmaker: bookmaker }
            : undefined,
          orderBy: {
            lastUpdated: 'desc'
          }
        }
      },
      orderBy: {
        commenceTime: 'asc'
      }
    });
    
    logger.info(`Fetched ${games.length} games with filters:`, { date, sport, status, bookmaker });
    
    // Transform games to flatten sport data and format odds for frontend
    const transformedGames = games.map(game => {
      // Find best odds from different bookmakers
      // For simplicity, we'll use the first bookmaker's odds or aggregate
      const h2hOdds = game.currentOdds.find(o => o.marketType === 'h2h');
      const spreadOdds = game.currentOdds.find(o => o.marketType === 'spreads');
      const totalOdds = game.currentOdds.find(o => o.marketType === 'totals');
      
      // Group odds by bookmaker for frontend card format
      const bookmakerOddsMap = new Map<string, any>();
      game.currentOdds.forEach(odd => {
        if (!bookmakerOddsMap.has(odd.bookmaker)) {
          bookmakerOddsMap.set(odd.bookmaker, {
            key: odd.bookmaker,
            title: odd.bookmaker.charAt(0).toUpperCase() + odd.bookmaker.slice(1),
            markets: []
          });
        }
        
        const bookmaker = bookmakerOddsMap.get(odd.bookmaker);
        
        if (odd.marketType === 'h2h' && odd.homePrice && odd.awayPrice) {
          bookmaker.markets.push({
            key: 'h2h',
            outcomes: [
              { name: game.awayTeamName, price: odd.awayPrice },
              { name: game.homeTeamName, price: odd.homePrice }
            ]
          });
        } else if (odd.marketType === 'spreads' && odd.homeSpread && odd.awaySpread) {
          bookmaker.markets.push({
            key: 'spreads',
            outcomes: [
              { name: game.awayTeamName, price: odd.awaySpreadPrice || 0, point: Number(odd.awaySpread) },
              { name: game.homeTeamName, price: odd.homeSpreadPrice || 0, point: Number(odd.homeSpread) }
            ]
          });
        } else if (odd.marketType === 'totals' && odd.totalLine) {
          bookmaker.markets.push({
            key: 'totals',
            outcomes: [
              { name: 'Over', price: odd.overPrice || 0, point: Number(odd.totalLine) },
              { name: 'Under', price: odd.underPrice || 0, point: Number(odd.totalLine) }
            ]
          });
        }
      });
      
      return {
        id: game.id,
        externalId: game.externalId,
        sportKey: game.sport.key,
        sportName: game.sport.name,
        homeTeamName: game.homeTeamName,
        awayTeamName: game.awayTeamName,
        commenceTime: game.commenceTime,
        venue: game.venue,
        weather: game.weather,
        status: game.status,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        // Bookmakers array for frontend card
        bookmakers: Array.from(bookmakerOddsMap.values()),
        // Legacy format for compatibility
        homeOdds: {
          moneyline: h2hOdds?.homePrice || undefined,
          spread: spreadOdds ? {
            line: Number(spreadOdds.homeSpread),
            odds: spreadOdds.homeSpreadPrice
          } : undefined,
          total: totalOdds ? {
            line: Number(totalOdds.totalLine),
            odds: totalOdds.underPrice  // Under is associated with home team
          } : undefined
        },
        awayOdds: {
          moneyline: h2hOdds?.awayPrice || undefined,
          spread: spreadOdds ? {
            line: Number(spreadOdds.awaySpread),
            odds: spreadOdds.awaySpreadPrice
          } : undefined,
          total: totalOdds ? {
            line: Number(totalOdds.totalLine),
            odds: totalOdds.overPrice  // Over is associated with away team
          } : undefined
        }
      };
    });
    
    res.json({
      status: 'success',
      data: {
        games: transformedGames,
        count: games.length
      }
    });
  } catch (error: any) {
    logger.error('Error fetching games:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch games',
      error: error.message
    });
  }
});

/**
 * GET /api/games/:id
 * Get single game with odds
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        sport: true,
        homeTeam: true,
        awayTeam: true,
        currentOdds: {
          orderBy: {
            bookmaker: 'asc'
          }
        }
      }
    });
    
    if (!game) {
      return res.status(404).json({
        status: 'error',
        message: 'Game not found'
      });
    }
    
    res.json({
      status: 'success',
      data: game
    });
  } catch (error: any) {
    logger.error('Error fetching game:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch game',
      error: error.message
    });
  }
});

/**
 * GET /api/games/:id/odds
 * Get current odds for a game
 */
router.get('/:id/odds', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { bookmaker, marketType } = req.query;
    
    const where: any = { gameId: id };
    if (bookmaker && typeof bookmaker === 'string') {
      where.bookmaker = bookmaker;
    }
    if (marketType && typeof marketType === 'string') {
      where.marketType = marketType;
    }
    
    const odds = await prisma.currentOdds.findMany({
      where,
      orderBy: [
        { marketType: 'asc' },
        { bookmaker: 'asc' }
      ]
    });
    
    res.json({
      status: 'success',
      data: odds
    });
  } catch (error: any) {
    logger.error('Error fetching game odds:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch odds',
      error: error.message
    });
  }
});

/**
 * GET /api/games/:id/odds/history
 * Get odds movement history
 */
router.get('/:id/odds/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { bookmaker, marketType, hours = '24' } = req.query;
    
    const hoursAgo = new Date();
    hoursAgo.setHours(hoursAgo.getHours() - parseInt(hours as string));
    
    const where: any = {
      gameId: id,
      timestamp: { gte: hoursAgo }
    };
    
    if (bookmaker && typeof bookmaker === 'string') {
      where.bookmaker = bookmaker;
    }
    if (marketType && typeof marketType === 'string') {
      where.marketType = marketType;
    }
    
    const history = await prisma.oddsSnapshot.findMany({
      where,
      orderBy: {
        capturedAt: 'asc'
      }
    });
    
    res.json({
      status: 'success',
      data: history
    });
  } catch (error: any) {
    logger.error('Error fetching odds history:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch odds history',
      error: error.message
    });
  }
});

export default router;
