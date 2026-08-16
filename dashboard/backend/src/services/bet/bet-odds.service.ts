/**
 * Bet Odds
 *
 * Turns a create-bet request into the two numbers stored on the bet row:
 * `oddsAtPlacement` (always the original, un-boosted combined price) and
 * `potentialPayout` (which does honour a boost when one was supplied).
 */

import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { CreateBetInput } from '../../types/bet.types';
import {
  calculateParlayOdds,
  calculatePayout,
  decimalToAmerican,
  getTeaserOdds
} from '../../utils/odds-calculator';
import type { Sport } from '../../types/betting.types';

export interface BetOdds {
  combinedOdds: number;
  potentialPayout: number;
}

export class BetOddsService {
  /**
   * Calculate combined odds and payout
   */
  async calculateBetOdds(data: CreateBetInput): Promise<BetOdds> {
    const totalLegs = data.legs.length + (data.futureLegs?.length || 0);

    if (data.betType === 'single') {
      if (totalLegs !== 1) {
        throw new Error('Single bet must have exactly one leg');
      }

      // Check if it's a game leg or futures leg
      if (data.legs.length === 1) {
        const leg = data.legs[0];
        const odds = leg.odds;
        const payout = calculatePayout(data.stake, odds);
        return { combinedOdds: odds, potentialPayout: payout };
      } else {
        // Single futures leg
        const futureLeg = data.futureLegs![0];
        const odds = futureLeg.odds;
        const payout = calculatePayout(data.stake, odds);
        return { combinedOdds: odds, potentialPayout: payout };
      }
    }

    if (data.betType === 'parlay') {
      return this.calculateParlayPricing(data);
    }

    if (data.betType === 'teaser' && data.teaserPoints) {
      return this.calculateTeaserPricing(data);
    }

    throw new Error('Invalid bet type');
  }

  private calculateParlayPricing(data: CreateBetInput): BetOdds {
    // Group legs by gameId to detect SGP
    const gameGroups = new Map<string, typeof data.legs>();
    data.legs.forEach((leg) => {
      if (!gameGroups.has(leg.gameId)) {
        gameGroups.set(leg.gameId, []);
      }
      gameGroups.get(leg.gameId)!.push(leg);
    });

    // Build original odds array for oddsAtPlacement
    const originalOdds: number[] = [];

    // Add game leg odds
    gameGroups.forEach((legs) => {
      legs.forEach((leg) => {
        originalOdds.push(leg.odds); // Always original for oddsAtPlacement
      });
    });

    // Add futures leg odds
    if (data.futureLegs && data.futureLegs.length > 0) {
      data.futureLegs.forEach((futureLeg) => {
        originalOdds.push(futureLeg.odds);
      });
    }

    // Calculate parlay odds - use ORIGINAL odds for oddsAtPlacement
    const legsForOriginalCalc = originalOdds.map(odds => ({ odds }));
    const originalDecimalOdds = calculateParlayOdds(legsForOriginalCalc);
    const originalAmericanOdds = decimalToAmerican(originalDecimalOdds);

    // Calculate payout
    let payout: number;
    if (data.boostedCombinedOdds) {
      // Use boosted combined odds for payout calculation
      payout = calculatePayout(data.stake, data.boostedCombinedOdds);
      logger.info(`Parlay boost applied: ${originalAmericanOdds} → ${data.boostedCombinedOdds}`);
    } else {
      // Use original combined odds for payout
      payout = calculatePayout(data.stake, originalAmericanOdds);
    }

    return { combinedOdds: originalAmericanOdds, potentialPayout: payout };
  }

  private async calculateTeaserPricing(data: CreateBetInput): Promise<BetOdds> {
    // Get teaser odds from lookup table
    // Resolve sport from first leg's game record
    let firstLegSport = 'nfl'; // Default fallback
    if (data.legs.length > 0) {
      try {
        const firstLegGame = await prisma.game.findUnique({
          where: { id: data.legs[0].gameId },
          select: { sport: { select: { key: true } } }
        });
        if (firstLegGame?.sport?.key) {
          // Extract sport key (e.g., 'nfl' from 'americanfootball_nfl')
          const sportKey = firstLegGame.sport.key.split('_').pop() || 'nfl';
          firstLegSport = sportKey;
        }
      } catch (error) {
        logger.warn('Failed to resolve teaser sport, defaulting to nfl');
      }
    }

    const teaserOdds = getTeaserOdds(
      data.legs.length,
      data.teaserPoints!,
      firstLegSport as Sport
    );

    if (!teaserOdds) {
      throw new Error('Invalid teaser configuration');
    }

    const payout = calculatePayout(data.stake, teaserOdds);
    return { combinedOdds: teaserOdds, potentialPayout: payout };
  }
}

export const betOddsService = new BetOddsService();
