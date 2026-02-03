import { ApiSportsClient } from './client';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger';
import { env } from '../../config/env';

const prisma = new PrismaClient();

interface NBAGame {
  id: number;
  league: string;
  season: string;
  date: {
    start: string;
    end: string | null;
  };
  stage: string;
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
      quarter_1: number | null;
      quarter_2: number | null;
      quarter_3: number | null;
      quarter_4: number | null;
      over_time: number | null;
      total: number | null;
    };
    away: {
      quarter_1: number | null;
      quarter_2: number | null;
      quarter_3: number | null;
      quarter_4: number | null;
      over_time: number | null;
      total: number | null;
    };
  };
}

export class NBAStatsService {
  private client: ApiSportsClient;

  constructor() {
    if (!env.API_SPORTS_KEY) {
      throw new Error('API_SPORTS_KEY is required for NBAStatsService');
    }
    
    this.client = new ApiSportsClient({
      apiKey: env.API_SPORTS_KEY,
      sport: 'basketball',
    });
  }

  async syncGameStats(apiSportsGameId: string): Promise<void> {
    try {
      logger.info(`Syncing NBA game stats for API-Sports ID: ${apiSportsGameId}`);

      // Fetch game details
      const gameResponse = await this.client.get<{ response: NBAGame[] }>(
        '/games',
        { id: apiSportsGameId }
      );

      if (!gameResponse.response?.length) {
        logger.warn(`No game found for NBA game ${apiSportsGameId}`);
        return;
      }

      const gameData = gameResponse.response[0];
      
      // Find internal game
      const game = await prisma.game.findFirst({
        where: {
          externalId: apiSportsGameId,
          sport: {
            key: 'basketball_nba',
          },
        },
      });

      if (!game) {
        logger.warn(`Game not found in database for API-Sports ID: ${apiSportsGameId}`);
        return;
      }

      // Upsert stats for home team
      const homeTeam = await this.findTeam(gameData.teams.home.name, 'basketball_nba');
      if (homeTeam) {
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
            quarterScores: [
              gameData.scores.home.quarter_1,
              gameData.scores.home.quarter_2,
              gameData.scores.home.quarter_3,
              gameData.scores.home.quarter_4,
              gameData.scores.home.over_time,
            ].filter((score): score is number => score !== null),
            stats: {
              points: gameData.scores.home.total,
            },
          },
          update: {
            quarterScores: [
              gameData.scores.home.quarter_1,
              gameData.scores.home.quarter_2,
              gameData.scores.home.quarter_3,
              gameData.scores.home.quarter_4,
              gameData.scores.home.over_time,
            ].filter((score): score is number => score !== null),
            stats: {
              points: gameData.scores.home.total,
            },
            updatedAt: new Date(),
          },
        });
      }

      // Upsert stats for away team
      const awayTeam = await this.findTeam(gameData.teams.away.name, 'basketball_nba');
      if (awayTeam) {
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
            quarterScores: [
              gameData.scores.away.quarter_1,
              gameData.scores.away.quarter_2,
              gameData.scores.away.quarter_3,
              gameData.scores.away.quarter_4,
              gameData.scores.away.over_time,
            ].filter((score): score is number => score !== null),
            stats: {
              points: gameData.scores.away.total,
            },
          },
          update: {
            quarterScores: [
              gameData.scores.away.quarter_1,
              gameData.scores.away.quarter_2,
              gameData.scores.away.quarter_3,
              gameData.scores.away.quarter_4,
              gameData.scores.away.over_time,
            ].filter((score): score is number => score !== null),
            stats: {
              points: gameData.scores.away.total,
            },
            updatedAt: new Date(),
          },
        });
      }

      // Fetch player stats
      await this.syncPlayerStats(apiSportsGameId, game.id);

      logger.info(`Successfully synced stats for NBA game ${apiSportsGameId}`);
    } catch (error) {
      logger.error(`Failed to sync NBA game stats: ${error}`);
      throw error;
    }
  }

  async syncPlayerStats(apiSportsGameId: string, internalGameId: string): Promise<void> {
    try {
      const statsResponse = await this.client.get<{ response: any[] }>(
        '/games/statistics',
        { id: apiSportsGameId }
      );

      if (!statsResponse.response?.length) {
        return;
      }

      for (const teamData of statsResponse.response) {
        const team = await this.findTeam(teamData.team.name, 'basketball_nba');
        if (!team) continue;

        for (const playerData of teamData.statistics || []) {
          // Find or create player
          let player = await prisma.player.findFirst({
            where: {
              externalId: playerData.player.id?.toString(),
            },
          });

          if (!player) {
            const nameParts = playerData.player.name.split(' ');
            player = await prisma.player.create({
              data: {
                externalId: playerData.player.id?.toString() || null,
                teamId: team.id,
                firstName: nameParts[0] || '',
                lastName: nameParts.slice(1).join(' ') || '',
                position: playerData.pos || null,
              },
            });
          }

          // Upsert player game stats
          await prisma.playerGameStats.upsert({
            where: {
              gameId_playerId: {
                gameId: internalGameId,
                playerId: player.id,
              },
            },
            create: {
              gameId: internalGameId,
              playerId: player.id,
              teamId: team.id,
              stats: {
                points: playerData.points || 0,
                rebounds: playerData.totReb || 0,
                assists: playerData.assists || 0,
                steals: playerData.steals || 0,
                blocks: playerData.blocks || 0,
                turnovers: playerData.turnovers || 0,
                fgm: playerData.fgm || 0,
                fga: playerData.fga || 0,
                fgPct: playerData.fgp || 0,
                ftm: playerData.ftm || 0,
                fta: playerData.fta || 0,
                ftPct: playerData.ftp || 0,
                tpm: playerData.tpm || 0,
                tpa: playerData.tpa || 0,
                tpPct: playerData.tpp || 0,
              },
              started: playerData.pos?.includes('G') || playerData.pos?.includes('F') || false,
              minutesPlayed: playerData.min || null,
            },
            update: {
              stats: {
                points: playerData.points || 0,
                rebounds: playerData.totReb || 0,
                assists: playerData.assists || 0,
                steals: playerData.steals || 0,
                blocks: playerData.blocks || 0,
                turnovers: playerData.turnovers || 0,
                fgm: playerData.fgm || 0,
                fga: playerData.fga || 0,
                fgPct: playerData.fgp || 0,
                ftm: playerData.ftm || 0,
                fta: playerData.fta || 0,
                ftPct: playerData.ftp || 0,
                tpm: playerData.tpm || 0,
                tpa: playerData.tpa || 0,
                tpPct: playerData.tpp || 0,
              },
              minutesPlayed: playerData.min || null,
            },
          });
        }
      }
    } catch (error) {
      logger.error(`Failed to sync NBA player stats: ${error}`);
    }
  }

  async getLiveGames(): Promise<string[]> {
    try {
      const response = await this.client.get<{ response: NBAGame[] }>(
        '/games',
        { 
          live: 'all',
          league: '12', // NBA league ID
          season: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        }
      );
      
      const liveGames = response.response.map(g => g.id.toString());
      logger.info(`Found ${liveGames.length} live NBA games`);
      
      return liveGames;
    } catch (error) {
      logger.error(`Failed to fetch live NBA games: ${error}`);
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
