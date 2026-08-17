import { ApiSportsResponse } from './client';
import { AmericanFootballStatsService } from './american-football.service';
import { DateSyncResult } from './base-stats.service';
import { logger } from '../../config/logger';

export type NCAAFDateSyncResult = DateSyncResult;

/**
 * NCAA Football (NCAAF) stats service.
 * League ID confirmed as 2 against the live API-Sports /leagues endpoint
 * (NFL is league 1, on the same "american-football" sport).
 */
export class NCAAFService extends AmericanFootballStatsService {
  constructor() {
    super({ label: 'NCAAF', sportKey: 'americanfootball_ncaaf', leagueId: 2 });
  }

  async syncGameStats(externalGameId: string): Promise<void> {
    try {
      const game = await this.findGameWithTeamsByApiId(externalGameId);

      if (!game) {
        logger.warn(`Game not found: ${externalGameId}`);
        return;
      }

      const response = await this.client.get<ApiSportsResponse<any>>('/games/statistics', {
        id: externalGameId,
      });

      const statsData = response.response?.[0];
      if (!statsData) {
        logger.warn(`No stats data for game: ${externalGameId}`);
        return;
      }

      const teams = statsData.teams || [];

      for (const teamData of teams) {
        if (!game.homeTeam) continue;

        const isHome = teamData.team?.id === game.homeTeam.apiSportsTeamId;
        const teamId = isHome ? game.homeTeamId : game.awayTeamId;

        if (!teamId) {
          logger.warn(`Team ID not found for game ${game.id}`);
          continue;
        }

        const periods = teamData.statistics?.periods || [];
        const quarterScores = periods.map((p: any) => p.points || 0);
        const totalScore = quarterScores.reduce((sum: number, score: number) => sum + score, 0);

        await this.upsertGameStats({
          gameId: game.id,
          teamId,
          isHome,
          quarterScores,
          stats: {
            points: totalScore,
            first_downs: teamData.statistics?.first_downs || 0,
            third_down_conversions: teamData.statistics?.third_down_conversions || 0,
            third_down_attempts: teamData.statistics?.third_down_attempts || 0,
            fourth_down_conversions: teamData.statistics?.fourth_down_conversions || 0,
            fourth_down_attempts: teamData.statistics?.fourth_down_attempts || 0,
            total_yards: teamData.statistics?.total_yards || 0,
            passing_yards: teamData.statistics?.passing_yards || 0,
            passing_completions: teamData.statistics?.passing_completions || 0,
            passing_attempts: teamData.statistics?.passing_attempts || 0,
            passing_touchdowns: teamData.statistics?.passing_touchdowns || 0,
            interceptions: teamData.statistics?.interceptions || 0,
            rushing_yards: teamData.statistics?.rushing_yards || 0,
            rushing_attempts: teamData.statistics?.rushing_attempts || 0,
            rushing_touchdowns: teamData.statistics?.rushing_touchdowns || 0,
            fumbles: teamData.statistics?.fumbles || 0,
            fumbles_lost: teamData.statistics?.fumbles_lost || 0,
            penalties: teamData.statistics?.penalties || 0,
            penalty_yards: teamData.statistics?.penalty_yards || 0,
            possession_time: teamData.statistics?.possession_time || '00:00',
            sacks: teamData.statistics?.sacks || 0,
          },
        });
      }

      logger.info(`Synced NCAAF game stats: ${externalGameId}`);
    } catch (error) {
      logger.error(`Error syncing NCAAF game stats for ${externalGameId}:`, error);
    }
  }

  async syncPlayerStats(externalGameId: string): Promise<void> {
    try {
      const game = await this.findGameByApiId(externalGameId);

      if (!game) {
        logger.warn(`Game not found: ${externalGameId}`);
        return;
      }

      const response = await this.client.get<ApiSportsResponse<any>>('/games/players', {
        id: externalGameId,
      });

      const playersData = response.response || [];

      for (const teamData of playersData) {
        const team = await this.findTeamByApiId(teamData.team?.id);
        if (!team) continue;

        for (const playerData of teamData.players || []) {
          const player = await this.upsertPlayer({
            externalId: playerData.player?.id?.toString(),
            fullName: playerData.player?.name || '',
            teamId: team.id,
          });

          const stats: any = {
            position: playerData.position || 'N/A',
          };

          if (playerData.statistics?.passing) {
            stats.passing_completions = playerData.statistics.passing.completions || 0;
            stats.passing_attempts = playerData.statistics.passing.attempts || 0;
            stats.passing_yards = playerData.statistics.passing.yards || 0;
            stats.passing_touchdowns = playerData.statistics.passing.touchdowns || 0;
            stats.interceptions = playerData.statistics.passing.interceptions || 0;
          }

          if (playerData.statistics?.rushing) {
            stats.rushing_attempts = playerData.statistics.rushing.attempts || 0;
            stats.rushing_yards = playerData.statistics.rushing.yards || 0;
            stats.rushing_touchdowns = playerData.statistics.rushing.touchdowns || 0;
          }

          if (playerData.statistics?.receiving) {
            stats.receptions = playerData.statistics.receiving.receptions || 0;
            stats.receiving_yards = playerData.statistics.receiving.yards || 0;
            stats.receiving_touchdowns = playerData.statistics.receiving.touchdowns || 0;
          }

          if (playerData.statistics?.defense) {
            stats.tackles = playerData.statistics.defense.tackles || 0;
            stats.sacks = playerData.statistics.defense.sacks || 0;
            stats.interceptions_defense = playerData.statistics.defense.interceptions || 0;
          }

          if (playerData.statistics?.kicking) {
            stats.field_goals_made = playerData.statistics.kicking.field_goals_made || 0;
            stats.field_goals_attempts = playerData.statistics.kicking.field_goals_attempts || 0;
            stats.extra_points_made = playerData.statistics.kicking.extra_points_made || 0;
          }

          await this.upsertPlayerGameStats({
            gameId: game.id,
            playerId: player.id,
            teamId: player.teamId || game.homeTeamId || 0,
            stats,
          });
        }
      }

      logger.info(`Synced NCAAF player stats: ${externalGameId}`);
    } catch (error) {
      logger.error(`Error syncing NCAAF player stats for ${externalGameId}:`, error);
    }
  }
}
