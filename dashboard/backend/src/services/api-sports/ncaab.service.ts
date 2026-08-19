import { ApiSportsResponse } from './client';
import { BasketballStatsService } from './basketball.service';
import { logger } from '../../config/logger';

/** A `/games` entry from the basketball host. */
interface NCAABGame {
  id: number;
}

/**
 * NCAA Basketball (NCAAB) stats service.
 * League ID: 127 for NCAA Basketball
 */
export class NCAABService extends BasketballStatsService<NCAABGame> {
  constructor() {
    super({
      label: 'NCAAB',
      sportKey: 'basketball_ncaab',
      leagueId: 127,
    });
  }

  extractGameId(game: NCAABGame): string {
    return String(game.id);
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

      for (const teamData of statsData.teams || []) {
        if (!game.homeTeam) continue;

        const isHome = teamData.team?.id === game.homeTeam.apiSportsTeamId;
        const teamId = isHome ? game.homeTeamId : game.awayTeamId;

        if (!teamId) {
          logger.warn(`Team ID not found for game ${game.id}`);
          continue;
        }

        // NCAA Basketball plays 2 halves plus any overtime periods.
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
            field_goals: teamData.statistics?.field_goals_made || 0,
            field_goals_attempts: teamData.statistics?.field_goals_attempts || 0,
            field_goal_percentage: teamData.statistics?.field_goal_percentage || 0,
            three_pointers: teamData.statistics?.three_points_made || 0,
            three_point_attempts: teamData.statistics?.three_points_attempts || 0,
            three_point_percentage: teamData.statistics?.three_point_percentage || 0,
            free_throws: teamData.statistics?.free_throws_made || 0,
            free_throw_attempts: teamData.statistics?.free_throws_attempts || 0,
            free_throw_percentage: teamData.statistics?.free_throw_percentage || 0,
            rebounds: teamData.statistics?.rebounds || 0,
            offensive_rebounds: teamData.statistics?.offensive_rebounds || 0,
            defensive_rebounds: teamData.statistics?.defensive_rebounds || 0,
            assists: teamData.statistics?.assists || 0,
            steals: teamData.statistics?.steals || 0,
            blocks: teamData.statistics?.blocks || 0,
            turnovers: teamData.statistics?.turnovers || 0,
            fouls: teamData.statistics?.fouls || 0,
          },
        });
      }

      logger.info(`Synced NCAAB game stats: ${externalGameId}`);
    } catch (error) {
      logger.error(`Error syncing NCAAB game stats for ${externalGameId}:`, error);
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

      for (const teamData of response.response || []) {
        const team = await this.findTeamByApiId(teamData.team?.id);
        if (!team) continue;

        for (const playerData of teamData.players || []) {
          const player = await this.upsertPlayer({
            externalId: playerData.player?.id?.toString(),
            fullName: playerData.player?.name || '',
            teamId: team.id,
          });

          await this.upsertPlayerGameStats({
            gameId: game.id,
            playerId: player.id,
            teamId: player.teamId || game.homeTeamId || 0,
            stats: {
              minutes: playerData.statistics?.minutes || '0:00',
              points: playerData.statistics?.points || 0,
              rebounds: playerData.statistics?.rebounds || 0,
              assists: playerData.statistics?.assists || 0,
              field_goals_made: playerData.statistics?.field_goals_made || 0,
              field_goals_attempts: playerData.statistics?.field_goals_attempts || 0,
              field_goal_percentage: playerData.statistics?.field_goal_percentage || 0,
              three_pointers_made: playerData.statistics?.three_points_made || 0,
              three_point_attempts: playerData.statistics?.three_points_attempts || 0,
              three_point_percentage: playerData.statistics?.three_point_percentage || 0,
              free_throws_made: playerData.statistics?.free_throws_made || 0,
              free_throw_attempts: playerData.statistics?.free_throws_attempts || 0,
              free_throw_percentage: playerData.statistics?.free_throw_percentage || 0,
              offensive_rebounds: playerData.statistics?.offensive_rebounds || 0,
              defensive_rebounds: playerData.statistics?.defensive_rebounds || 0,
              steals: playerData.statistics?.steals || 0,
              blocks: playerData.statistics?.blocks || 0,
              turnovers: playerData.statistics?.turnovers || 0,
              fouls: playerData.statistics?.fouls || 0,
              plus_minus: playerData.statistics?.plus_minus || 0,
            },
          });
        }
      }

      logger.info(`Synced NCAAB player stats: ${externalGameId}`);
    } catch (error) {
      logger.error(`Error syncing NCAAB player stats for ${externalGameId}:`, error);
    }
  }
}
