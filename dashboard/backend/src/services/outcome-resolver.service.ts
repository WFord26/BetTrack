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
import { Prisma } from '@prisma/client';

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
  /** Maximum age of a game (in hours) to consider for outcome resolution */
  private static readonly OUTCOME_LOOKBACK_HOURS = 12;

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
      const twelveHoursAgo = new Date(now.getTime() - OutcomeResolverService.OUTCOME_LOOKBACK_HOURS * 60 * 60 * 1000);

      const games = await prisma.game.findMany({
        where: {
          status: {
            in: ['scheduled', 'in_progress']
          },
          commenceTime: {
            lt: now,
            gt: twelveHoursAgo // Don't check games older than 12 hours
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

      // Recovery sweep: pick up bets whose legs are all settled but the
      // parent bet is still pending — typically because a previous run
      // crashed between settling legs and finalizing the bet.
      try {
        const recovered = await this.settleStuckBets();
        result.betsSettled += recovered;
        if (recovered > 0) {
          logger.info(`Recovery sweep finalized ${recovered} previously-stuck bet(s)`);
        }
      } catch (error) {
        const errorMsg = `Recovery sweep failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(errorMsg);
        result.errors.push(errorMsg);
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
   * Recovery sweep: finalize any pending bets where every leg is already
   * settled. Catches bets that were left in limbo by a crash between
   * leg-update and bet-finalize in a previous run.
   */
  async settleStuckBets(): Promise<number> {
    const stuckBets = await prisma.bet.findMany({
      where: {
        status: 'pending',
        legs: {
          // No legs still pending → all legs have been resolved.
          none: { status: 'pending' },
        },
      },
      select: { id: true },
    });

    let settled = 0;
    for (const bet of stuckBets) {
      try {
        if (await this.checkAndSettleBet(bet.id)) settled++;
      } catch (error) {
        logger.error(
          `Recovery sweep failed to settle bet ${bet.id}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
    return settled;
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
      // Validate commenceTime exists
      if (!game.commenceTime) {
        logger.warn(`Game ${game.id} has no commenceTime, cannot check result`);
        return null;
      }

      // Format game date for ESPN API (YYYYMMDD)
      const gameDate = new Date(game.commenceTime);
      
      // Check if date is valid
      if (isNaN(gameDate.getTime())) {
        logger.error(`Invalid commenceTime for game ${game.id}: ${game.commenceTime}`);
        return null;
      }
      
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

      // Extract period and clock information from competition status
      const period = competition.status.period != null ? `${competition.status.period}` : null;
      const clock = competition.status.displayClock ?? null;

      // Extract baseball-specific game state
      const sportKey = game.sport?.key || '';
      let baseballData: any = {};
      
      if (sportKey === 'baseball_mlb') {
        baseballData = {
          inningHalf: competition.status.inningHalf ?? null,
          balls: competition.status.balls ?? null,
          strikes: competition.status.strikes ?? null,
          outs: competition.status.outs ?? null
        };
      }

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
              ...baseballData,
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
              ...baseballData,
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
   * Settle all bet legs for a game.
   *
   * Per bet, the leg updates AND the parent bet finalization happen in a
   * single $transaction so a crash mid-flight can never leave a bet
   * `pending` with all its legs already settled. The recovery sweep in
   * `settleStuckBets` is a defence-in-depth backstop.
   */
  async settleBetLegs(
    gameId: string,
    result: GameResult
  ): Promise<{ legsSettled: number; betsSettled: number }> {
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

    // Group legs by bet so we can settle each bet's legs together.
    const legsByBet = new Map<string, typeof legs>();
    for (const leg of legs) {
      const existing = legsByBet.get(leg.betId);
      if (existing) {
        existing.push(leg);
      } else {
        legsByBet.set(leg.betId, [leg]);
      }
    }

    let totalLegsSettled = 0;
    let totalBetsSettled = 0;

    for (const [betId, betLegs] of legsByBet.entries()) {
      // Pre-compute outcomes outside the transaction so determineLegOutcome
      // throwing for a malformed leg only fails *that* bet, not the whole game.
      const legOutcomes: Array<{ id: string; outcome: BetOutcome }> = [];
      try {
        for (const leg of betLegs) {
          legOutcomes.push({
            id: leg.id,
            outcome: this.determineLegOutcome(leg, result),
          });
        }
      } catch (error) {
        logger.error(
          `Failed to determine outcomes for bet ${betId}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
        );
        continue;
      }

      try {
        const settled = await prisma.$transaction(async (tx) => {
          const now = new Date();
          for (const { id, outcome } of legOutcomes) {
            await tx.betLeg.update({
              where: { id },
              data: { status: outcome, updatedAt: now },
            });
          }
          return this.finalizeBetTx(tx, betId);
        });

        totalLegsSettled += legOutcomes.length;
        if (settled) totalBetsSettled++;
      } catch (error) {
        logger.error(
          `Failed to settle bet ${betId} for game ${gameId}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return {
      legsSettled: totalLegsSettled,
      betsSettled: totalBetsSettled,
    };
  }

  /**
   * Check if a bet can be settled and finalize it.
   *
   * Wraps `finalizeBetTx` in its own transaction so call-sites that aren't
   * already inside one (e.g. the recovery sweep, manual API triggers)
   * still get atomic behavior.
   */
  async checkAndSettleBet(betId: string): Promise<boolean> {
    return prisma.$transaction((tx) => this.finalizeBetTx(tx, betId));
  }

  /**
   * Inner finalization routine — runs inside a Prisma transaction client.
   * Returns true if the bet was finalized, false if it wasn't ready
   * (already settled, missing, or still has pending legs).
   */
  private async finalizeBetTx(
    tx: Prisma.TransactionClient,
    betId: string
  ): Promise<boolean> {
    const bet = await tx.bet.findUnique({
      where: { id: betId },
      include: { legs: true },
    });

    if (!bet) {
      logger.warn(`Bet ${betId} not found`);
      return false;
    }

    if (bet.status !== 'pending') {
      return false;
    }

    const pendingLegs = bet.legs.filter((leg) => leg.status === 'pending');
    if (pendingLegs.length > 0) {
      logger.debug(`Bet ${betId} still has ${pendingLegs.length} pending legs`);
      return false;
    }

    const legOutcomes = bet.legs.map((leg) => leg.status as BetOutcome);
    const betOutcome = this.determineBetOutcome(legOutcomes);

    let actualPayout: Decimal;

    if (betOutcome === 'lost') {
      actualPayout = new Decimal(0);
    } else if (betOutcome === 'push') {
      actualPayout = bet.stake;
    } else if (betOutcome === 'won') {
      const pushCount = legOutcomes.filter((o) => o === 'push').length;

      if (pushCount > 0 && bet.betType === 'parlay') {
        const winningLegs = bet.legs.filter((leg) => leg.status === 'won');

        if (winningLegs.length === 0) {
          actualPayout = bet.stake; // All pushes
        } else if (winningLegs.length === 1) {
          const odds = winningLegs[0].userAdjustedOdds || winningLegs[0].odds;
          actualPayout = new Decimal(calculatePayout(bet.stake.toNumber(), odds));
        } else {
          const legs = winningLegs.map((leg) => ({
            odds: leg.userAdjustedOdds || leg.odds,
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

    const now = new Date();
    await tx.bet.update({
      where: { id: betId },
      data: {
        status: betOutcome,
        actualPayout,
        settledAt: now,
        updatedAt: now,
      },
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
   * Check if team names refer to the same team.
   *
   * The previous implementation accepted any substring overlap, which
   * matched cases like:
   *   - "Giants" → "San Francisco Giants" AND "New York Giants"
   *   - "Eagles" → "Philadelphia Eagles" AND "Boston College Eagles"
   * — i.e. the mascot alone collided across teams in the same sport on
   * the same date (think MLB doubleheader days).
   *
   * Tighter rules:
   *   1. Exact normalized equality.
   *   2. One side fully contains the OTHER, and the contained side has
   *      at least two normalized tokens (so a market name → official name
   *      shorthand still works, e.g. "NY Giants" ⊂ "New York Giants",
   *      but bare mascot tokens are rejected).
   *   3. Last-token (mascot) match AS A FALLBACK only when both names
   *      share at least one *non-mascot* token (e.g. city/state) so we
   *      don't collapse two different "Eagles" teams.
   */
  private teamNamesMatch(name1: string, name2: string): boolean {
    const tokenize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);

    const t1 = tokenize(name1);
    const t2 = tokenize(name2);
    if (t1.length === 0 || t2.length === 0) return false;

    const norm1 = t1.join('');
    const norm2 = t2.join('');

    // 1. Exact normalized match.
    if (norm1 === norm2) return true;

    // 2. Containment, but only if the contained name has 2+ tokens.
    if (t1.length >= 2 && norm2.includes(norm1)) return true;
    if (t2.length >= 2 && norm1.includes(norm2)) return true;

    // 3. Mascot match with shared non-mascot token.
    const mascot1 = t1[t1.length - 1];
    const mascot2 = t2[t2.length - 1];
    if (mascot1 === mascot2) {
      const set1 = new Set(t1.slice(0, -1));
      const sharedNonMascot = t2.slice(0, -1).some((token) => set1.has(token));
      if (sharedNonMascot) return true;
    }

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
