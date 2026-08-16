import { ApiSportsClient } from './client';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { resolveApiSportsTeam, upsertApiSportsGame } from './game-resolver';

const prisma = new PrismaClient();

export interface NFLDateSyncResult {
  processed: number;
  updated: number;
  skipped: number;
  requestsRemaining?: number;
}

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
      tier: env.API_SPORTS_TIER,
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
      
      const game = await prisma.game.findFirst({
        where: {
          apiSportsGameId,
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
          season: this.resolveSeasonForDate(new Date()).toString(),
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

  /**
   * NFL seasons are labeled by their start year but play into the following
   * Jan/Feb (playoffs). A raw `new Date().getFullYear()` mislabels any game
   * played after the calendar flips — map Jan/Feb dates back to the prior
   * season year.
   */
  private resolveSeasonForDate(date: Date): number {
    return date.getMonth() <= 1 ? date.getFullYear() - 1 : date.getFullYear();
  }

  getRequestsRemaining(): number | undefined {
    return this.client.getLastRemainingRequests();
  }

  hasSufficientQuota(minimumRemaining: number): boolean {
    return this.client.hasSufficientRemaining(minimumRemaining);
  }

  async getGamesByDate(date: string, season?: number): Promise<NFLGame[]> {
    const resolvedSeason = season ?? this.resolveSeasonForDate(new Date(date));

    const response = await this.client.get<{ response: NFLGame[] }>(
      '/games',
      { league: 1, season: resolvedSeason, date }
    );

    return response.response || [];
  }

  async syncGamesForDate(date: string, minimumRemaining: number): Promise<NFLDateSyncResult> {
    const result: NFLDateSyncResult = { processed: 0, updated: 0, skipped: 0 };

    if (!this.hasSufficientQuota(minimumRemaining)) {
      result.requestsRemaining = this.getRequestsRemaining();
      return result;
    }

    const games = await this.getGamesByDate(date);
    result.processed = games.length;

    for (const game of games) {
      await this.upsertGameFromApi(game);

      const status = this.mapApiStatusToLocal(game.game.status);
      if (status === 'live' || status === 'completed') {
        await this.syncGameStats(game.game.id.toString());
        result.updated++;
      } else {
        result.skipped++;
      }
    }

    result.requestsRemaining = this.getRequestsRemaining();
    return result;
  }

  private mapApiStatusToLocal(status: NFLGame['game']['status']): string {
    const short = (status?.short || '').toUpperCase();
    const long = (status?.long || '').toLowerCase();

    if (short === 'FT' || short === 'AOT' || long.includes('finished') || long.includes('final')) {
      return 'completed';
    }

    if (short === 'NS' || short === 'TBD' || long.includes('scheduled') || long.includes('postponed')) {
      return 'scheduled';
    }

    if (/^Q[1-4]$/.test(short) || short === 'HT' || short === 'OT' || long.includes('in play')) {
      return 'live';
    }

    return 'scheduled';
  }

  private async upsertGameFromApi(gameData: NFLGame): Promise<string | null> {
    const homeTeam = await resolveApiSportsTeam(gameData.teams.home, 'americanfootball_nfl');
    const awayTeam = await resolveApiSportsTeam(gameData.teams.away, 'americanfootball_nfl');

    const commenceTime = new Date(gameData.game.date.timestamp * 1000);
    if (Number.isNaN(commenceTime.getTime())) {
      logger.warn(`Skipping NFL game ${gameData.game.id} due to invalid date value`);
      return null;
    }

    const seasonValue = gameData.league?.season?.toString() || this.resolveSeasonForDate(commenceTime).toString();

    return upsertApiSportsGame({
      sportKey: 'americanfootball_nfl',
      apiSportsGameId: gameData.game.id.toString(),
      apiSportsLeagueId: 1,
      homeTeamName: gameData.teams.home.name,
      awayTeamName: gameData.teams.away.name,
      homeTeamId: homeTeam?.id,
      awayTeamId: awayTeam?.id,
      commenceTime,
      season: seasonValue,
      status: this.mapApiStatusToLocal(gameData.game.status),
      homeScore: gameData.scores.home.total,
      awayScore: gameData.scores.away.total,
    });
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

  async syncTeams(season: number = new Date().getFullYear() - 2): Promise<number> {
    try {
      logger.info(`Syncing NFL teams for season ${season}`);

      interface ApiTeam {
        id: number;
        name: string;
        code?: string;
        alias?: string;
        logo: string;
      }

      const response = await this.client.get<{ response: ApiTeam[] }>(
        '/teams',
        { league: 1, season }
      );

      if (!response.response?.length) {
        logger.warn('No NFL teams returned from API-Sports');
        return 0;
      }

      const sport = await prisma.sport.findUnique({ where: { key: 'americanfootball_nfl' } });
      if (!sport) {
        logger.error('Sport "americanfootball_nfl" not found. Run /api/admin/init-sports first.');
        return 0;
      }

      let count = 0;
      for (const team of response.response) {
        const existing = await prisma.team.findFirst({
          where: { apiSportsTeamId: team.id, sportId: sport.id },
        });

        if (existing) {
          await prisma.team.update({
            where: { id: existing.id },
            data: {
              name: team.name,
              abbreviation: team.code || team.alias || null,
              logoUrl: team.logo || null,
            },
          });
        } else {
          await prisma.team.create({
            data: {
              sportId: sport.id,
              apiSportsTeamId: team.id,
              name: team.name,
              abbreviation: team.code || team.alias || null,
              logoUrl: team.logo || null,
            },
          });
        }
        count++;
      }

      logger.info(`Synced ${count} NFL teams for season ${season}`);
      return count;
    } catch (error) {
      logger.error(`Failed to sync NFL teams: ${error}`);
      throw error;
    }
  }

  private extractQuarterScores(gameData: NFLGameStatistics, isHome: boolean): number[] {
    // This would come from the game details, not statistics endpoint
    // For now, return empty array - will be populated from game endpoint
    return [];
  }
}
