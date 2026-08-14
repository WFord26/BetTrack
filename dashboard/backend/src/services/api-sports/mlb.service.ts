import { ApiSportsClient } from './client';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { upsertApiSportsGame } from './game-resolver';

const prisma = new PrismaClient();

interface MLBGame {
  id: number;
  league?: {
    id: number;
    season: number;
  };
  date: string;
  time?: string;
  timestamp?: number;
  timezone?: string;
  season?: string;
  status: {
    long: string;
    short: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
    };
    away: {
      id: number;
      name: string;
      logo: string;
    };
  };
  scores: {
    home: {
      innings: Record<string, number | null>;
      hits: number | null;
      errors: number | null;
      total: number | null;
    };
    away: {
      innings: Record<string, number | null>;
      hits: number | null;
      errors: number | null;
      total: number | null;
    };
  };
}

interface MLBTeamReference {
  id: number;
  name: string;
  logo: string;
}

interface MLBDateSyncResult {
  processed: number;
  updated: number;
  skipped: number;
  requestsRemaining?: number;
}

export class MLBStatsService {
  private client: ApiSportsClient;

  constructor() {
    if (!env.API_SPORTS_KEY) {
      throw new Error('API_SPORTS_KEY is required for MLBStatsService');
    }

    this.client = new ApiSportsClient({
      apiKey: env.API_SPORTS_KEY,
      sport: 'baseball',
      tier: env.API_SPORTS_TIER,
    });
  }

  async getLiveGames(): Promise<string[]> {
    try {
      const response = await this.client.get<{ response: MLBGame[] }>(
        '/games',
        {
          live: 'all',
          league: 1, // MLB
          season: new Date().getFullYear(),
        }
      );

      const liveGames = response.response.map(g => g.id.toString());
      logger.info(`Found ${liveGames.length} live MLB games`);

      return liveGames;
    } catch (error) {
      logger.error(`Failed to fetch live MLB games: ${error}`);
      return [];
    }
  }

  getRequestsRemaining(): number | undefined {
    return this.client.getLastRemainingRequests();
  }

  hasSufficientQuota(minimumRemaining: number): boolean {
    return this.client.hasSufficientRemaining(minimumRemaining);
  }

  async getGamesByDate(date: string, season?: number): Promise<MLBGame[]> {
    const resolvedSeason = season ?? new Date(date).getFullYear();

    const response = await this.client.get<{ response: MLBGame[] }>(
      '/games',
      {
        league: 1,
        season: resolvedSeason,
        date,
      }
    );

    return response.response || [];
  }

  async syncGamesForDate(date: string, minimumRemaining: number): Promise<MLBDateSyncResult> {
    const result: MLBDateSyncResult = {
      processed: 0,
      updated: 0,
      skipped: 0,
    };

    if (!this.hasSufficientQuota(minimumRemaining)) {
      result.requestsRemaining = this.getRequestsRemaining();
      return result;
    }

    const season = new Date(date).getFullYear();
    const games = await this.getGamesByDate(date, season);
    result.processed = games.length;

    for (const game of games) {
      await this.upsertGameFromApi(game);

      const status = this.mapApiStatusToLocal(game.status);
      if (status === 'live' || status === 'completed') {
        await this.syncGameStatsFromGame(game);
        result.updated++;
      } else {
        result.skipped++;
      }
    }

    result.requestsRemaining = this.getRequestsRemaining();
    return result;
  }

  async syncGameStats(apiSportsGameId: string): Promise<void> {
    try {
      logger.info(`Syncing MLB game stats for API-Sports ID: ${apiSportsGameId}`);

      const gameResponse = await this.client.get<{ response: MLBGame[] }>(
        '/games',
        { id: apiSportsGameId }
      );

      if (!gameResponse.response?.length) {
        logger.warn(`No game found for MLB game ${apiSportsGameId}`);
        return;
      }

      const gameData = gameResponse.response[0];

      await this.upsertGameFromApi(gameData);
      await this.syncGameStatsFromGame(gameData);

      logger.info(`Successfully synced stats for MLB game ${apiSportsGameId}`);
    } catch (error) {
      logger.error(`Failed to sync MLB game stats: ${error}`);
      throw error;
    }
  }

  async syncTeams(season: number = new Date().getFullYear() - 2): Promise<number> {
    try {
      logger.info(`Syncing MLB teams for season ${season}`);

      interface ApiTeam {
        id: number;
        name: string;
        logo: string;
        national: boolean;
      }

      const response = await this.client.get<{ response: ApiTeam[] }>(
        '/teams',
        { league: 1, season }
      );

      if (!response.response?.length) {
        logger.warn('No MLB teams returned from API-Sports');
        return 0;
      }

      const sport = await prisma.sport.findUnique({ where: { key: 'baseball_mlb' } });
      if (!sport) {
        logger.error('Sport "baseball_mlb" not found. Run /api/admin/init-sports first.');
        return 0;
      }

      // Filter out conference/division entries (e.g. "American League", "National League")
      const teams = response.response.filter(t => !t.name.endsWith('League'));

      let count = 0;
      for (const team of teams) {
        const existing = await prisma.team.findFirst({
          where: { apiSportsTeamId: team.id, sportId: sport.id },
        });

        if (existing) {
          await prisma.team.update({
            where: { id: existing.id },
            data: {
              name: team.name,
              logoUrl: team.logo || null,
            },
          });
        } else {
          await prisma.team.create({
            data: {
              sportId: sport.id,
              apiSportsTeamId: team.id,
              name: team.name,
              logoUrl: team.logo || null,
            },
          });
        }
        count++;
      }

      logger.info(`Synced ${count} MLB teams for season ${season}`);
      return count;
    } catch (error) {
      logger.error(`Failed to sync MLB teams: ${error}`);
      throw error;
    }
  }

  private mapApiStatusToLocal(status: MLBGame['status']): string {
    const short = (status?.short || '').toUpperCase();
    const long = (status?.long || '').toLowerCase();

    if (short === 'FT' || short === 'AOT' || long.includes('finished') || long.includes('final')) {
      return 'completed';
    }

    if (
      short === 'NS' ||
      short === 'TBD' ||
      long.includes('scheduled') ||
      long.includes('postponed')
    ) {
      return 'scheduled';
    }

    if (
      short === 'LIVE' ||
      /^[0-9]+$/.test(short) ||
      long.includes('in progress')
    ) {
      return 'live';
    }

    return 'scheduled';
  }

  private async getMlbSportId(): Promise<number | null> {
    const sport = await prisma.sport.findUnique({ where: { key: 'baseball_mlb' } });
    return sport?.id ?? null;
  }

  private async resolveTeamReference(team: MLBTeamReference) {
    const byApiId = await prisma.team.findFirst({
      where: {
        apiSportsTeamId: team.id,
        sport: { key: 'baseball_mlb' },
      },
    });

    if (byApiId) {
      return byApiId;
    }

    return this.findTeam(team.name, 'baseball_mlb');
  }

  private async upsertGameFromApi(gameData: MLBGame): Promise<string | null> {
    const homeTeam = await this.resolveTeamReference(gameData.teams.home);
    const awayTeam = await this.resolveTeamReference(gameData.teams.away);

    const seasonValue =
      gameData.league?.season?.toString() ||
      gameData.season ||
      new Date(gameData.date).getFullYear().toString();

    const commenceTime = new Date(gameData.date);
    if (Number.isNaN(commenceTime.getTime())) {
      logger.warn(`Skipping MLB game ${gameData.id} due to invalid date value: ${gameData.date}`);
      return null;
    }

    return upsertApiSportsGame({
      sportKey: 'baseball_mlb',
      apiSportsGameId: gameData.id.toString(),
      apiSportsLeagueId: 1,
      homeTeamName: gameData.teams.home.name,
      awayTeamName: gameData.teams.away.name,
      homeTeamId: homeTeam?.id,
      awayTeamId: awayTeam?.id,
      commenceTime,
      season: seasonValue,
      status: this.mapApiStatusToLocal(gameData.status),
      homeScore: gameData.scores.home.total,
      awayScore: gameData.scores.away.total,
    });
  }

  private async syncGameStatsFromGame(gameData: MLBGame): Promise<void> {
    const game = await prisma.game.findFirst({
      where: {
        apiSportsGameId: gameData.id.toString(),
        sport: { key: 'baseball_mlb' },
      },
    });

    if (!game) {
      logger.warn(`Game not found in database for API-Sports ID: ${gameData.id}`);
      return;
    }

    const homeTeam = await this.resolveTeamReference(gameData.teams.home);
    if (homeTeam) {
      await prisma.gameStats.upsert({
        where: { gameId_teamId: { gameId: game.id, teamId: homeTeam.id } },
        create: {
          gameId: game.id,
          teamId: homeTeam.id,
          isHome: true,
          quarterScores: Object.values(gameData.scores.home.innings ?? {}).filter((s): s is number => s !== null),
          stats: {
            hits: gameData.scores.home.hits,
            errors: gameData.scores.home.errors,
            total: gameData.scores.home.total,
          },
        },
        update: {
          quarterScores: Object.values(gameData.scores.home.innings ?? {}).filter((s): s is number => s !== null),
          stats: {
            hits: gameData.scores.home.hits,
            errors: gameData.scores.home.errors,
            total: gameData.scores.home.total,
          },
          updatedAt: new Date(),
        },
      });
    }

    const awayTeam = await this.resolveTeamReference(gameData.teams.away);
    if (awayTeam) {
      await prisma.gameStats.upsert({
        where: { gameId_teamId: { gameId: game.id, teamId: awayTeam.id } },
        create: {
          gameId: game.id,
          teamId: awayTeam.id,
          isHome: false,
          quarterScores: Object.values(gameData.scores.away.innings ?? {}).filter((s): s is number => s !== null),
          stats: {
            hits: gameData.scores.away.hits,
            errors: gameData.scores.away.errors,
            total: gameData.scores.away.total,
          },
        },
        update: {
          quarterScores: Object.values(gameData.scores.away.innings ?? {}).filter((s): s is number => s !== null),
          stats: {
            hits: gameData.scores.away.hits,
            errors: gameData.scores.away.errors,
            total: gameData.scores.away.total,
          },
          updatedAt: new Date(),
        },
      });
    }
  }

  private async findTeam(teamName: string, sportKey: string) {
    return await prisma.team.findFirst({
      where: {
        name: { contains: teamName, mode: 'insensitive' },
        sport: { key: sportKey },
      },
    });
  }
}
