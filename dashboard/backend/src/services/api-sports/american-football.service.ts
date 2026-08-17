import { ApiSportsResponse } from './client';
import { ScheduledStatsService, StatsServiceConfig } from './base-stats.service';
import { upsertApiSportsGame } from './game-resolver';
import { mapApiStatusToLocal, resolveAmericanFootballSeason } from './status';
import { logger } from '../../config/logger';

/**
 * A `/games` entry from the API-Sports american-football host. NFL (league 1)
 * and NCAAF (league 2) share this host and therefore this payload shape.
 */
export interface AmericanFootballGame {
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
    venue?: {
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
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  scores: {
    home: AmericanFootballTeamScore;
    away: AmericanFootballTeamScore;
  };
}

interface AmericanFootballTeamScore {
  quarter_1: number | null;
  quarter_2: number | null;
  quarter_3: number | null;
  quarter_4: number | null;
  overtime: number | null;
  total: number | null;
}

/**
 * Schedule handling shared by NFL and NCAAF. Both read the same `/games`
 * payload, so game reconciliation, season labelling, and date-range walking
 * are identical; only the `/games/statistics` shape differs, which is why
 * `syncGameStats` stays abstract.
 */
export abstract class AmericanFootballStatsService extends ScheduledStatsService<AmericanFootballGame> {
  protected constructor(config: Omit<StatsServiceConfig, 'apiSport'>) {
    super({ ...config, apiSport: 'american-football' });
  }

  extractGameId(game: AmericanFootballGame): string {
    return game.game.id.toString();
  }

  protected resolveSeasonForDate(date: Date): number {
    return resolveAmericanFootballSeason(date);
  }

  protected getGameStatus(game: AmericanFootballGame): string {
    return mapApiStatusToLocal(game.game.status);
  }

  async getGamesByDate(date: string, season?: number): Promise<AmericanFootballGame[]> {
    const resolvedSeason = season ?? this.resolveSeasonForDate(new Date(date));

    const response = await this.client.get<ApiSportsResponse<AmericanFootballGame>>('/games', {
      league: this.leagueId,
      season: resolvedSeason,
      date,
    });

    return response.response || [];
  }

  protected async upsertGameFromApi(gameData: AmericanFootballGame): Promise<string | null> {
    const homeTeam = await this.resolveTeam(gameData.teams.home);
    const awayTeam = await this.resolveTeam(gameData.teams.away);

    const commenceTime = new Date(gameData.game.date.timestamp * 1000);
    if (Number.isNaN(commenceTime.getTime())) {
      logger.warn(`Skipping ${this.label} game ${gameData.game.id} due to invalid date value`);
      return null;
    }

    const seasonValue =
      gameData.league?.season?.toString() || this.resolveSeasonForDate(commenceTime).toString();

    return upsertApiSportsGame({
      sportKey: this.sportKey!,
      apiSportsGameId: gameData.game.id.toString(),
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

  /** The `/games` payload carries no team statistics — refetch per game. */
  protected async syncStatsForGame(game: AmericanFootballGame): Promise<void> {
    await this.syncGameStats(this.extractGameId(game));
  }
}
