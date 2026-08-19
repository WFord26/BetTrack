import { BaseStatsService, StatsServiceConfig, TeamSeasonStats, toStatNumber } from './base-stats.service';

/** A `{ home, away, all }` count block from the basketball host. */
interface SplitTotals {
  home?: number | null;
  away?: number | null;
  all?: number | null;
}

/** As `SplitTotals`, but averages arrive as strings ("112.4"). */
interface SplitAverages {
  home?: number | string | null;
  away?: number | string | null;
  all?: number | string | null;
}

/** A win/loss/draw block, each split carrying a total and a percentage. */
interface SplitRecord {
  home?: { total?: number | null; percentage?: number | string | null };
  away?: { total?: number | null; percentage?: number | string | null };
  all?: { total?: number | null; percentage?: number | string | null };
}

/** The `/teams/statistics` payload from the API-Sports basketball host. */
export interface BasketballTeamStatistics {
  games?: {
    played?: SplitTotals;
    wins?: SplitRecord;
    draws?: SplitRecord;
    /** API-Sports spells it "loses". */
    loses?: SplitRecord;
  };
  points?: {
    for?: { total?: SplitTotals; average?: SplitAverages };
    against?: { total?: SplitTotals; average?: SplitAverages };
  };
}

/**
 * Season handling and season-stats mapping shared by the two basketball
 * leagues, NBA and NCAAB.
 *
 * Both sit on the API-Sports basketball host, so they label seasons the same
 * way and return the same `/teams/statistics` shape; only the per-game
 * payloads differ, which is why `syncGameStats` stays abstract.
 */
export abstract class BasketballStatsService<TGame> extends BaseStatsService<TGame> {
  protected constructor(config: Omit<StatsServiceConfig, 'apiSport'>) {
    super({ ...config, apiSport: 'basketball' });
  }

  /** Basketball seasons are labelled by the pair of years they span. */
  protected defaultTeamSeason(): string {
    const year = new Date().getFullYear();
    return `${year - 1}-${year}`;
  }

  protected formatStatsSeason(season: number): string {
    return `${season}-${season + 1}`;
  }

  protected get teamStatsIdParam(): string {
    return 'team';
  }

  protected mapTeamSeasonStats(teamData: BasketballTeamStatistics): TeamSeasonStats {
    const games = teamData.games || {};
    const points = teamData.points || {};

    return {
      offense: {
        points: toStatNumber(points.for?.total?.all),
        pointsPerGame: toStatNumber(points.for?.average?.all),
        pointsHome: toStatNumber(points.for?.total?.home),
        pointsAway: toStatNumber(points.for?.total?.away),
      },
      defense: {
        pointsAllowed: toStatNumber(points.against?.total?.all),
        pointsAllowedPerGame: toStatNumber(points.against?.average?.all),
        pointsAllowedHome: toStatNumber(points.against?.total?.home),
        pointsAllowedAway: toStatNumber(points.against?.total?.away),
      },
      standings: {
        wins: toStatNumber(games.wins?.all?.total),
        losses: toStatNumber(games.loses?.all?.total),
        // The host returns a draws block for every sport on it; for basketball
        // it is always zero, but store it so the shape matches the others.
        ties: toStatNumber(games.draws?.all?.total),
        winPct: toStatNumber(games.wins?.all?.percentage),
        homeWins: toStatNumber(games.wins?.home?.total),
        awayWins: toStatNumber(games.wins?.away?.total),
      },
      gamesPlayed: toStatNumber(games.played?.all),
    };
  }
}
