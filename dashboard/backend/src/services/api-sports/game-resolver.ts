import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

/** Games created from The Odds API and games synced from API-Sports must be
 * reconciled onto the same row: Game.externalId holds The Odds API's event
 * id, so matching an API-Sports game requires team names + kickoff time
 * rather than a shared id. Upserting directly on the API-Sports id (as
 * opposed to matching first) creates a duplicate row disconnected from any
 * tracked bets/odds. */
const MATCH_WINDOW_MS = 12 * 60 * 60 * 1000;

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Check if two team names refer to the same team. Mirrors
 * OutcomeResolverService.teamNamesMatch (ESPN reconciliation) so the two
 * places in the codebase that match external team names to internal Team
 * rows use the same rules.
 */
export function teamNamesMatch(name1: string, name2: string): boolean {
  const t1 = tokenize(name1);
  const t2 = tokenize(name2);
  if (t1.length === 0 || t2.length === 0) return false;

  const norm1 = t1.join('');
  const norm2 = t2.join('');

  if (norm1 === norm2) return true;
  if (t1.length >= 2 && norm2.includes(norm1)) return true;
  if (t2.length >= 2 && norm1.includes(norm2)) return true;

  const mascot1 = t1[t1.length - 1];
  const mascot2 = t2[t2.length - 1];
  if (mascot1 === mascot2) {
    const set1 = new Set(t1.slice(0, -1));
    const sharedNonMascot = t2.slice(0, -1).some(token => set1.has(token));
    if (sharedNonMascot) return true;
  }

  return false;
}

export async function resolveApiSportsTeam(apiTeam: { id: number; name: string }, sportKey: string) {
  const byApiId = await prisma.team.findFirst({
    where: { apiSportsTeamId: apiTeam.id, sport: { key: sportKey } },
  });
  if (byApiId) return byApiId;

  return prisma.team.findFirst({
    where: {
      name: { contains: apiTeam.name, mode: 'insensitive' },
      sport: { key: sportKey },
    },
  });
}

export interface ApiSportsGameUpsertInput {
  sportKey: string;
  apiSportsGameId: string;
  apiSportsLeagueId: number;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId?: number;
  awayTeamId?: number;
  commenceTime: Date;
  season: string;
  seasonType?: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
}

/**
 * Resolve an API-Sports game to the existing odds-sourced Game row (matched
 * by sport + team names + a 12h kickoff-time window), updating it in place.
 * Falls back to a standalone row keyed by the API-Sports id when no
 * odds-sourced game exists for that matchup (e.g. no market was tracked).
 */
export async function upsertApiSportsGame(input: ApiSportsGameUpsertInput): Promise<string | null> {
  const sport = await prisma.sport.findUnique({ where: { key: input.sportKey } });
  if (!sport) {
    logger.warn(`Sport "${input.sportKey}" not found while upserting API-Sports game`);
    return null;
  }

  const windowStart = new Date(input.commenceTime.getTime() - MATCH_WINDOW_MS);
  const windowEnd = new Date(input.commenceTime.getTime() + MATCH_WINDOW_MS);

  const candidates = await prisma.game.findMany({
    where: {
      sportId: sport.id,
      commenceTime: { gte: windowStart, lte: windowEnd },
    },
  });

  const existing = candidates.find(
    g =>
      teamNamesMatch(g.homeTeamName, input.homeTeamName) &&
      teamNamesMatch(g.awayTeamName, input.awayTeamName)
  );

  const sharedData = {
    homeTeamId: input.homeTeamId,
    awayTeamId: input.awayTeamId,
    apiSportsGameId: input.apiSportsGameId,
    apiSportsLeagueId: input.apiSportsLeagueId,
    season: input.season,
    seasonType: input.seasonType ?? 'regular',
    status: input.status,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    updatedAt: new Date(),
  };

  if (existing) {
    const game = await prisma.game.update({ where: { id: existing.id }, data: sharedData });
    return game.id;
  }

  const game = await prisma.game.upsert({
    where: { externalId: input.apiSportsGameId },
    update: {
      sportId: sport.id,
      homeTeamName: input.homeTeamName,
      awayTeamName: input.awayTeamName,
      commenceTime: input.commenceTime,
      ...sharedData,
    },
    create: {
      externalId: input.apiSportsGameId,
      sportId: sport.id,
      homeTeamName: input.homeTeamName,
      awayTeamName: input.awayTeamName,
      commenceTime: input.commenceTime,
      ...sharedData,
    },
  });

  return game.id;
}
