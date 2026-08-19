import { ApiSportsResponse } from './client';
import { BasketballStatsService } from './basketball.service';
import { logger } from '../../config/logger';

interface NBATeamScore {
  quarter_1: number | null;
  quarter_2: number | null;
  quarter_3: number | null;
  quarter_4: number | null;
  over_time: number | null;
  total: number | null;
}

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
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  scores: {
    home: NBATeamScore;
    away: NBATeamScore;
  };
}

export class NBAStatsService extends BasketballStatsService<NBAGame> {
  constructor() {
    super({
      label: 'NBA',
      sportKey: 'basketball_nba',
      leagueId: 12,
    });
  }

  extractGameId(game: NBAGame): string {
    return game.id.toString();
  }

  protected liveGameParams(): Record<string, unknown> {
    const year = new Date().getFullYear();
    return { league: this.leagueId, season: `${year}-${year + 1}` };
  }

  async syncGameStats(apiSportsGameId: string): Promise<void> {
    try {
      logger.info(`Syncing NBA game stats for API-Sports ID: ${apiSportsGameId}`);

      const gameResponse = await this.client.get<ApiSportsResponse<NBAGame>>('/games', {
        id: apiSportsGameId,
      });

      if (!gameResponse.response?.length) {
        logger.warn(`No game found for NBA game ${apiSportsGameId}`);
        return;
      }

      const gameData = gameResponse.response[0];
      const game = await this.findGameByApiId(apiSportsGameId);

      if (!game) {
        logger.warn(`Game not found in database for API-Sports ID: ${apiSportsGameId}`);
        return;
      }

      for (const side of ['home', 'away'] as const) {
        const team = await this.resolveTeam(gameData.teams[side]);
        if (!team) continue;

        const score = gameData.scores[side];

        await this.upsertGameStats({
          gameId: game.id,
          teamId: team.id,
          isHome: side === 'home',
          quarterScores: [
            score.quarter_1,
            score.quarter_2,
            score.quarter_3,
            score.quarter_4,
            score.over_time,
          ].filter((value): value is number => value !== null),
          stats: { points: score.total },
        });
      }

      await this.syncPlayerStatsForGame(apiSportsGameId, game.id);

      logger.info(`Successfully synced stats for NBA game ${apiSportsGameId}`);
    } catch (error) {
      logger.error(`Failed to sync NBA game stats: ${error}`);
      throw error;
    }
  }

  /**
   * NBA player stats come from a per-game endpoint keyed by the internal game
   * id, so this runs as part of `syncGameStats` rather than standalone.
   */
  private async syncPlayerStatsForGame(apiSportsGameId: string, internalGameId: string): Promise<void> {
    try {
      const statsResponse = await this.client.get<ApiSportsResponse<any>>('/games/statistics', {
        id: apiSportsGameId,
      });

      if (!statsResponse.response?.length) {
        return;
      }

      for (const teamData of statsResponse.response) {
        const team = await this.findTeamByName(teamData.team.name);
        if (!team) continue;

        for (const playerData of teamData.statistics || []) {
          const player = await this.upsertPlayer({
            externalId: playerData.player.id?.toString(),
            fullName: playerData.player.name,
            teamId: team.id,
            position: playerData.pos || null,
          });

          await this.upsertPlayerGameStats({
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
          });
        }
      }
    } catch (error) {
      logger.error(`Failed to sync NBA player stats: ${error}`);
    }
  }
}
