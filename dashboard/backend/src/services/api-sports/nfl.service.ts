import { ApiSportsResponse } from './client';
import { AmericanFootballStatsService } from './american-football.service';
import { ApiSportsTeamPayload, DateSyncResult, TeamRecordUpdate } from './base-stats.service';
import { logger } from '../../config/logger';

export type NFLDateSyncResult = DateSyncResult;

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

export class NFLStatsService extends AmericanFootballStatsService {
  constructor() {
    super({ label: 'NFL', sportKey: 'americanfootball_nfl', leagueId: 1 });
  }

  protected liveGameParams(): Record<string, unknown> {
    return {
      league: this.leagueId,
      season: this.resolveSeasonForDate(new Date()).toString(),
    };
  }

  /** The american-football host reports the abbreviation as `code` or `alias`. */
  protected mapApiTeam(team: ApiSportsTeamPayload): TeamRecordUpdate {
    return {
      name: team.name,
      abbreviation: team.code || team.alias || null,
      logoUrl: team.logo || null,
    };
  }

  async syncGameStats(apiSportsGameId: string): Promise<void> {
    try {
      logger.info(`Syncing NFL game stats for API-Sports ID: ${apiSportsGameId}`);

      const statsResponse = await this.client.get<ApiSportsResponse<NFLGameStatistics>>(
        '/games/statistics',
        { id: apiSportsGameId }
      );

      if (!statsResponse.response?.length) {
        logger.warn(`No stats found for NFL game ${apiSportsGameId}`);
        return;
      }

      const gameData = statsResponse.response[0];
      const game = await this.findGameByApiId(apiSportsGameId);

      if (!game) {
        logger.warn(`Game not found in database for API-Sports ID: ${apiSportsGameId}`);
        return;
      }

      for (const teamStats of gameData.statistics) {
        const team = await this.resolveTeam(teamStats.team);

        if (!team) {
          logger.warn(`Team not found: ${teamStats.team.name}`);
          continue;
        }

        await this.upsertGameStats({
          gameId: game.id,
          teamId: team.id,
          isHome: teamStats.team.id === gameData.teams.home.id,
          // Quarter breakdowns live on /games, not /games/statistics; the
          // scores on the Game row come from upsertGameFromApi instead.
          quarterScores: [],
          stats: teamStats.statistics,
        });
      }

      logger.info(`Successfully synced stats for NFL game ${apiSportsGameId}`);
    } catch (error) {
      logger.error(`Failed to sync NFL game stats: ${error}`);
      throw error;
    }
  }
}
