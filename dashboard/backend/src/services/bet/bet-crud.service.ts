/**
 * Bet CRUD
 *
 * Create, read, update, cancel and settle. Validation lives in
 * `bet-validation.service`, pricing in `bet-odds.service`, and response shaping
 * in `bet-formatter`, so what remains here is the persistence and the
 * ownership/state rules around it.
 */

import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import {
  BetFilters,
  BetResponse,
  CreateBetInput,
  PaginatedBets,
  UpdateBetInput
} from '../../types/bet.types';
import { applyTeaserAdjustment, calculatePayout } from '../../utils/odds-calculator';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { betOddsService } from './bet-odds.service';
import { betValidationService } from './bet-validation.service';
import { betWithLegsAndFutureLegsInclude, betWithLegsInclude, formatBet } from './bet-formatter';

export class BetCrudService {
  /**
   * Create a new bet
   */
  async createBet(data: CreateBetInput, userId?: string): Promise<BetResponse> {
    logger.info(`Creating ${data.betType} bet: ${data.name}`);

    // Debug logging for boost
    if (data.boostedCombinedOdds) {
      logger.info(`Boost detected in request: ${data.boostedCombinedOdds}`);
    }

    // Validation
    await betValidationService.validateBetCreation(data);

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
      const { combinedOdds, potentialPayout } = await betOddsService.calculateBetOdds(data);

      // Create bet record
      const bet = await tx.bet.create({
        data: {
          userId: userId || null,
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
        // Always use original odds for the odds field, userAdjustedOdds for boosted/adjusted
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
            odds: legData.odds, // Always store original odds here
            userAdjustedLine: legData.userAdjustedLine ? new Decimal(legData.userAdjustedLine) : null,
            userAdjustedOdds: legData.userAdjustedOdds || null,
            teaserAdjustedLine,
            sgpGroupId: sgpGames.has(legData.gameId) ? legData.gameId : null,
            bookmaker: (legData as any).bookmaker || null,
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

      // Fetch complete bet within transaction context
      const completeBet = await tx.bet.findUnique({
        where: { id: bet.id },
        include: betWithLegsAndFutureLegsInclude
      });

      if (!completeBet) {
        throw new Error('Failed to retrieve created bet');
      }

      return formatBet(completeBet);
    });
  }

  /**
   * Get bets with filters
   */
  async getBets(filters: BetFilters = {}): Promise<PaginatedBets> {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    // Build where clause
    const where: Prisma.BetWhereInput = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }

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
      include: betWithLegsInclude,
      orderBy: { placedAt: 'desc' },
      take: limit,
      skip: offset
    });

    return {
      bets: bets.map((bet) => formatBet(bet)),
      total,
      limit,
      offset
    };
  }

  /**
   * Get bet by ID
   */
  async getBetById(id: string, userId?: string): Promise<BetResponse | null> {
    const bet = await prisma.bet.findFirst({
      where: {
        id,
        ...(userId ? { userId } : {}),
      },
      include: betWithLegsAndFutureLegsInclude
    });

    return bet ? formatBet(bet) : null;
  }

  /**
   * Update a bet
   */
  async updateBet(id: string, data: UpdateBetInput, userId?: string): Promise<BetResponse> {
    // Get existing bet (scoped by ownership when applicable)
    const existingBet = await prisma.bet.findFirst({
      where: {
        id,
        ...(userId ? { userId } : {}),
      },
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
    const updateData: Prisma.BetUpdateManyMutationInput = {};

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

    // SECURITY: Re-assert the ownership filter at update time so the WHERE
    // clause is atomic with the mutation (closes the TOCTOU between the
    // findFirst above and the update). updateMany with `count` lets us
    // detect — and fail loudly on — a concurrent ownership change.
    const updateResult = await prisma.bet.updateMany({
      where: {
        id,
        ...(userId ? { userId } : {}),
      },
      data: updateData,
    });

    if (updateResult.count === 0) {
      throw new Error('Bet not found');
    }

    logger.info(`Updated bet ${id}`);

    const updatedBet = await this.getBetById(id, userId);
    if (!updatedBet) {
      throw new Error('Bet not found after update');
    }
    return updatedBet;
  }

  /**
   * Cancel a bet
   */
  async cancelBet(id: string, force: boolean = false, userId?: string): Promise<void> {
    // Authorization model:
    //   - force=false → owner-only: scope by userId so a user can only cancel their own bets.
    //   - force=true  → admin override (the route gate verifies req.user.isAdmin
    //                    before calling with force). Admins must be able to delete
    //                    ANY user's bet, so we drop the userId filter here.
    const ownershipFilter = !force && userId ? { userId } : {};

    // Get bet with legs
    const bet = await prisma.bet.findFirst({
      where: {
        id,
        ...ownershipFilter,
      },
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
      where: { id: bet.id }
    });

    logger.info(`${force ? 'Force deleted' : 'Cancelled'} bet ${id}`);
  }

  /**
   * Manually settle a bet
   */
  async settleBet(
    id: string,
    status: 'won' | 'lost' | 'push',
    actualPayout?: number,
    userId?: string
  ): Promise<BetResponse> {
    const bet = await prisma.bet.findFirst({
      where: {
        id,
        ...(userId ? { userId } : {}),
      },
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

    const settledBet = await this.getBetById(id, userId);
    if (!settledBet) {
      throw new Error('Bet not found after settlement');
    }
    return settledBet;
  }
}

export const betCrudService = new BetCrudService();
