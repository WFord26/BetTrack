/**
 * Bet response formatting
 *
 * The Prisma include shapes used by every bet read, the payload types derived
 * from them, and the pure mapping from a database row to the API response.
 */

import { Prisma } from '@prisma/client';
import {
  BetLegFutureResponse,
  BetLegResponse,
  BetResponse,
} from '../../types/bet.types';

// ---------------------------------------------------------------------------
// Prisma payload types for strongly-typed format helpers
// ---------------------------------------------------------------------------

export const betWithLegsInclude = {
  legs: {
    include: {
      game: {
        include: {
          sport: { select: { key: true, name: true } }
        }
      }
    }
  }
} as const;

export const betWithLegsAndFutureLegsInclude = {
  legs: {
    include: {
      game: {
        include: {
          sport: { select: { key: true, name: true } }
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
          sport: { select: { key: true } }
        }
      }
    }
  }
} as const;

export type BetWithLegs = Prisma.BetGetPayload<{ include: typeof betWithLegsInclude }>;
export type BetWithLegsAndFutureLegs = Prisma.BetGetPayload<{
  include: typeof betWithLegsAndFutureLegsInclude;
}>;
export type FormattableBet = BetWithLegs | BetWithLegsAndFutureLegs;

export type BetLegWithGame = FormattableBet['legs'][number];
export type BetLegFutureWithFuture = BetWithLegsAndFutureLegs['futureLegs'][number];

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/**
 * Format bet for response.
 * Prisma returns `string` for all @db.VarChar columns, so narrowing casts to
 * the union types defined in BetResponse are required here.  The values are
 * guaranteed valid by input validation at creation time.
 */
export function formatBet(bet: FormattableBet): BetResponse {
  const futureLegs = 'futureLegs' in bet ? bet.futureLegs : undefined;
  return {
    id: bet.id,
    name: bet.name,
    betType: bet.betType as BetResponse['betType'],
    stake: bet.stake,
    potentialPayout: bet.potentialPayout,
    actualPayout: bet.actualPayout,
    status: bet.status as BetResponse['status'],
    oddsAtPlacement: bet.oddsAtPlacement,
    teaserPoints: bet.teaserPoints,
    notes: bet.notes,
    placedAt: bet.placedAt,
    settledAt: bet.settledAt,
    legs: bet.legs.map((leg) => formatBetLeg(leg)),
    futureLegs: futureLegs ? futureLegs.map((leg) => formatBetLegFuture(leg)) : undefined
  };
}

/**
 * Format bet leg for response
 */
export function formatBetLeg(leg: BetLegWithGame): BetLegResponse {
  return {
    id: leg.id,
    selectionType: leg.selectionType as BetLegResponse['selectionType'],
    selection: leg.selection as BetLegResponse['selection'],
    teamName: leg.teamName,
    line: leg.line,
    odds: leg.odds,
    sgpGroupId: leg.sgpGroupId,
    userAdjustedLine: leg.userAdjustedLine,
    userAdjustedOdds: leg.userAdjustedOdds,
    teaserAdjustedLine: leg.teaserAdjustedLine,
    status: leg.status as BetLegResponse['status'],
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
export function formatBetLegFuture(leg: BetLegFutureWithFuture): BetLegFutureResponse {
  return {
    id: leg.id,
    outcome: leg.outcome,
    odds: leg.odds,
    userAdjustedOdds: leg.userAdjustedOdds,
    status: leg.status as BetLegFutureResponse['status'],
    future: {
      id: leg.future.id,
      title: leg.future.title,
      sportKey: leg.future.sport.key,
      season: leg.future.season
    }
  };
}
