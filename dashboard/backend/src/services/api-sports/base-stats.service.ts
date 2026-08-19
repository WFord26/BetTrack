import { Prisma } from '@prisma/client';
import { ApiSportsClient, ApiSportsResponse, ApiSportsSport } from './client';
import { resolveApiSportsTeam } from './game-resolver';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { env } from '../../config/env';

/**
 * A `/teams` entry. Only `id` and `name` are guaranteed; the rest vary by
 * sport host (baseball has no `code`, american-football sometimes uses
 * `alias`), so each service narrows what it stores via `mapApiTeam`.
 */
export interface ApiSportsTeamPayload {
  id: number;
  name: string;
  code?: string;
  alias?: string;
  logo?: string;
  national?: boolean;
}

/** The subset of Team columns a `/teams` sync is allowed to overwrite. */
export interface TeamRecordUpdate {
  name: string;
  abbreviation?: string | null;
  logoUrl: string | null;
}

/** The `TeamStats` columns a `/teams/statistics` sync is allowed to write. */
export interface TeamSeasonStats {
  offense: Prisma.InputJsonValue;
  defense: Prisma.InputJsonValue;
  standings: Prisma.InputJsonValue;
  gamesPlayed: number;
}

/**
 * API-Sports reports counts as numbers but percentages and averages as
 * strings ("0.585", "112.4"), and omits blocks entirely for a team that has
 * not played yet. Coerce to a number so a missing or unparseable value stores
 * 0 rather than null or NaN.
 */
export function toStatNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

/**
 * `/teams/statistics` breaks the usual envelope: most hosts return a single
 * object where every other endpoint returns an array. Accept either.
 */
function unwrapTeamStatsPayload(response: { response?: unknown } | undefined): any | null {
  const payload = response?.response;

  if (Array.isArray(payload)) {
    return payload[0] ?? null;
  }

  return payload && typeof payload === 'object' ? payload : null;
}

export interface DateSyncResult {
  processed: number;
  updated: number;
  skipped: number;
  requestsRemaining?: number;
}

export interface StatsServiceConfig {
  /** Human-readable name used in log lines and sync errors, e.g. "NFL". */
  label: string;
  /** API-Sports host family. */
  apiSport: ApiSportsSport;
  /**
   * Internal `Sport.key`, e.g. "americanfootball_nfl". Omitted for services
   * that span several internal sports (soccer covers EPL, MLS, UCL, ...);
   * their team/game lookups then run unscoped, as they always have.
   */
  sportKey?: string;
  /**
   * API-Sports league id within the host. Omitted for multi-league services.
   */
  leagueId?: number;
}

/**
 * Shared machinery for the API-Sports stats services.
 *
 * The seven sports differ in their upstream response shapes, so mapping a
 * payload to `GameStats`/`PlayerGameStats` stays in the per-sport subclass.
 * Everything that is *not* shape-specific — client construction, quota
 * accounting, live-game fetching, team sync, and the handful of Prisma
 * lookups/upserts every sport repeats — lives here.
 *
 * `TGame` is the sport's own `/games` (or `/fixtures`) entry type.
 */
export abstract class BaseStatsService<TGame> {
  readonly label: string;
  readonly sportKey?: string;
  protected readonly leagueId?: number;
  protected readonly client: ApiSportsClient;

  constructor(config: StatsServiceConfig) {
    if (!env.API_SPORTS_KEY) {
      throw new Error(`API_SPORTS_KEY is required for ${config.label} stats sync`);
    }

    this.label = config.label;
    this.sportKey = config.sportKey;
    this.leagueId = config.leagueId;
    this.client = new ApiSportsClient({
      apiKey: env.API_SPORTS_KEY,
      sport: config.apiSport,
      tier: env.API_SPORTS_TIER,
    });
  }

  // ─── Per-sport contract ─────────────────────────────────────────────────

  /** Pull the API-Sports game id out of a game payload. */
  abstract extractGameId(game: TGame): string;

  /** Fetch and persist team-level stats for one API-Sports game id. */
  abstract syncGameStats(externalGameId: string): Promise<void>;

  /**
   * Fetch and persist player-level stats. Defaults to a no-op: several sports
   * either fold player stats into `syncGameStats` or have no player endpoint.
   */
  async syncPlayerStats(_externalGameId: string): Promise<void> {
    // no-op by default
  }

  // ─── Overridable defaults ───────────────────────────────────────────────

  /** `/games` for most hosts; API-Football calls it `/fixtures`. */
  protected get gamesEndpoint(): string {
    return '/games';
  }

  /** Query params merged over `{ live: 'all' }` for the live-games request. */
  protected liveGameParams(): Record<string, unknown> {
    return { league: this.leagueId };
  }

  /** Query params for the `/teams` request. */
  protected teamsParams(season: number | string): Record<string, unknown> {
    return { league: this.leagueId, season };
  }

  /** Extra `/teams/statistics` params beyond `id` and `season`. */
  protected teamStatsParams(): Record<string, unknown> {
    return { league: this.leagueId };
  }

  /**
   * Season used when `syncTeams` is called without one. Number for sports
   * whose season is a single year, `"2024-2025"` for basketball.
   */
  protected defaultTeamSeason(): number | string {
    return new Date().getFullYear() - 2;
  }

  /**
   * Season label for a date. Sports whose season straddles the new year
   * override this (see `resolveAmericanFootballSeason`).
   */
  protected resolveSeasonForDate(date: Date): number {
    return date.getFullYear();
  }

  /** Drop non-team entries the upstream `/teams` endpoint mixes in. */
  protected filterApiTeams(teams: ApiSportsTeamPayload[]): ApiSportsTeamPayload[] {
    return teams;
  }

  /** Narrow a `/teams` entry to the columns this sport actually supplies. */
  protected mapApiTeam(team: ApiSportsTeamPayload): TeamRecordUpdate {
    return {
      name: team.name,
      abbreviation: team.code || null,
      logoUrl: team.logo || null,
    };
  }

  /**
   * Query param naming the team on `/teams/statistics`. The american-football
   * and baseball hosts call it `id`; basketball, hockey and API-Football all
   * call it `team`.
   */
  protected get teamStatsIdParam(): string {
    return 'id';
  }

  /**
   * The season as `/teams/statistics` wants it. Basketball overrides this —
   * its seasons are labelled by the pair of years they span.
   */
  protected formatStatsSeason(season: number): string | number {
    return season.toString();
  }

  /**
   * Map a `/teams/statistics` payload onto the TeamStats columns. The default
   * reads the american-football shape; the other hosts report their own.
   */
  protected mapTeamSeasonStats(teamData: any): TeamSeasonStats {
    return {
      offense: teamData.offense || {},
      defense: teamData.defense || {},
      standings: {
        wins: teamData.wins || 0,
        losses: teamData.losses || 0,
        ties: teamData.ties || 0,
      },
      gamesPlayed: teamData.games_played || 0,
    };
  }

  /**
   * Locate the internal Team row a `/teams/statistics` payload belongs to.
   * Sports whose teams come from `/teams` key on the upstream id; soccer,
   * whose teams are never synced that way, overrides.
   */
  protected findTeamForStats(apiSportsTeamId: number) {
    return this.findTeamByApiId(apiSportsTeamId);
  }

  // ─── Quota ──────────────────────────────────────────────────────────────

  getRequestsRemaining(): number | undefined {
    return this.client.getLastRemainingRequests();
  }

  hasSufficientQuota(minimumRemaining: number): boolean {
    return this.client.hasSufficientRemaining(minimumRemaining);
  }

  // ─── Live games ─────────────────────────────────────────────────────────

  /**
   * Live games as raw upstream payloads. Never throws — a sport that is out
   * of season or erroring must not abort the other six.
   */
  async getLiveGames(): Promise<TGame[]> {
    try {
      const response = await this.client.get<ApiSportsResponse<TGame>>(this.gamesEndpoint, {
        live: 'all',
        ...this.liveGameParams(),
      });

      const games = response.response || [];
      logger.info(`Found ${games.length} live ${this.label} games`);

      return games;
    } catch (error) {
      logger.error(`Failed to fetch live ${this.label} games: ${error}`);
      return [];
    }
  }

  async getLiveGameIds(): Promise<string[]> {
    const games = await this.getLiveGames();
    return games.map(game => this.extractGameId(game));
  }

  // ─── Team sync ──────────────────────────────────────────────────────────

  async syncTeams(season: number | string = this.defaultTeamSeason()): Promise<number> {
    if (!this.sportKey || this.leagueId === undefined) {
      logger.warn(`${this.label} spans multiple leagues — /teams sync is not supported`);
      return 0;
    }

    try {
      logger.info(`Syncing ${this.label} teams for season ${season}`);

      const response = await this.client.get<ApiSportsResponse<ApiSportsTeamPayload>>(
        '/teams',
        this.teamsParams(season)
      );

      if (!response.response?.length) {
        logger.warn(`No ${this.label} teams returned from API-Sports`);
        return 0;
      }

      const sport = await prisma.sport.findUnique({ where: { key: this.sportKey } });
      if (!sport) {
        logger.error(`Sport "${this.sportKey}" not found. Run /api/admin/init-sports first.`);
        return 0;
      }

      let count = 0;
      for (const team of this.filterApiTeams(response.response)) {
        const data = this.mapApiTeam(team);

        const existing = await prisma.team.findFirst({
          where: { apiSportsTeamId: team.id, sportId: sport.id },
        });

        if (existing) {
          await prisma.team.update({ where: { id: existing.id }, data });
        } else {
          await prisma.team.create({
            data: { sportId: sport.id, apiSportsTeamId: team.id, ...data },
          });
        }
        count++;
      }

      logger.info(`Synced ${count} ${this.label} teams for season ${season}`);
      return count;
    } catch (error) {
      logger.error(`Failed to sync ${this.label} teams: ${error}`);
      throw error;
    }
  }

  /**
   * Sync a team's season totals from `/teams/statistics`.
   *
   * `apiSportsTeamId` is the upstream team id — teams are stored against it by
   * `syncTeams`, so that (not `Team.externalId`, which holds The Odds API id)
   * is what the lookup keys on.
   */
  async syncTeamStats(apiSportsTeamId: number, season: number): Promise<void> {
    if (!this.sportKey) {
      logger.warn(`${this.label} spans multiple leagues — team stats sync needs an explicit league`);
      return;
    }

    await this.runTeamStatsSync({
      apiSportsTeamId,
      season,
      sportKey: this.sportKey,
      params: this.teamStatsParams(),
    });
  }

  /**
   * The body of a `/teams/statistics` sync, with the target sport key and
   * league params supplied by the caller so a multi-league service can pick
   * one league per call.
   */
  protected async runTeamStatsSync(input: {
    apiSportsTeamId: number;
    season: number;
    sportKey: string;
    params: Record<string, unknown>;
  }): Promise<void> {
    const { apiSportsTeamId, season, sportKey } = input;

    try {
      const response = await this.client.get<ApiSportsResponse<any>>('/teams/statistics', {
        [this.teamStatsIdParam]: apiSportsTeamId,
        season: this.formatStatsSeason(season),
        ...input.params,
      });

      const teamData = unwrapTeamStatsPayload(response);

      if (!teamData) {
        logger.warn(`No team stats found for ${this.label} team ${apiSportsTeamId}`);
        return;
      }

      const team = await this.findTeamForStats(apiSportsTeamId);

      if (!team) {
        logger.warn(`Team not found: ${apiSportsTeamId}`);
        return;
      }

      const stats = this.mapTeamSeasonStats(teamData);

      await prisma.teamStats.upsert({
        where: {
          teamId_season_seasonType: { teamId: team.id, season, seasonType: 'regular' },
        },
        create: {
          teamId: team.id,
          sportKey,
          season,
          seasonType: 'regular',
          ...stats,
        },
        update: { ...stats, lastUpdated: new Date() },
      });

      logger.info(`Successfully synced team stats for ${this.label} team ${apiSportsTeamId}`);
    } catch (error) {
      logger.error(`Failed to sync ${this.label} team stats: ${error}`);
      throw error;
    }
  }

  // ─── Shared lookups ─────────────────────────────────────────────────────

  /** Scopes lookups to this sport; empty for multi-league services. */
  protected get sportFilter(): { sport?: { key: string } } {
    return this.sportKey ? { sport: { key: this.sportKey } } : {};
  }

  protected findTeamByName(teamName: string) {
    return prisma.team.findFirst({
      where: {
        name: { contains: teamName, mode: 'insensitive' },
        ...this.sportFilter,
      },
    });
  }

  /**
   * A missing id returns null rather than querying on `undefined` — Prisma
   * drops undefined filters, which would otherwise match an arbitrary team.
   */
  protected async findTeamByApiId(apiSportsTeamId: number | undefined | null) {
    if (apiSportsTeamId === undefined || apiSportsTeamId === null) {
      return null;
    }

    return prisma.team.findFirst({
      where: { apiSportsTeamId, ...this.sportFilter },
    });
  }

  /** Prefer the API-Sports team id, fall back to a name match. */
  protected resolveTeam(apiTeam: { id: number; name: string }) {
    if (!this.sportKey) {
      return this.findTeamByName(apiTeam.name);
    }
    return resolveApiSportsTeam(apiTeam, this.sportKey);
  }

  /**
   * Locate the internal Game row for an API-Sports game id.
   *
   * Games reconciled by `upsertApiSportsGame` carry the id in
   * `apiSportsGameId`; standalone rows created before that reconciliation
   * existed carry it in `externalId`. Check both, upstream id first.
   */
  protected async findGameByApiId(apiSportsGameId: string) {
    const byApiId = await prisma.game.findFirst({
      where: { apiSportsGameId, ...this.sportFilter },
    });
    if (byApiId) return byApiId;

    return prisma.game.findFirst({
      where: { externalId: apiSportsGameId, ...this.sportFilter },
    });
  }

  /** As `findGameByApiId`, with both team relations loaded. */
  protected async findGameWithTeamsByApiId(apiSportsGameId: string) {
    const byApiId = await prisma.game.findFirst({
      where: { apiSportsGameId, ...this.sportFilter },
      include: { homeTeam: true, awayTeam: true },
    });
    if (byApiId) return byApiId;

    return prisma.game.findFirst({
      where: { externalId: apiSportsGameId, ...this.sportFilter },
      include: { homeTeam: true, awayTeam: true },
    });
  }

  // ─── Shared writes ──────────────────────────────────────────────────────

  protected async upsertGameStats(input: {
    gameId: string;
    teamId: number;
    isHome: boolean;
    quarterScores: number[];
    stats: Prisma.InputJsonValue;
  }): Promise<void> {
    await prisma.gameStats.upsert({
      where: { gameId_teamId: { gameId: input.gameId, teamId: input.teamId } },
      create: {
        gameId: input.gameId,
        teamId: input.teamId,
        isHome: input.isHome,
        quarterScores: input.quarterScores,
        stats: input.stats,
      },
      update: {
        quarterScores: input.quarterScores,
        stats: input.stats,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Find-or-create the Player row for an API-Sports player, refreshing name
   * and team on the way through.
   *
   * A missing `externalId` skips the lookup entirely rather than querying on
   * `undefined` — Prisma drops undefined filters, which would otherwise match
   * an arbitrary unrelated player.
   */
  protected async upsertPlayer(input: {
    externalId?: string;
    fullName: string;
    teamId: number;
    position?: string | null;
  }) {
    const parts = input.fullName.split(' ');
    const data = {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      teamId: input.teamId,
      ...(input.position !== undefined ? { position: input.position } : {}),
    };

    const existing = input.externalId
      ? await prisma.player.findFirst({ where: { externalId: input.externalId } })
      : null;

    if (existing) {
      return prisma.player.update({ where: { id: existing.id }, data });
    }

    return prisma.player.create({
      data: { externalId: input.externalId || null, ...data },
    });
  }

  protected async upsertPlayerGameStats(input: {
    gameId: string;
    playerId: number;
    teamId: number;
    stats: Prisma.InputJsonValue;
    started?: boolean;
    minutesPlayed?: string | null;
  }): Promise<void> {
    await prisma.playerGameStats.upsert({
      where: { gameId_playerId: { gameId: input.gameId, playerId: input.playerId } },
      create: {
        gameId: input.gameId,
        playerId: input.playerId,
        teamId: input.teamId,
        stats: input.stats,
        ...(input.started !== undefined ? { started: input.started } : {}),
        ...(input.minutesPlayed !== undefined ? { minutesPlayed: input.minutesPlayed } : {}),
      },
      update: {
        stats: input.stats,
        ...(input.minutesPlayed !== undefined ? { minutesPlayed: input.minutesPlayed } : {}),
      },
    });
  }
}

/**
 * A stats service that can also walk a date range — used by the backfill jobs
 * in `StatsSyncService`. Kept separate from `BaseStatsService` so sports
 * without a usable dated `/games` query don't inherit an API they can't honour.
 */
export abstract class ScheduledStatsService<TGame> extends BaseStatsService<TGame> {
  abstract getGamesByDate(date: string, season?: number): Promise<TGame[]>;

  /** This sport's status block translated to our `Game.status` vocabulary. */
  protected abstract getGameStatus(game: TGame): string;

  /** Reconcile the game onto its internal Game row. */
  protected abstract upsertGameFromApi(game: TGame): Promise<string | null>;

  /**
   * Persist team stats for a game already in hand. Sports whose `/games`
   * payload carries the scores use it directly; the rest re-fetch via
   * `syncGameStats`.
   */
  protected abstract syncStatsForGame(game: TGame): Promise<void>;

  async syncGamesForDate(date: string, minimumRemaining: number): Promise<DateSyncResult> {
    const result: DateSyncResult = { processed: 0, updated: 0, skipped: 0 };

    if (!this.hasSufficientQuota(minimumRemaining)) {
      result.requestsRemaining = this.getRequestsRemaining();
      return result;
    }

    const games = await this.getGamesByDate(date);
    result.processed = games.length;

    for (const game of games) {
      await this.upsertGameFromApi(game);

      const status = this.getGameStatus(game);
      if (status === 'live' || status === 'completed') {
        await this.syncStatsForGame(game);
        result.updated++;
      } else {
        result.skipped++;
      }
    }

    result.requestsRemaining = this.getRequestsRemaining();
    return result;
  }
}
