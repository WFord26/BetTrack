import { prisma } from '../config/database';
import { logger } from '../config/logger';
import {
  CreateBetInput,
  CreateFutureLegInput,
  UpdateBetInput,
  BetFilters,
  StatsFilters,
  BetResponse,
  BetLegResponse,
  BetLegFutureResponse,
  PaginatedBets,
  BetStats,
  BetStatus
} from '../types/bet.types';
import {
  calculateParlayOdds,
  calculatePayout,
  getTeaserOdds,
  applyTeaserAdjustment,
  decimalToAmerican
} from '../utils/odds-calculator';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Service for managing bets
 * 
 * Handles:
 * - Bet creation with validation
 * - Bet updates and cancellation
 * - Bet settlement
 * - Statistics and reporting
 */
export class BetService {
  /**
   * Create a new bet
   */
  async createBet(data: CreateBetInput): Promise<BetResponse> {
    logger.info(`Creating ${data.betType} bet: ${data.name}`);

    // Validation
    await this.validateBetCreation(data);

    // Detect Same Game Parlays (SGP) - multiple legs on same game
    const gameGroups = new Map<string, typeof data.legs>();
    data.legs.forEach((leg) => {
      const gameId = leg.gameId;
      if (!gameGroups.has(gameId)) {
        gameGroups.set(gameId, []);
      }
      gameGroups.get(gameId)!.push(leg);
    });

    // Identify which games have SGP (multiple legs)
    const sgpGames = new Set<string>();
    gameGroups.forEach((legs, gameId) => {
      if (legs.length > 1) {
        sgpGames.add(gameId);
        logger.info(`SGP detected on game ${gameId}: ${legs.length} legs`);
      }
    });

    // Start transaction
    return await prisma.$transaction(async (tx) => {
      // Calculate odds and payout
      const { combinedOdds, potentialPayout } = this.calculateBetOdds(data);

      // Create bet record
      const bet = await tx.bet.create({
        data: {
          name: data.name,
          betType: data.betType,
          stake: new Decimal(data.stake),
          potentialPayout: new Decimal(potentialPayout),
          status: 'pending',
          oddsAtPlacement: combinedOdds,
          teaserPoints: data.teaserPoints ? new Decimal(data.teaserPoints) : null,
          notes: data.notes || null
        }
      });

      // Create bet legs with SGP group IDs
      for (const legData of data.legs) {
        const effectiveOdds = legData.userAdjustedOdds || legData.odds;
        const effectiveLine = legData.userAdjustedLine ?? legData.line;

        let teaserAdjustedLine: Decimal | null = null;
        if (data.betType === 'teaser' && data.teaserPoints && effectiveLine !== undefined) {
          const adjusted = applyTeaserAdjustment(
            effectiveLine,
            data.teaserPoints,
            legData.selection
          );
          teaserAdjustedLine = new Decimal(adjusted);
        }

        await tx.betLeg.create({
          data: {
            betId: bet.id,
            gameId: legData.gameId,
            selectionType: legData.selectionType,
            selection: legData.selection,
            teamName: legData.teamName || null,
            line: effectiveLine !== undefined ? new Decimal(effectiveLine) : null,
            odds: effectiveOdds,
            userAdjustedLine: legData.userAdjustedLine ? new Decimal(legData.userAdjustedLine) : null,
            userAdjustedOdds: legData.userAdjustedOdds || null,
            teaserAdjustedLine,
            sgpGroupId: sgpGames.has(legData.gameId) ? legData.gameId : null,
            status: 'pending'
          }
        });
      }

      // Create futures legs if present
      if (data.futureLegs && data.futureLegs.length > 0) {
        logger.info(`Creating ${data.futureLegs.length} futures legs for bet ${bet.id}`);
        for (const futureLeg of data.futureLegs) {
          const effectiveOdds = futureLeg.userAdjustedOdds || futureLeg.odds;
          
          await tx.betLegFuture.create({
            data: {
              betId: bet.id,
              futureId: futureLeg.futureId,
              outcome: futureLeg.outcome,
              odds: effectiveOdds,
              userAdjustedOdds: futureLeg.userAdjustedOdds || null,
              status: 'pending'
            }
          });
        }
      }

      const totalLegs = data.legs.length + (data.futureLegs?.length || 0);
      logger.info(`Created bet ${bet.id} with ${totalLegs} total legs (${data.legs.length} game legs, ${data.futureLegs?.length || 0} futures)${sgpGames.size > 0 ? ` (${sgpGames.size} SGP games)` : ''}`);

      // Fetch and return complete bet
      return this.getBetById(bet.id) as Promise<BetResponse>;
    });
  }

  /**
   * Get bets with filters
   */
  async getBets(filters: BetFilters = {}): Promise<PaginatedBets> {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    // Build where clause
    const where: any = {};

    if (filters.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }

    if (filters.betType) {
      where.betType = filters.betType;
    }

    if (filters.startDate || filters.endDate) {
      where.placedAt = {};
      if (filters.startDate) {
        where.placedAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.placedAt.lte = filters.endDate;
      }
    }

    // Add sport filter through legs
    if (filters.sportKey) {
      where.legs = {
        some: {
          game: {
            sport: {
              key: filters.sportKey
            }
          }
        }
      };
    }

    // Get total count
    const total = await prisma.bet.count({ where });

    // Get bets
    const bets = await prisma.bet.findMany({
      where,
      include: {
        legs: {
          include: {
            game: {
              include: {
                sport: {
                  select: { key: true, name: true }
                }
              }
            }
          }
        }
      },
      orderBy: { placedAt: 'desc' },
      take: limit,
      skip: offset
    });

    return {
      bets: bets.map((bet) => this.formatBet(bet)),
      total,
      limit,
      offset
    };
  }

  /**
   * Get bet by ID
   */
  async getBetById(id: string): Promise<BetResponse | null> {
    const bet = await prisma.bet.findUnique({
      where: { id },
      include: {
        legs: {
          include: {
            game: {
              include: {
                sport: {
                  select: { key: true, name: true }
                }
              }
            }
          }
        },
        futureLegs: {
          include: {
            future: {
              select: {
                id: true,
                title: true,
                season: true,
                sport: {
                  select: {
                    key: true
                  }
                }
              }
            }
          }
        }
      }
    });

    return bet ? this.formatBet(bet) : null;
  }

  /**
   * Update a bet
   */
  async updateBet(id: string, data: UpdateBetInput): Promise<BetResponse> {
    // Get existing bet
    const existingBet = await prisma.bet.findUnique({
      where: { id },
      include: {
        legs: {
          include: {
            game: true
          }
        }
      }
    });

    if (!existingBet) {
      throw new Error('Bet not found');
    }

    // Validate can update
    if (existingBet.status !== 'pending') {
      throw new Error('Cannot update settled bet');
    }

    // Check if any games have started
    const now = new Date();
    const anyStarted = existingBet.legs.some(
      leg => leg.game.commenceTime <= now
    );

    if (anyStarted) {
      throw new Error('Cannot update bet after games have started');
    }

    // Prepare update data
    const updateData: any = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    // Recalculate payout if stake changed
    if (data.stake !== undefined) {
      updateData.stake = new Decimal(data.stake);
      
      if (existingBet.oddsAtPlacement) {
        const newPayout = calculatePayout(data.stake, existingBet.oddsAtPlacement);
        updateData.potentialPayout = new Decimal(newPayout);
      }
    }

    // Update bet
    await prisma.bet.update({
      where: { id },
      data: updateData
    });

    logger.info(`Updated bet ${id}`);

    return this.getBetById(id) as Promise<BetResponse>;
  }

  /**
   * Cancel a bet
   */
  async cancelBet(id: string, force: boolean = false): Promise<void> {
    // Get bet with legs
    const bet = await prisma.bet.findUnique({
      where: { id },
      include: {
        legs: {
          include: {
            game: true
          }
        }
      }
    });

    if (!bet) {
      throw new Error('Bet not found');
    }

    // If not force delete, validate constraints
    if (!force) {
      // Validate can cancel
      if (bet.status !== 'pending') {
        throw new Error('Cannot cancel settled bet');
      }

      // Check if any games have started
      const now = new Date();
      const anyStarted = bet.legs.some(
        leg => leg.game.commenceTime <= now
      );

      if (anyStarted) {
        throw new Error('Cannot cancel bet after games have started');
      }
    }

    // Delete bet (legs will cascade)
    await prisma.bet.delete({
      where: { id }
    });

    logger.info(`${force ? 'Force deleted' : 'Cancelled'} bet ${id}`);
  }

  /**
   * Manually settle a bet
   */
  async settleBet(
    id: string,
    status: 'won' | 'lost' | 'push',
    actualPayout?: number
  ): Promise<BetResponse> {
    const bet = await prisma.bet.findUnique({
      where: { id },
      select: { status: true, stake: true, potentialPayout: true }
    });

    if (!bet) {
      throw new Error('Bet not found');
    }

    if (bet.status !== 'pending') {
      throw new Error('Bet already settled');
    }

    // Calculate actual payout
    let payout: Decimal;
    if (actualPayout !== undefined) {
      payout = new Decimal(actualPayout);
    } else if (status === 'won') {
      payout = bet.potentialPayout || bet.stake;
    } else if (status === 'push') {
      payout = bet.stake;
    } else {
      payout = new Decimal(0);
    }

    // Update bet
    await prisma.bet.update({
      where: { id },
      data: {
        status,
        actualPayout: payout,
        settledAt: new Date()
      }
    });

    logger.info(`Settled bet ${id}: ${status}`);

    return this.getBetById(id) as Promise<BetResponse>;
  }

  /**
   * Get betting statistics
   */
  async getStats(filters: StatsFilters = {}): Promise<BetStats> {
    // Build where clause
    const where: any = {};

    if (filters.betType) {
      where.betType = filters.betType;
    }

    if (filters.startDate || filters.endDate) {
      where.placedAt = {};
      if (filters.startDate) {
        where.placedAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.placedAt.lte = filters.endDate;
      }
    }

    if (filters.sportKey) {
      where.legs = {
        some: {
          game: {
            sport: {
              key: filters.sportKey
            }
          }
        }
      };
    }

    // Get all bets
    const bets = await prisma.bet.findMany({
      where,
      include: {
        legs: {
          include: {
            game: {
              include: {
                sport: true
              }
            }
          }
        }
      }
    });

    // Calculate stats
    const stats: BetStats = {
      totalBets: bets.length,
      wonBets: 0,
      lostBets: 0,
      pushBets: 0,
      pendingBets: 0,
      winRate: 0,
      totalStaked: 0,
      totalPayout: 0,
      netProfit: 0,
      roi: 0,
      byBetType: {},
      bySport: {}
    };

    // Process each bet
    for (const bet of bets) {
      const stake = bet.stake.toNumber();
      const payout = bet.actualPayout?.toNumber() || 0;

      stats.totalStaked += stake;
      stats.totalPayout += payout;

      // Count by status
      if (bet.status === 'won') stats.wonBets++;
      else if (bet.status === 'lost') stats.lostBets++;
      else if (bet.status === 'push') stats.pushBets++;
      else if (bet.status === 'pending') stats.pendingBets++;

      // By bet type
      if (!stats.byBetType[bet.betType]) {
        stats.byBetType[bet.betType] = { count: 0, won: 0, netProfit: 0 };
      }
      stats.byBetType[bet.betType]!.count++;
      if (bet.status === 'won') stats.byBetType[bet.betType]!.won++;
      stats.byBetType[bet.betType]!.netProfit += (payout - stake);

      // By sport (use first leg's sport)
      if (bet.legs.length > 0) {
        const sportKey = bet.legs[0].game.sport.key;
        if (!stats.bySport[sportKey]) {
          stats.bySport[sportKey] = { count: 0, won: 0, netProfit: 0 };
        }
        stats.bySport[sportKey].count++;
        if (bet.status === 'won') stats.bySport[sportKey].won++;
        stats.bySport[sportKey].netProfit += (payout - stake);
      }
    }

    // Calculate rates
    stats.netProfit = stats.totalPayout - stats.totalStaked;
    
    const settledBets = stats.wonBets + stats.lostBets + stats.pushBets;
    if (settledBets > 0) {
      stats.winRate = (stats.wonBets / settledBets) * 100;
    }

    if (stats.totalStaked > 0) {
      stats.roi = (stats.netProfit / stats.totalStaked) * 100;
    }

    return stats;
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  /**
   * Validate bet creation data
   */
  private async validateBetCreation(data: CreateBetInput): Promise<void> {
    // Validate leg count
    if (data.legs.length === 0) {
      throw new Error('Bet must have at least one leg');
    }

    if (data.betType === 'single' && data.legs.length !== 1) {
      throw new Error('Single bet must have exactly one leg');
    }

    if (data.betType !== 'single' && data.legs.length < 2) {
      throw new Error('Parlay/teaser must have at least 2 legs');
    }

    // Validate teaser
    if (data.betType === 'teaser') {
      if (!data.teaserPoints) {
        throw new Error('Teaser must specify points');
      }

      // Teasers only work with spreads and totals
      const invalidLegs = data.legs.filter(
        leg => leg.selectionType === 'moneyline'
      );
      if (invalidLegs.length > 0) {
        throw new Error('Teaser cannot include moneyline selections');
      }
    }

    // Validate all games exist and haven't started
    const gameIds = data.legs.map(leg => leg.gameId);
    const uniqueGameIds = [...new Set(gameIds)]; // Deduplicate for validation
    logger.info(`Validating game IDs: ${JSON.stringify(gameIds)}`);
    
    const games = await prisma.game.findMany({
      where: { id: { in: uniqueGameIds } },
      select: { 
        id: true, 
        commenceTime: true,
        status: true,
        homeTeamName: true,
        awayTeamName: true
      }
    });

    logger.info(`Found ${games.length} games out of ${uniqueGameIds.length} unique games requested`);
    logger.info(`Found game IDs: ${JSON.stringify(games.map(g => g.id))}`);
    
    if (games.length !== uniqueGameIds.length) {
      const foundIds = games.map(g => g.id);
      const missingIds = uniqueGameIds.filter(id => !foundIds.includes(id));
      logger.error(`Missing game IDs: ${JSON.stringify(missingIds)}`);
      throw new Error('One or more games not found');
    }

    // Block betting on completed or in-progress games, but allow future games
    const invalidGames = games.filter(game => 
      game.status === 'final' || game.status === 'in_progress'
    );
    if (invalidGames.length > 0) {
      const statuses = invalidGames.map(g => `${g.homeTeamName} vs ${g.awayTeamName} (${g.status})`).join(', ');
      throw new Error(`Cannot bet on games that have started or finished: ${statuses}`);
    }

    // Validate stake
    if (data.stake <= 0) {
      throw new Error('Stake must be positive');
    }
  }

  /**
   * Calculate combined odds and payout
   */
  private calculateBetOdds(data: CreateBetInput): {
    combinedOdds: number;
    potentialPayout: number;
  } {
    const totalLegs = data.legs.length + (data.futureLegs?.length || 0);
    
    if (data.betType === 'single') {
      if (totalLegs !== 1) {
        throw new Error('Single bet must have exactly one leg');
      }
      
      // Check if it's a game leg or futures leg
      if (data.legs.length === 1) {
        const leg = data.legs[0];
        const odds = leg.userAdjustedOdds || leg.odds;
        const payout = calculatePayout(data.stake, odds);
        return { combinedOdds: odds, potentialPayout: payout };
      } else {
        // Single futures leg
        const futureLeg = data.futureLegs![0];
        const odds = futureLeg.userAdjustedOdds || futureLeg.odds;
        const payout = calculatePayout(data.stake, odds);
        return { combinedOdds: odds, potentialPayout: payout };
      }
    }

    if (data.betType === 'parlay') {
      // Group legs by gameId to detect SGP
      const gameGroups = new Map<string, typeof data.legs>();
      data.legs.forEach((leg) => {
        if (!gameGroups.has(leg.gameId)) {
          gameGroups.set(leg.gameId, []);
        }
        gameGroups.get(leg.gameId)!.push(leg);
      });

      // Build effective odds array (multiply all legs within SGP groups)
      const effectiveOdds: number[] = [];
      
      // Add game leg odds
      gameGroups.forEach((legs) => {
        if (legs.length > 1) {
          // SGP: Add all legs' odds to multiply them
          legs.forEach((leg) => effectiveOdds.push(leg.userAdjustedOdds || leg.odds));
        } else {
          // Regular: Single leg on this game
          effectiveOdds.push(legs[0].userAdjustedOdds || legs[0].odds);
        }
      });
      
      // Add futures leg odds
      if (data.futureLegs && data.futureLegs.length > 0) {
        data.futureLegs.forEach((futureLeg) => {
          effectiveOdds.push(futureLeg.userAdjustedOdds || futureLeg.odds);
        });
      }

      // Calculate parlay odds using effective odds
      const legsForCalc = effectiveOdds.map(odds => ({ odds }));
      const decimalOdds = calculateParlayOdds(legsForCalc);
      const americanOdds = decimalToAmerican(decimalOdds);
      const payout = calculatePayout(data.stake, americanOdds);
      return { combinedOdds: americanOdds, potentialPayout: payout };
    }

    if (data.betType === 'teaser' && data.teaserPoints) {
      // Get teaser odds from lookup table
      const firstLegSport = 'nfl'; // TODO: Get from game's sport
      const teaserOdds = getTeaserOdds(
        data.legs.length,
        data.teaserPoints,
        firstLegSport
      );

      if (!teaserOdds) {
        throw new Error('Invalid teaser configuration');
      }

      const payout = calculatePayout(data.stake, teaserOdds);
      return { combinedOdds: teaserOdds, potentialPayout: payout };
    }

    throw new Error('Invalid bet type');
  }

  /**
   * Format bet for response
   */
  private formatBet(bet: any): BetResponse {
    return {
      id: bet.id,
      name: bet.name,
      betType: bet.betType,
      stake: bet.stake,
      potentialPayout: bet.potentialPayout,
      actualPayout: bet.actualPayout,
      status: bet.status,
      oddsAtPlacement: bet.oddsAtPlacement,
      teaserPoints: bet.teaserPoints,
      notes: bet.notes,
      placedAt: bet.placedAt,
      settledAt: bet.settledAt,
      legs: bet.legs.map((leg: any) => this.formatBetLeg(leg)),
      futureLegs: bet.futureLegs ? bet.futureLegs.map((leg: any) => this.formatBetLegFuture(leg)) : undefined
    };
  }

  /**
   * Format bet leg for response
   */
  private formatBetLeg(leg: any): BetLegResponse {
    return {
      id: leg.id,
      selectionType: leg.selectionType,
      selection: leg.selection,
      teamName: leg.teamName,
      line: leg.line,
      odds: leg.odds,
      sgpGroupId: leg.sgpGroupId,
      userAdjustedLine: leg.userAdjustedLine,
      userAdjustedOdds: leg.userAdjustedOdds,
      teaserAdjustedLine: leg.teaserAdjustedLine,
      status: leg.status,
      game: {
        id: leg.game.id,
        externalId: leg.game.externalId,
        homeTeamName: leg.game.homeTeamName,
        awayTeamName: leg.game.awayTeamName,
        commenceTime: leg.game.commenceTime,
        status: leg.game.status,
        homeScore: leg.game.homeScore,
        awayScore: leg.game.awayScore,
        sport: {
          key: leg.game.sport.key,
          name: leg.game.sport.name
        }
      }
    };
  }

  /**
   * Format bet leg future for response
   */
  private formatBetLegFuture(leg: any): BetLegFutureResponse {
    return {
      id: leg.id,
      outcome: leg.outcome,
      odds: leg.odds,
      userAdjustedOdds: leg.userAdjustedOdds,
      status: leg.status,
      future: {
        id: leg.future.id,
        title: leg.future.title,
        sportKey: leg.future.sport.key,
        season: leg.future.season
      }
    };
  }
}

// Export singleton instance
export const betService = new BetService();
