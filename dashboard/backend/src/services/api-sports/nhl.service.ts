import { ApiSportsResponse } from './client';
import { BaseStatsService, TeamSeasonStats, toStatNumber } from './base-stats.service';
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

/** A `{ home, away, all }` count block from the hockey host. */
interface SplitTotals {
  home?: number | null;
  away?: number | null;
  all?: number | null;
}

/** As `SplitTotals`, but averages arrive as strings ("3.1"). */
interface SplitAverages {
  home?: number | string | null;
  away?: number | string | null;
  all?: number | string | null;
}

/** A win/loss block, each split carrying a total and a percentage. */
interface SplitRecord {
  home?: { total?: number | null; percentage?: number | string | null };
  away?: { total?: number | null; percentage?: number | string | null };
  all?: { total?: number | null; percentage?: number | string | null };
}

/** The `/teams/statistics` payload from the API-Sports hockey host. */
interface NHLTeamStatistics {
  games?: {
    played?: SplitTotals;
    wins?: SplitRecord;
    /** API-Sports spells it "loses". */
    loses?: SplitRecord;
    /** Hockey settles ties in overtime, so these are reported separately. */
    wins_overtime?: SplitRecord;
    loses_overtime?: SplitRecord;
    draws?: SplitRecord;
  };
  goals?: {
    for?: { total?: SplitTotals; average?: SplitAverages };
    against?: { total?: SplitTotals; average?: SplitAverages };
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

  protected get teamStatsIdParam(): string {
    return 'team';
  }

  protected mapTeamSeasonStats(teamData: NHLTeamStatistics): TeamSeasonStats {
    const games = teamData.games || {};
    const goals = teamData.goals || {};

    return {
      offense: {
        goals: toStatNumber(goals.for?.total?.all),
        goalsPerGame: toStatNumber(goals.for?.average?.all),
        goalsHome: toStatNumber(goals.for?.total?.home),
        goalsAway: toStatNumber(goals.for?.total?.away),
      },
      defense: {
        goalsAgainst: toStatNumber(goals.against?.total?.all),
        goalsAgainstPerGame: toStatNumber(goals.against?.average?.all),
        goalsAgainstHome: toStatNumber(goals.against?.total?.home),
        goalsAgainstAway: toStatNumber(goals.against?.total?.away),
      },
      standings: {
        // The host counts regulation and overtime results separately. Keep
        // them apart: an overtime loss is worth a standings point, and folding
        // it into `losses` would misstate the record.
        wins: toStatNumber(games.wins?.all?.total),
        losses: toStatNumber(games.loses?.all?.total),
        overtimeWins: toStatNumber(games.wins_overtime?.all?.total),
        overtimeLosses: toStatNumber(games.loses_overtime?.all?.total),
        ties: toStatNumber(games.draws?.all?.total),
        winPct: toStatNumber(games.wins?.all?.percentage),
      },
      gamesPlayed: toStatNumber(games.played?.all),
    };
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
