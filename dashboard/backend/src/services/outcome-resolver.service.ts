import axios, { AxiosInstance } from 'axios';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import {
  GameResult,
  ResolveResult,
  EspnScoreboardResponse,
  EspnEvent,
  ESPN_SPORT_MAPPING
} from '../types/outcome.types';
import {
  determineMoneylineOutcome,
  determineSpreadOutcome,
  determineTotalOutcome,
  calculateParlayOdds,
  calculatePayout,
  decimalToAmerican
} from '../utils/odds-calculator';
import { BetOutcome } from '../types/betting.types';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Service for resolving game outcomes and settling bets
 * 
 * Handles:
 * - Fetching scores from ESPN API
 * - Updating game records
 * - Settling bet legs based on outcomes
 * - Settling complete bets
 */
export class OutcomeResolverService {
  private espnClient: AxiosInstance;
  private readonly espnBaseUrl = 'https://site.api.espn.com/apis/site/v2/sports';

  constructor() {
    this.espnClient = axios.create({
      baseURL: this.espnBaseUrl,
      timeout: 15000,
      headers: {
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Resolve outcomes for all pending games
   */
  async resolveOutcomes(): Promise<ResolveResult> {
    logger.info('Starting outcome resolution...');

    const result: ResolveResult = {
      success: true,
      gamesChecked: 0,
      gamesUpdated: 0,
      legsSettled: 0,
      betsSettled: 0,
      errors: []
    };

    try {
      // Find games that should be finished
      const now = new Date();
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

      const games = await prisma.game.findMany({
        where: {
          status: {
            in: ['scheduled', 'in_progress']
          },
          commenceTime: {
            lt: now,
            gt: sixHoursAgo // Don't check games older than 6 hours
          }
        },
        include: {
          sport: true
        }
      });

      logger.info(`Found ${games.length} games to check`);
      result.gamesChecked = games.length;

      // Check each game
      for (const game of games) {
        try {
          const gameResult = await this.checkGameResult(game);

          if (gameResult && gameResult.completed) {
            // Update game
            await this.updateGameScore(game.id, gameResult);
            result.gamesUpdated++;

            // Settle bet legs
            const legResult = await this.settleBetLegs(game.id, gameResult);
            result.legsSettled += legResult.legsSettled;
            result.betsSettled += legResult.betsSettled;

            logger.info(`Settled game ${game.id}: ${game.homeTeamName} ${gameResult.homeScore} - ${gameResult.awayScore} ${game.awayTeamName}`);
          }

          // Add delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          const errorMsg = `Failed to check game ${game.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          logger.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      logger.info(`Outcome resolution complete: ${result.gamesUpdated} games, ${result.legsSettled} legs, ${result.betsSettled} bets`);

      if (result.errors.length > 0) {
        logger.warn(`Resolution completed with ${result.errors.length} errors`);
      }

    } catch (error) {
      const errorMsg = `Fatal error during outcome resolution: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(errorMsg);
      result.success = false;
      result.errors.push(errorMsg);
    }

    return result;
  }

  /**
   * Check game result from ESPN
   */
  async checkGameResult(game: any): Promise<GameResult | null> {
    const mapping = ESPN_SPORT_MAPPING[game.sport.key];

    if (!mapping) {
      logger.warn(`No ESPN mapping for sport: ${game.sport.key}`);
      return null;
    }

    try {
      // Format game date for ESPN API (YYYYMMDD)
      const gameDate = new Date(game.commenceTime);
      const dateStr = gameDate.toISOString().split('T')[0].replace(/-/g, '');
      
      // Fetch scoreboard for the game's date
      const response = await this.espnClient.get<EspnScoreboardResponse>(
        `/${mapping.sport}/${mapping.league}/scoreboard`,
        {
          params: {
            dates: dateStr // YYYYMMDD format
          }
        }
      );

      if (!response.data.events || response.data.events.length === 0) {
        logger.debug(`No events found on ESPN for ${mapping.sport}/${mapping.league} on ${dateStr}`);
        return null;
      }

      // Find matching game by team names
      const matchedEvent = this.findMatchingEvent(
        response.data.events,
        game.homeTeamName,
        game.awayTeamName
      );

      if (!matchedEvent) {
        logger.debug(`No matching event found for ${game.homeTeamName} vs ${game.awayTeamName} on ESPN (${response.data.events.length} events checked)`);
        return null;
      }

      const competition = matchedEvent.competitions[0];
      const status = competition.status.type;

      // Extract scores
      const homeCompetitor = competition.competitors.find(c => c.homeAway === 'home');
      const awayCompetitor = competition.competitors.find(c => c.homeAway === 'away');

      if (!homeCompetitor || !awayCompetitor) {
        logger.warn(`Could not find competitors for game ${game.id}`);
        return null;
      }

      const homeScore = parseInt(homeCompetitor.score, 10);
      const awayScore = parseInt(awayCompetitor.score, 10);

      // Extract period and clock information (with type safety)
      // Both period and clock are on competition.status, not competition.status.type
      const period = (competition.status as any).period ? `${(competition.status as any).period}` : null;
      const clock = (competition.status as any).displayClock || null;

      // Check if completed
      if (!status.completed) {
        // Update to in_progress with live scores
        if (game.status === 'scheduled' && status.state === 'in') {
          await prisma.game.update({
            where: { id: game.id },
            data: { 
              status: 'in_progress',
              homeScore: homeScore,
              awayScore: awayScore,
              period: period,
              clock: clock,
              updatedAt: new Date()
            }
          });
          logger.info(`Updated game ${game.id} to in_progress with live scores: ${homeScore}-${awayScore}`);
        } else if (game.status === 'in_progress') {
          // Update live scores for already in-progress games
          await prisma.game.update({
            where: { id: game.id },
            data: { 
              homeScore: homeScore,
              awayScore: awayScore,
              period: period,
              clock: clock,
              updatedAt: new Date()
            }
          });
          logger.debug(`Updated live scores for game ${game.id}: ${homeScore}-${awayScore}`);
        }
        return null;
      }

      return {
        homeScore: homeScore,
        awayScore: awayScore,
        status: status.name,
        completed: true
      };

    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(`ESPN API error for ${mapping.sport}/${mapping.league}: ${error.message}`);
      } else {
        logger.error(`Error checking game result: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      return null;
    }
  }

  /**
   * Update game with final score
   */
  async updateGameScore(gameId: string, result: GameResult): Promise<void> {
    await prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'final',
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        updatedAt: new Date()
      }
    });

    logger.info(`Updated game ${gameId} with final score`);
  }

  /**
   * Settle all bet legs for a game
   */
  async settleBetLegs(
    gameId: string,
    result: GameResult
  ): Promise<{ legsSettled: number; betsSettled: number }> {
    const legsSettled = 0;
    const betsSettled = 0;

    // Find all pending legs for this game
    const legs = await prisma.betLeg.findMany({
      where: {
        gameId,
        status: 'pending'
      },
      include: {
        bet: true
      }
    });

    if (legs.length === 0) {
      return { legsSettled: 0, betsSettled: 0 };
    }

    logger.info(`Settling ${legs.length} bet legs for game ${gameId}`);

    const processedBets = new Set<string>();

    // Settle each leg
    for (const leg of legs) {
      try {
        const outcome = this.determineLegOutcome(leg, result);

        await prisma.betLeg.update({
          where: { id: leg.id },
          data: {
            status: outcome,
            updatedAt: new Date()
          }
        });

        logger.debug(`Settled leg ${leg.id}: ${outcome}`);

        // Track bet for settlement
        processedBets.add(leg.betId);

      } catch (error) {
        logger.error(`Failed to settle leg ${leg.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Check and settle each unique bet
    let settledCount = 0;
    for (const betId of processedBets) {
      try {
        const wasSettled = await this.checkAndSettleBet(betId);
        if (wasSettled) settledCount++;
      } catch (error) {
        logger.error(`Failed to settle bet ${betId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      legsSettled: legs.length,
      betsSettled: settledCount
    };
  }

  /**
   * Check if bet can be settled and settle it
   */
  async checkAndSettleBet(betId: string): Promise<boolean> {
    // Get bet with all legs
    const bet = await prisma.bet.findUnique({
      where: { id: betId },
      include: {
        legs: true
      }
    });

    if (!bet) {
      logger.warn(`Bet ${betId} not found`);
      return false;
    }

    // Check if already settled
    if (bet.status !== 'pending') {
      return false;
    }

    // Check if all legs are settled
    const pendingLegs = bet.legs.filter(leg => leg.status === 'pending');
    if (pendingLegs.length > 0) {
      logger.debug(`Bet ${betId} still has ${pendingLegs.length} pending legs`);
      return false;
    }

    // Determine bet outcome
    const legOutcomes = bet.legs.map(leg => leg.status as BetOutcome);
    const betOutcome = this.determineBetOutcome(legOutcomes);

    // Calculate actual payout
    let actualPayout: Decimal;

    if (betOutcome === 'lost') {
      actualPayout = new Decimal(0);
    } else if (betOutcome === 'push') {
      actualPayout = bet.stake;
    } else if (betOutcome === 'won') {
      // Check if there were any pushes
      const pushCount = legOutcomes.filter(o => o === 'push').length;
      
      if (pushCount > 0 && bet.betType === 'parlay') {
        // Recalculate odds without push legs
        const winningLegs = bet.legs.filter(leg => leg.status === 'won');
        
        if (winningLegs.length === 0) {
          actualPayout = bet.stake; // All pushes
        } else if (winningLegs.length === 1) {
          // Reduced to single bet
          const odds = winningLegs[0].userAdjustedOdds || winningLegs[0].odds;
          actualPayout = new Decimal(calculatePayout(bet.stake.toNumber(), odds));
        } else {
          // Reduced parlay
          const legs = winningLegs.map(leg => ({
            odds: leg.userAdjustedOdds || leg.odds
          }));
          const decimalOdds = calculateParlayOdds(legs);
          const americanOdds = decimalToAmerican(decimalOdds);
          actualPayout = new Decimal(calculatePayout(bet.stake.toNumber(), americanOdds));
        }
      } else {
        actualPayout = bet.potentialPayout || bet.stake;
      }
    } else {
      actualPayout = bet.stake; // Shouldn't reach here
    }

    // Update bet
    await prisma.bet.update({
      where: { id: betId },
      data: {
        status: betOutcome,
        actualPayout,
        settledAt: new Date(),
        updatedAt: new Date()
      }
    });

    logger.info(`Settled bet ${betId}: ${betOutcome}, payout: ${actualPayout.toString()}`);

    return true;
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  /**
   * Find matching ESPN event by team names
   */
  private findMatchingEvent(
    events: EspnEvent[],
    homeTeam: string,
    awayTeam: string
  ): EspnEvent | null {
    for (const event of events) {
      if (event.competitions.length === 0) continue;

      const competition = event.competitions[0];
      const competitors = competition.competitors;

      if (competitors.length !== 2) continue;

      const homeCompetitor = competitors.find(c => c.homeAway === 'home');
      const awayCompetitor = competitors.find(c => c.homeAway === 'away');

      if (!homeCompetitor || !awayCompetitor) continue;

      // Match by team name (fuzzy match)
      const homeMatch = this.teamNamesMatch(homeTeam, homeCompetitor.team.displayName);
      const awayMatch = this.teamNamesMatch(awayTeam, awayCompetitor.team.displayName);

      if (homeMatch && awayMatch) {
        return event;
      }
    }

    return null;
  }

  /**
   * Check if team names match (fuzzy)
   */
  private teamNamesMatch(name1: string, name2: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const n1 = normalize(name1);
    const n2 = normalize(name2);

    // Exact match
    if (n1 === n2) return true;

    // Contains match
    if (n1.includes(n2) || n2.includes(n1)) return true;

    return false;
  }

  /**
   * Determine outcome for a single bet leg
   */
  private determineLegOutcome(leg: any, result: GameResult): BetOutcome {
    const totalScore = result.homeScore + result.awayScore;

    // Get effective line (prefer teaser, then user adjusted, then original)
    const effectiveLine = leg.teaserAdjustedLine
      ? leg.teaserAdjustedLine.toNumber()
      : leg.userAdjustedLine
      ? leg.userAdjustedLine.toNumber()
      : leg.line
      ? leg.line.toNumber()
      : undefined;

    // Determine outcome based on selection type
    if (leg.selectionType === 'moneyline') {
      return determineMoneylineOutcome(
        leg.selection,
        result.homeScore,
        result.awayScore
      );
    }

    if (leg.selectionType === 'spread') {
      if (effectiveLine === undefined) {
        throw new Error(`Spread leg ${leg.id} missing line`);
      }
      return determineSpreadOutcome(
        leg.selection,
        effectiveLine,
        result.homeScore,
        result.awayScore
      );
    }

    if (leg.selectionType === 'total') {
      if (effectiveLine === undefined) {
        throw new Error(`Total leg ${leg.id} missing line`);
      }
      return determineTotalOutcome(
        leg.selection,
        effectiveLine,
        totalScore
      );
    }

    throw new Error(`Unknown selection type: ${leg.selectionType}`);
  }

  /**
   * Determine bet outcome from leg outcomes
   */
  private determineBetOutcome(legOutcomes: BetOutcome[]): BetOutcome {
    const hasLoss = legOutcomes.some(o => o === 'lost');
    const allPush = legOutcomes.every(o => o === 'push');
    const allWonOrPush = legOutcomes.every(o => o === 'won' || o === 'push');

    if (hasLoss) {
      return 'lost';
    }

    if (allPush) {
      return 'push';
    }

    if (allWonOrPush) {
      return 'won';
    }

    // Shouldn't reach here
    logger.warn(`Unexpected leg outcome combination: ${legOutcomes.join(', ')}`);
    return 'lost';
  }
}

// Export singleton instance
export const outcomeResolverService = new OutcomeResolverService();
