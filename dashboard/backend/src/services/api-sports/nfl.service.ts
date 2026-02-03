import { ApiSportsClient } from './client';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger';
import { env } from '../../config/env';

const prisma = new PrismaClient();

interface NFLGame {
  game: {
    id: number;
    stage: string;
    week: string;
    date: {
      timezone: string;
      date: string;
      time: string;
      timestamp: number;
    };
    venue: {
      name: string;
      city: string;
    };
    status: {
      short: string;
      long: string;
      timer: string | null;
    };
  };
  league: {
    id: number;
    name: string;
    season: string;
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
      overtime: number | null;
      total: number | null;
    };
    away: {
      quarter_1: number | null;
      quarter_2: number | null;
      quarter_3: number | null;
      quarter_4: number | null;
      overtime: number | null;
      total: number | null;
    };
  };
}

interface NFLGameStatistics {
  game: {
    id: number;
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  statistics: Array<{
    team: { id: number; name: string };
    statistics: {
      first_downs?: { total: number };
      yards?: { total: number; passing: number; rushing: number };
      turnovers?: { total: number };
      possession?: { total: string };
      penalties?: { total: number; yards: number };
      third_down_conversions?: { total: number; success: number };
      fourth_down_conversions?: { total: number; success: number };
      touchdowns?: { total: number };
      field_goals?: { made: number; attempts: number };
    };
  }>;
}

interface NFLPlayerStats {
  game: { id: number };
  player: {
    id: number;
    name: string;
    image: string;
  };
  team: { id: number; name: string };
  statistics: {
    passing?: { completions: number; attempts: number; yards: number; touchdowns: number; interceptions: number };
    rushing?: { attempts: number; yards: number; touchdowns: number; longest: number };
    receiving?: { receptions: number; yards: number; touchdowns: number; targets: number };
    defense?: { tackles: number; sacks: number; interceptions: number; forced_fumbles: number };
    kicking?: { field_goals_made: number; field_goals_attempts: number; extra_points_made: number };
  };
}

export class NFLStatsService {
  private client: ApiSportsClient;

  constructor() {
    if (!env.API_SPORTS_KEY) {
      throw new Error('API_SPORTS_KEY is required for NFLStatsService');
    }
    
    this.client = new ApiSportsClient({
      apiKey: env.API_SPORTS_KEY,
      sport: 'american-football',
    });
  }

  async syncGameStats(apiSportsGameId: string): Promise<void> {
    try {
      logger.info(`Syncing NFL game stats for API-Sports ID: ${apiSportsGameId}`);

      // Fetch game statistics
      const statsResponse = await this.client.get<{ response: NFLGameStatistics[] }>(
        '/games/statistics',
        { id: apiSportsGameId }
      );

      if (!statsResponse.response?.length) {
        logger.warn(`No stats found for NFL game ${apiSportsGameId}`);
        return;
      }

      const gameData = statsResponse.response[0];
      
      // Find internal game by mapping API-Sports ID
      // Note: You'll need to store the API-Sports game ID in your Game model
      const game = await prisma.game.findFirst({
        where: {
          // Assuming you add a field like apiSportsId to Game model
          externalId: apiSportsGameId,
          sport: {
            key: 'americanfootball_nfl',
          },
        },
      });

      if (!game) {
        logger.warn(`Game not found in database for API-Sports ID: ${apiSportsGameId}`);
        return;
      }

      // Upsert stats for each team
      for (const teamStats of gameData.statistics) {
        const isHome = teamStats.team.id === gameData.teams.home.id;
        
        // Find team by external ID
        const team = await prisma.team.findFirst({
          where: {
            name: { contains: teamStats.team.name, mode: 'insensitive' },
            sport: {
              key: 'americanfootball_nfl',
            },
          },
        });

        if (!team) {
          logger.warn(`Team not found: ${teamStats.team.name}`);
          continue;
        }

        await prisma.gameStats.upsert({
          where: {
            gameId_teamId: {
              gameId: game.id,
              teamId: team.id,
            },
          },
          create: {
            gameId: game.id,
            teamId: team.id,
            isHome,
            quarterScores: this.extractQuarterScores(gameData, isHome),
            stats: teamStats.statistics,
          },
          update: {
            quarterScores: this.extractQuarterScores(gameData, isHome),
            stats: teamStats.statistics,
            updatedAt: new Date(),
          },
        });
      }

      logger.info(`Successfully synced stats for NFL game ${apiSportsGameId}`);
    } catch (error) {
      logger.error(`Failed to sync NFL game stats: ${error}`);
      throw error;
    }
  }

  async getLiveGames(): Promise<string[]> {
    try {
      const response = await this.client.get<{ response: NFLGame[] }>(
        '/games',
        { 
          live: 'all',
          league: 1, // NFL league ID
          season: new Date().getFullYear().toString(),
        }
      );
      
      const liveGames = response.response.map(g => g.game.id.toString());
      logger.info(`Found ${liveGames.length} live NFL games`);
      
      return liveGames;
    } catch (error) {
      logger.error(`Failed to fetch live NFL games: ${error}`);
      return [];
    }
  }

  async syncTeamStats(teamId: number, season: number): Promise<void> {
    try {
      // Fetch team statistics for the season
      const response = await this.client.get<{ response: any[] }>(
        '/teams/statistics',
        { id: teamId, season: season.toString() }
      );

      if (!response.response?.length) {
        logger.warn(`No team stats found for NFL team ${teamId}`);
        return;
      }

      const teamData = response.response[0];
      
      // Find internal team
      const team = await prisma.team.findFirst({
        where: {
          externalId: teamId.toString(),
          sport: {
            key: 'americanfootball_nfl',
          },
        },
      });

      if (!team) {
        logger.warn(`Team not found: ${teamId}`);
        return;
      }

      // Upsert team season stats
      await prisma.teamStats.upsert({
        where: {
          teamId_season_seasonType: {
            teamId: team.id,
            season,
            seasonType: 'regular',
          },
        },
        create: {
          teamId: team.id,
          sportKey: 'americanfootball_nfl',
          season,
          seasonType: 'regular',
          offense: teamData.offense || {},
          defense: teamData.defense || {},
          standings: {
            wins: teamData.wins || 0,
            losses: teamData.losses || 0,
            ties: teamData.ties || 0,
          },
          gamesPlayed: teamData.games_played || 0,
        },
        update: {
          offense: teamData.offense || {},
          defense: teamData.defense || {},
          standings: {
            wins: teamData.wins || 0,
            losses: teamData.losses || 0,
            ties: teamData.ties || 0,
          },
          gamesPlayed: teamData.games_played || 0,
          lastUpdated: new Date(),
        },
      });

      logger.info(`Successfully synced team stats for NFL team ${teamId}`);
    } catch (error) {
      logger.error(`Failed to sync NFL team stats: ${error}`);
      throw error;
    }
  }

  private extractQuarterScores(gameData: NFLGameStatistics, isHome: boolean): number[] {
    // This would come from the game details, not statistics endpoint
    // For now, return empty array - will be populated from game endpoint
    return [];
  }
}
