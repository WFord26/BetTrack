import { ApiSportsResponse } from './client';
import {
  ApiSportsTeamPayload,
  DateSyncResult,
  ScheduledStatsService,
  TeamRecordUpdate,
} from './base-stats.service';
import { upsertApiSportsGame } from './game-resolver';
import { mapApiStatusToLocal } from './status';
import { logger } from '../../config/logger';

export type MLBDateSyncResult = DateSyncResult;

interface MLBTeamScore {
  innings: Record<string, number | null>;
  hits: number | null;
  errors: number | null;
  total: number | null;
}

interface MLBGame {
  id: number;
  league?: {
    id: number;
    season: number;
  };
  date: string;
  time?: string;
  timestamp?: number;
  timezone?: string;
  season?: string;
  status: {
    long: string;
    short: string;
  };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  scores: {
    home: MLBTeamScore;
    away: MLBTeamScore;
  };
}

export class MLBStatsService extends ScheduledStatsService<MLBGame> {
  constructor() {
    super({
      label: 'MLB',
      sportKey: 'baseball_mlb',
      apiSport: 'baseball',
      leagueId: 1,
    });
  }

  extractGameId(game: MLBGame): string {
    return game.id.toString();
  }

  protected liveGameParams(): Record<string, unknown> {
    return { league: this.leagueId, season: new Date().getFullYear() };
  }

  /** The baseball host reports no team code, so leave `abbreviation` alone. */
  protected mapApiTeam(team: ApiSportsTeamPayload): TeamRecordUpdate {
    return { name: team.name, logoUrl: team.logo || null };
  }

  /** Drop conference entries ("American League", "National League"). */
  protected filterApiTeams(teams: ApiSportsTeamPayload[]): ApiSportsTeamPayload[] {
    return teams.filter(team => !team.name.endsWith('League'));
  }

  protected getGameStatus(game: MLBGame): string {
    return mapApiStatusToLocal(game.status);
  }

  async getGamesByDate(date: string, season?: number): Promise<MLBGame[]> {
    const resolvedSeason = season ?? this.resolveSeasonForDate(new Date(date));

    const response = await this.client.get<ApiSportsResponse<MLBGame>>('/games', {
      league: this.leagueId,
      season: resolvedSeason,
      date,
    });

    return response.response || [];
  }

  async syncGameStats(apiSportsGameId: string): Promise<void> {
    try {
      logger.info(`Syncing MLB game stats for API-Sports ID: ${apiSportsGameId}`);

      const gameResponse = await this.client.get<ApiSportsResponse<MLBGame>>('/games', {
        id: apiSportsGameId,
      });

      if (!gameResponse.response?.length) {
        logger.warn(`No game found for MLB game ${apiSportsGameId}`);
        return;
      }

      const gameData = gameResponse.response[0];

      await this.upsertGameFromApi(gameData);
      await this.syncStatsForGame(gameData);

      logger.info(`Successfully synced stats for MLB game ${apiSportsGameId}`);
    } catch (error) {
      logger.error(`Failed to sync MLB game stats: ${error}`);
      throw error;
    }
  }

  protected async upsertGameFromApi(gameData: MLBGame): Promise<string | null> {
    const homeTeam = await this.resolveTeam(gameData.teams.home);
    const awayTeam = await this.resolveTeam(gameData.teams.away);

    const seasonValue =
      gameData.league?.season?.toString() ||
      gameData.season ||
      new Date(gameData.date).getFullYear().toString();

    const commenceTime = new Date(gameData.date);
    if (Number.isNaN(commenceTime.getTime())) {
      logger.warn(`Skipping MLB game ${gameData.id} due to invalid date value: ${gameData.date}`);
      return null;
    }

    return upsertApiSportsGame({
      sportKey: this.sportKey!,
      apiSportsGameId: gameData.id.toString(),
      apiSportsLeagueId: this.leagueId!,
      homeTeamName: gameData.teams.home.name,
      awayTeamName: gameData.teams.away.name,
      homeTeamId: homeTeam?.id,
      awayTeamId: awayTeam?.id,
      commenceTime,
      season: seasonValue,
      status: this.getGameStatus(gameData),
      homeScore: gameData.scores.home.total,
      awayScore: gameData.scores.away.total,
    });
  }

  /** The `/games` payload carries inning-by-inning scores — no refetch needed. */
  protected async syncStatsForGame(gameData: MLBGame): Promise<void> {
    const game = await this.findGameByApiId(gameData.id.toString());

    if (!game) {
      logger.warn(`Game not found in database for API-Sports ID: ${gameData.id}`);
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
        quarterScores: Object.values(score.innings ?? {}).filter(
          (value): value is number => value !== null
        ),
        stats: {
          hits: score.hits,
          errors: score.errors,
          total: score.total,
        },
      });
    }
  }
}
