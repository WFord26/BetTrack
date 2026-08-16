import { ApiSportsResponse } from './client';
import { BaseStatsService } from './base-stats.service';
import { logger } from '../../config/logger';

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
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
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

/** Period scores arrive as "2-1" strings; pull out one side's goal count. */
function parsePeriodScore(score: string | null | undefined): number {
  if (!score) return 0;
  const match = score.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

export class NHLStatsService extends BaseStatsService<NHLGame> {
  constructor() {
    super({
      label: 'NHL',
      sportKey: 'icehockey_nhl',
      apiSport: 'hockey',
      leagueId: 57,
    });
  }

  extractGameId(game: NHLGame): string {
    return game.id.toString();
  }

  protected liveGameParams(): Record<string, unknown> {
    return { league: this.leagueId, season: new Date().getFullYear().toString() };
  }

  async syncGameStats(apiSportsGameId: string): Promise<void> {
    try {
      logger.info(`Syncing NHL game stats for API-Sports ID: ${apiSportsGameId}`);

      const gameResponse = await this.client.get<ApiSportsResponse<NHLGame>>('/games', {
        id: apiSportsGameId,
      });

      if (!gameResponse.response?.length) {
        logger.warn(`No game found for NHL game ${apiSportsGameId}`);
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

        // "2-1" — index 0 is the home half of the period score, 1 the away.
        const half = side === 'home' ? 0 : 1;

        await this.upsertGameStats({
          gameId: game.id,
          teamId: team.id,
          isHome: side === 'home',
          quarterScores: [
            parsePeriodScore(gameData.periods.first?.split('-')[half]),
            parsePeriodScore(gameData.periods.second?.split('-')[half]),
            parsePeriodScore(gameData.periods.third?.split('-')[half]),
          ],
          stats: { goals: gameData.scores[side] },
        });
      }

      logger.info(`Successfully synced stats for NHL game ${apiSportsGameId}`);
    } catch (error) {
      logger.error(`Failed to sync NHL game stats: ${error}`);
      throw error;
    }
  }
}
