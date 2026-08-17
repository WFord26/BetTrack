/**
 * Bet Validation
 *
 * Pre-placement rules: leg counts per bet type, teaser restrictions, that every
 * referenced game exists and has not started, and that the stake is positive.
 * Every failure throws, so `createBet` can treat a clean return as a green
 * light.
 */

import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { CreateBetInput } from '../../types/bet.types';

export class BetValidationService {
  /**
   * Validate bet creation data
   */
  async validateBetCreation(data: CreateBetInput): Promise<void> {
    // Calculate total legs (game + futures)
    const totalLegs = data.legs.length + (data.futureLegs?.length || 0);

    // Validate leg count
    if (totalLegs === 0) {
      throw new Error('Bet must have at least one leg (game or future)');
    }

    if (data.betType === 'single' && totalLegs !== 1) {
      throw new Error('Single bet must have exactly one leg');
    }

    if (data.betType !== 'single' && totalLegs < 2) {
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

    // Validate all games exist and haven't started (only if there are game legs)
    if (data.legs.length > 0) {
      await this.validateGames(data);
    }

    // Validate stake
    if (data.stake <= 0) {
      throw new Error('Stake must be positive');
    }
  }

  /**
   * Every referenced game must exist, and none may have started or finished.
   */
  private async validateGames(data: CreateBetInput): Promise<void> {
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
  }
}

export const betValidationService = new BetValidationService();
