import { ApiSportsClient } from './client';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger';
import { env } from '../../config/env';

const prisma = new PrismaClient();

interface MLBGame {
  id: number;
  league: string;
  season: string;
  date: {
    start: string;
    end: string | null;
  };
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

export class MLBStatsService {
  private client: ApiSportsClient;

  constructor() {
    if (!env.API_SPORTS_KEY) {
      throw new Error('API_SPORTS_KEY is required for MLBStatsService');
    }

    this.client = new ApiSportsClient({
      apiKey: env.API_SPORTS_KEY,
      sport: 'baseball',
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

      const game = await prisma.game.findFirst({
        where: {
          externalId: apiSportsGameId,
          sport: { key: 'baseball_mlb' },
        },
      });

      if (!game) {
        logger.warn(`Game not found in database for API-Sports ID: ${apiSportsGameId}`);
        return;
      }

      const homeTeam = await this.findTeam(gameData.teams.home.name, 'baseball_mlb');
      if (homeTeam) {
        await prisma.gameStats.upsert({
          where: { gameId_teamId: { gameId: game.id, teamId: homeTeam.id } },
          create: {
            gameId: game.id,
            teamId: homeTeam.id,
            isHome: true,
            quarterScores: Object.values(gameData.scores.home.innings ?? {})
              .filter((s): s is number => s !== null),
            stats: {
              hits: gameData.scores.home.hits,
              errors: gameData.scores.home.errors,
              total: gameData.scores.home.total,
            },
          },
          update: {
            quarterScores: Object.values(gameData.scores.home.innings ?? {})
              .filter((s): s is number => s !== null),
            stats: {
              hits: gameData.scores.home.hits,
              errors: gameData.scores.home.errors,
              total: gameData.scores.home.total,
            },
            updatedAt: new Date(),
          },
        });
      }

      const awayTeam = await this.findTeam(gameData.teams.away.name, 'baseball_mlb');
      if (awayTeam) {
        await prisma.gameStats.upsert({
          where: { gameId_teamId: { gameId: game.id, teamId: awayTeam.id } },
          create: {
            gameId: game.id,
            teamId: awayTeam.id,
            isHome: false,
            quarterScores: Object.values(gameData.scores.away.innings ?? {})
              .filter((s): s is number => s !== null),
            stats: {
              hits: gameData.scores.away.hits,
              errors: gameData.scores.away.errors,
              total: gameData.scores.away.total,
            },
          },
          update: {
            quarterScores: Object.values(gameData.scores.away.innings ?? {})
              .filter((s): s is number => s !== null),
            stats: {
              hits: gameData.scores.away.hits,
              errors: gameData.scores.away.errors,
              total: gameData.scores.away.total,
            },
            updatedAt: new Date(),
          },
        });
      }

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

  private async findTeam(teamName: string, sportKey: string) {
    return await prisma.team.findFirst({
      where: {
        name: { contains: teamName, mode: 'insensitive' },
        sport: { key: sportKey },
      },
    });
  }
}
