import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { betService } from '../services/bet.service';
import { BetResponse, BetLegResponse, BetStats, BetStatus } from '../types/bet.types';
import { logger } from '../config/logger';

/**
 * MCP Controller
 * 
 * Endpoints designed for Claude integration via MCP
 * All responses formatted for easy AI consumption
 */

/**
 * GET /api/mcp/bets/active
 * Get all active (pending) bets for MCP
 */
export async function getActiveBets(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.apiKey?.userId ?? undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    const result = await betService.getBets({ status: 'pending', userId, limit });

    // Format for AI consumption
    const formattedBets = result.bets.map(bet => ({
      id: bet.id,
      name: bet.name,
      bet_type: bet.betType,
      stake: bet.stake.toNumber(),
      potential_payout: bet.potentialPayout?.toNumber() || 0,
      odds_at_placement: bet.oddsAtPlacement,
      placed_at: bet.placedAt.toISOString(),
      legs: bet.legs.map(leg => ({
        game_name: `${leg.game.awayTeamName} @ ${leg.game.homeTeamName}`,
        game_time: leg.game.commenceTime.toISOString(),
        sport: leg.game.sport.name,
        selection_type: leg.selectionType,
        selection: leg.selection,
        team_name: leg.teamName,
        line: leg.line?.toNumber() || null,
        odds: leg.odds,
        status: leg.status
      }))
    }));

    const totalAtRisk = formattedBets.reduce((sum, bet) => sum + bet.stake, 0);

    res.json({
      status: 'success',
      data: {
        bets: formattedBets,
        total_at_risk: totalAtRisk,
        count: formattedBets.length
      }
    });
  } catch (error) {
    logger.error('Error fetching active bets:', error);
    next(error);
  }
}

/**
 * GET /api/mcp/bets/summary
 * Get betting summary for MCP
 */
export async function getBettingSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.apiKey?.userId ?? undefined;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get active bets
    const activeBets = await betService.getBets({ status: 'pending', userId });
    const activeStake = activeBets.bets.reduce((sum, bet) => sum + bet.stake.toNumber(), 0);
    const activePotential = activeBets.bets.reduce((sum, bet) => sum + (bet.potentialPayout?.toNumber() || 0), 0);

    // Get today's stats
    const todayStats = await betService.getStats({
      startDate: todayStart,
      endDate: now,
      userId
    });

    // Get this week's stats
    const weekStats = await betService.getStats({
      startDate: weekStart,
      endDate: now,
      userId
    });

    // Get all-time stats
    const allTimeStats = await betService.getStats({ userId });

    res.json({
      status: 'success',
      data: {
        active: {
          count: activeBets.total,
          total_stake: activeStake,
          potential_return: activePotential
        },
        today: {
          bets: todayStats.totalBets,
          won: todayStats.wonBets,
          lost: todayStats.lostBets,
          pnl: todayStats.netProfit
        },
        this_week: {
          bets: weekStats.totalBets,
          win_rate: weekStats.winRate.toFixed(1) + '%',
          pnl: weekStats.netProfit
        },
        all_time: {
          total_bets: allTimeStats.totalBets,
          win_rate: allTimeStats.winRate.toFixed(1) + '%',
          total_pnl: allTimeStats.netProfit,
          roi: allTimeStats.roi.toFixed(1) + '%'
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching betting summary:', error);
    next(error);
  }
}

/**
 * GET /api/mcp/bets/advice-context
 * Get full context for AI betting advice
 */
export async function getAdviceContext(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.apiKey?.userId ?? undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    // Get active bets
    const activeBets = await betService.getBets({ status: 'pending', userId, limit });

    // Get recent settled bets (last 10)
    const recentBets = await betService.getBets({
      status: ['won', 'lost', 'push'],
      limit: 10,
      userId
    });

    // Get all-time stats
    const stats = await betService.getStats({ userId });

    // Calculate bankroll exposure
    const totalAtRisk = activeBets.bets.reduce((sum, bet) => sum + bet.stake.toNumber(), 0);

    // Sport breakdown
    const sportBreakdown: Record<string, { count: number; stake: number }> = {};
    for (const bet of activeBets.bets) {
      const sport = bet.legs[0]?.game.sport.key || 'unknown';
      if (!sportBreakdown[sport]) {
        sportBreakdown[sport] = { count: 0, stake: 0 };
      }
      sportBreakdown[sport].count++;
      sportBreakdown[sport].stake += bet.stake.toNumber();
    }

    // Analyze risk
    const settings = await prisma.adminSettings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' }
    });
    const analysis = analyzeRisk(activeBets.bets, recentBets.bets, stats, totalAtRisk, settings);

    res.json({
      status: 'success',
      data: {
        active_bets: activeBets.bets.map(formatBetForAdvice),
        recent_results: recentBets.bets.map(formatBetForAdvice),
        bankroll_exposure: totalAtRisk,
        sport_breakdown: sportBreakdown
      },
      analysis
    });
  } catch (error) {
    logger.error('Error fetching advice context:', error);
    next(error);
  }
}

/**
 * GET /api/mcp/games/with-exposure
 * Get today's games with user's betting positions
 */
export async function getGamesWithExposure(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.apiKey?.userId ?? undefined;
    const sportKey = req.query.sport as string | undefined;

    // Get today's games anchored to midnight so earlier-today games are included
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const where: Prisma.GameWhereInput = {
      commenceTime: {
        gte: todayStart,
        lt: tomorrowStart
      },
      status: {
        in: ['scheduled', 'in_progress']
      }
    };

    if (sportKey) {
      where.sport = { key: sportKey };
    }

    const games = await prisma.game.findMany({
      where,
      include: {
        sport: true,
        betLegs: {
          where: {
            bet: {
              status: 'pending',
              ...(userId ? { userId } : {})
            }
          },
          include: {
            bet: true
          }
        }
      },
      orderBy: { commenceTime: 'asc' }
    });

    // Format games with exposure
    const gamesWithExposure = games.map(game => {
      const myBets = game.betLegs.map(leg => ({
        bet_id: leg.bet.id,
        bet_name: leg.bet.name,
        selection: `${leg.selectionType} - ${leg.selection}`,
        stake: leg.bet.stake.toNumber(),
        potential: leg.bet.potentialPayout?.toNumber() || 0
      }));

      const totalExposure = myBets.reduce((sum, bet) => sum + bet.stake, 0);

      return {
        id: game.id,
        matchup: `${game.awayTeamName} @ ${game.homeTeamName}`,
        sport: game.sport.name,
        commence_time: game.commenceTime.toISOString(),
        status: game.status,
        my_bets: myBets,
        total_exposure: totalExposure
      };
    });

    // Only include games with bets or filter if requested
    const filtered = req.query.onlyWithBets === 'true'
      ? gamesWithExposure.filter(g => g.my_bets.length > 0)
      : gamesWithExposure;

    res.json({
      status: 'success',
      data: {
        games: filtered,
        total_games: filtered.length,
        total_exposure: filtered.reduce((sum, g) => sum + g.total_exposure, 0)
      }
    });
  } catch (error) {
    logger.error('Error fetching games with exposure:', error);
    next(error);
  }
}

/**
 * POST /api/mcp/bets/quick-create
 * Simplified bet creation for MCP
 */
export async function quickCreateBet(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.apiKey?.userId ?? undefined;
    const { game_id, selection_type, selection, stake, name, line, odds } = req.body;

    // Get game info for name generation
    const game = await prisma.game.findUnique({
      where: { id: game_id },
      include: { sport: true }
    });

    if (!game) {
      return res.status(404).json({
        status: 'error',
        error: 'Game not found'
      });
    }

    // Auto-generate name if not provided
    const betName = name || generateBetName(game, selection_type, selection, line);

    // Create bet scoped to the calling API key's user
    const bet = await betService.createBet({
      name: betName,
      betType: 'single',
      stake,
      legs: [
        {
          gameId: game_id,
          selectionType: selection_type,
          selection,
          line,
          odds
        }
      ]
    }, userId);

    res.status(201).json({
      status: 'success',
      data: {
        id: bet.id,
        name: bet.name,
        stake: bet.stake.toNumber(),
        potential_payout: bet.potentialPayout?.toNumber() || 0,
        odds: bet.oddsAtPlacement
      }
    });
  } catch (error) {
    logger.error('Error creating quick bet:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({
      status: 'error',
      error: errorMessage,
      hint: 'Check that the game exists and hasn\'t started yet'
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format bet for advice context
 */
function formatBetForAdvice(bet: BetResponse) {
  return {
    name: bet.name,
    type: bet.betType,
    stake: bet.stake.toNumber(),
    status: bet.status,
    odds: bet.oddsAtPlacement,
    placed_at: bet.placedAt.toISOString(),
    settled_at: bet.settledAt?.toISOString() || null,
    profit: bet.actualPayout ? bet.actualPayout.toNumber() - bet.stake.toNumber() : null,
    legs: bet.legs.map((leg: BetLegResponse) => ({
      game: `${leg.game.awayTeamName} @ ${leg.game.homeTeamName}`,
      sport: leg.game.sport.name,
      pick: `${leg.selectionType} ${leg.selection}`,
      status: leg.status
    }))
  };
}

/**
 * Analyze betting risk and provide insights.
 * Thresholds are read from AdminSettings (deployment-configurable).
 */
function analyzeRisk(
  activeBets: BetResponse[],
  recentBets: BetResponse[],
  stats: BetStats,
  totalAtRisk: number,
  settings: { riskHighThreshold: number; riskModerateThreshold: number; winRateLow: number; winRateHigh: number }
) {
  // Determine risk level based on exposure and recent performance
  let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW';
  const suggestions: string[] = [];

  // Check exposure against configurable thresholds
  const exposurePercentage = stats.totalStaked > 0
    ? (totalAtRisk / stats.totalStaked * 100).toFixed(1)
    : '0.0';

  if (totalAtRisk > settings.riskHighThreshold) {
    riskLevel = 'HIGH';
    suggestions.push('High exposure detected. Consider reducing active bet count.');
  } else if (totalAtRisk > settings.riskModerateThreshold) {
    riskLevel = 'MODERATE';
  }

  // Check diversification
  const sports = new Set(activeBets.flatMap(bet =>
    bet.legs.map((leg: BetLegResponse) => leg.game.sport.key)
  ));
  const isDiversified = sports.size > 1;

  if (!isDiversified && activeBets.length > 2) {
    suggestions.push('Consider diversifying across multiple sports.');
  }

  // Check bet types
  const parlayCount = activeBets.filter(bet => bet.betType === 'parlay').length;
  if (parlayCount > activeBets.length * 0.7) {
    suggestions.push('High percentage of parlays. Consider more single bets for steady returns.');
  }

  // Analyze recent streak
  let currentStreak = '';
  if (recentBets.length > 0) {
    const lastBet = recentBets[0];
    if (lastBet.status === 'won') {
      const winStreak = recentBets.findIndex(bet => bet.status !== 'won');
      currentStreak = `${winStreak === -1 ? recentBets.length : winStreak} win streak`;
    } else if (lastBet.status === 'lost') {
      const loseStreak = recentBets.findIndex(bet => bet.status !== 'lost');
      currentStreak = `${loseStreak === -1 ? recentBets.length : loseStreak} loss streak`;
      
      if (loseStreak >= 3) {
        suggestions.push('Consider taking a break or reducing stake sizes after losing streak.');
      }
    }
  }

  // Win rate analysis against configurable thresholds
  if (stats.totalBets >= 20) {
    if (stats.winRate < settings.winRateLow) {
      suggestions.push('Win rate below threshold. Review betting strategy and selection criteria.');
    } else if (stats.winRate > settings.winRateHigh) {
      suggestions.push('Strong win rate! Maintain current strategy.');
    }
  }

  // ROI analysis
  if (stats.totalBets >= 20) {
    if (stats.roi < -10) {
      suggestions.push('Negative ROI. Focus on value betting and bankroll management.');
    } else if (stats.roi > 10) {
      suggestions.push('Excellent ROI! Your strategy is working well.');
    }
  }

  return {
    risk_level: riskLevel,
    exposure_percentage: exposurePercentage + '%',
    is_diversified: isDiversified,
    current_streak: currentStreak || 'No recent bets',
    suggestions: suggestions.length > 0 ? suggestions : ['No specific concerns. Keep monitoring your performance.']
  };
}

/**
 * Generate bet name from game and selection
 */
function generateBetName(
  game: { homeTeamName: string; awayTeamName: string },
  selectionType: string,
  selection: string,
  line?: number
): string {
  const teams = `${game.awayTeamName} @ ${game.homeTeamName}`;

  if (selectionType === 'moneyline') {
    const team = selection === 'home' ? game.homeTeamName : game.awayTeamName;
    return `${team} ML`;
  }

  if (selectionType === 'spread') {
    const team = selection === 'home' ? game.homeTeamName : game.awayTeamName;
    const lineStr = line ? ` ${line > 0 ? '+' : ''}${line}` : '';
    return `${team}${lineStr}`;
  }

  if (selectionType === 'total') {
    const lineStr = line ? ` ${line}` : '';
    return `${teams} ${selection.toUpperCase()}${lineStr}`;
  }

  return `${teams} - ${selectionType}`;
}

// ============================================================================
// PHASE 2: ADDITIONAL MCP ROUTES (rewired from /api/* session routes)
// ============================================================================

/**
 * GET /api/mcp/games
 * List upcoming games for MCP (apiKeyAuth, no session required)
 */
export async function getMcpGames(req: Request, res: Response, next: NextFunction) {
  try {
    const { sport, status } = req.query;

    const where: Prisma.GameWhereInput = {};
    if (sport) where.sport = { key: sport as string };
    if (status) where.status = status as string;

    const games = await prisma.game.findMany({
      where,
      include: { sport: true },
      orderBy: { commenceTime: 'asc' },
      take: 50
    });

    res.json({
      status: 'success',
      data: {
        games: games.map(g => ({
          id: g.id,
          matchup: `${g.awayTeamName} @ ${g.homeTeamName}`,
          home_team: g.homeTeamName,
          away_team: g.awayTeamName,
          sport: g.sport.name,
          sport_key: g.sport.key,
          commence_time: g.commenceTime.toISOString(),
          status: g.status,
          home_score: g.homeScore,
          away_score: g.awayScore
        })),
        count: games.length
      }
    });
  } catch (error) {
    logger.error('Error fetching MCP games:', error);
    next(error);
  }
}

/**
 * GET /api/mcp/bets
 * List bets with optional status filter for MCP
 */
export async function getMcpBets(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.apiKey?.userId ?? undefined;
    const { status, limit: limitStr } = req.query;
    const limit = limitStr ? parseInt(limitStr as string) : 50;

    const result = await betService.getBets({
      ...(userId ? { userId } : {}),
      ...(status ? { status: status as BetStatus } : {}),
      limit
    });

    res.json({
      status: 'success',
      data: {
        bets: result.bets,
        total: result.total,
        limit: result.limit,
        offset: result.offset
      }
    });
  } catch (error) {
    logger.error('Error fetching MCP bets:', error);
    next(error);
  }
}

/**
 * GET /api/mcp/bets/:id
 * Get a single bet by ID, scoped to the calling user
 */
export async function getMcpBetById(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.apiKey?.userId ?? undefined;
    const { id } = req.params;

    const bet = await prisma.bet.findFirst({
      where: {
        id,
        ...(userId ? { userId } : {})
      },
      include: {
        legs: {
          include: {
            game: {
              include: { sport: { select: { key: true, name: true } } }
            }
          }
        }
      }
    });

    if (!bet) {
      return res.status(404).json({
        status: 'error',
        error: 'Bet not found'
      });
    }

    res.json({
      status: 'success',
      data: { bet }
    });
  } catch (error) {
    logger.error('Error fetching MCP bet by id:', error);
    next(error);
  }
}

/**
 * GET /api/mcp/games/:id/odds
 * Get current odds for a specific game
 */
export async function getMcpGameOdds(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const game = await prisma.game.findUnique({
      where: { id },
      include: { sport: true }
    });

    if (!game) {
      return res.status(404).json({
        status: 'error',
        error: 'Game not found'
      });
    }

    const odds = await prisma.currentOdds.findMany({
      where: { gameId: id },
      orderBy: { bookmaker: 'asc' }
    });

    res.json({
      status: 'success',
      data: {
        game: {
          id: game.id,
          matchup: `${game.awayTeamName} @ ${game.homeTeamName}`,
          sport: game.sport.name,
          commence_time: game.commenceTime.toISOString(),
          status: game.status
        },
        odds
      }
    });
  } catch (error) {
    logger.error('Error fetching MCP game odds:', error);
    next(error);
  }
}

/**
 * GET /api/mcp/teams/search?q=
 * Search teams by name (case-insensitive)
 */
export async function searchTeams(req: Request, res: Response, next: NextFunction) {
  try {
    const q = (req.query.q as string | undefined)?.trim();

    if (!q) {
      return res.status(400).json({
        status: 'error',
        error: 'Query parameter "q" is required'
      });
    }

    const teams = await prisma.team.findMany({
      where: {
        name: {
          contains: q,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        name: true,
        abbreviation: true,
        sport: true,
        logoUrl: true
      },
      take: 20
    });

    res.json({
      status: 'success',
      data: {
        teams,
        count: teams.length
      }
    });
  } catch (error) {
    logger.error('Error searching teams:', error);
    next(error);
  }
}
