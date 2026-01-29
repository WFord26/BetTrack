import { ApiSportsClient } from './client';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger';
import { env } from '../../config/env';

const prisma = new PrismaClient();

interface NHLGame {
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
    home: number | null;
    away: number | null;
  };
  periods: {
    first: string | null;
    second: string | null;
    third: string | null;
    overtime: string | null;
    penalties: string | null;
  };
}

export class NHLStatsService {
  private client: ApiSportsClient;

  constructor() {
    if (!env.API_SPORTS_KEY) {
      throw new Error('API_SPORTS_KEY is required for NHLStatsService');
    }
    
    this.client = new ApiSportsClient({
      apiKey: env.API_SPORTS_KEY,
      sport: 'hockey',
    });
  }

  async syncGameStats(apiSportsGameId: string): Promise<void> {
    try {
      logger.info(`Syncing NHL game stats for API-Sports ID: ${apiSportsGameId}`);

      const gameResponse = await this.client.get<{ response: NHLGame[] }>(
        '/games',
        { id: apiSportsGameId }
      );

      if (!gameResponse.response?.length) {
        logger.warn(`No game found for NHL game ${apiSportsGameId}`);
        return;
      }

      const gameData = gameResponse.response[0];
      
      const game = await prisma.game.findFirst({
        where: {
          externalId: apiSportsGameId,
          sport: {
            key: 'icehockey_nhl',
          },
        },
      });

      if (!game) {
        logger.warn(`Game not found in database for API-Sports ID: ${apiSportsGameId}`);
        return;
      }

      // Parse period scores
      const parsePeriodScore = (score: string | null): number => {
        if (!score) return 0;
        const match = score.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
      };

      // Upsert stats for home team
      const homeTeam = await this.findTeam(gameData.teams.home.name, 'icehockey_nhl');
      if (homeTeam) {
        const periodScores = [
          parsePeriodScore(gameData.periods.first?.split('-')[0]),
          parsePeriodScore(gameData.periods.second?.split('-')[0]),
          parsePeriodScore(gameData.periods.third?.split('-')[0]),
        ];

        await prisma.gameStats.upsert({
          where: {
            gameId_teamId: {
              gameId: game.id,
              teamId: homeTeam.id,
            },
          },
          create: {
            gameId: game.id,
            teamId: homeTeam.id,
            isHome: true,
            quarterScores: periodScores,
            stats: {
              goals: gameData.scores.home,
            },
          },
          update: {
            quarterScores: periodScores,
            stats: {
              goals: gameData.scores.home,
            },
            updatedAt: new Date(),
          },
        });
      }

      // Upsert stats for away team
      const awayTeam = await this.findTeam(gameData.teams.away.name, 'icehockey_nhl');
      if (awayTeam) {
        const periodScores = [
          parsePeriodScore(gameData.periods.first?.split('-')[1]),
          parsePeriodScore(gameData.periods.second?.split('-')[1]),
          parsePeriodScore(gameData.periods.third?.split('-')[1]),
        ];

        await prisma.gameStats.upsert({
          where: {
            gameId_teamId: {
              gameId: game.id,
              teamId: awayTeam.id,
            },
          },
          create: {
            gameId: game.id,
            teamId: awayTeam.id,
            isHome: false,
            quarterScores: periodScores,
            stats: {
              goals: gameData.scores.away,
            },
          },
          update: {
            quarterScores: periodScores,
            stats: {
              goals: gameData.scores.away,
            },
            updatedAt: new Date(),
          },
        });
      }

      logger.info(`Successfully synced stats for NHL game ${apiSportsGameId}`);
    } catch (error) {
      logger.error(`Failed to sync NHL game stats: ${error}`);
      throw error;
    }
  }

  async getLiveGames(): Promise<string[]> {
    try {
      const response = await this.client.get<{ response: NHLGame[] }>(
        '/games',
        { 
          live: 'all',
          league: '57', // NHL league ID
          season: new Date().getFullYear().toString(),
        }
      );
      
      const liveGames = response.response.map(g => g.id.toString());
      logger.info(`Found ${liveGames.length} live NHL games`);
      
      return liveGames;
    } catch (error) {
      logger.error(`Failed to fetch live NHL games: ${error}`);
      return [];
    }
  }

  private async findTeam(teamName: string, sportKey: string) {
    return await prisma.team.findFirst({
      where: {
        name: { contains: teamName, mode: 'insensitive' },
        sport: {
          key: sportKey,
        },
      },
    });
  }
}
