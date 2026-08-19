import { ApiSportsResponse } from './client';
import { BaseStatsService } from './base-stats.service';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

// ─── API-Football response shapes ─────────────────────────────────────────────
// Every field is optional: the upstream payload varies by endpoint and fixture
// state, and the code below already falls back for anything missing.

interface FixtureTeam {
  id?: number;
  name?: string;
}

interface Fixture {
  fixture?: {
    id?: number;
    date?: string;
    status?: { long?: string; short?: string };
  };
  league?: { id?: number; name?: string };
  teams?: { home?: FixtureTeam; away?: FixtureTeam };
  goals?: { home?: number | null; away?: number | null };
}

/** One `{ type, value }` pair from /fixtures/statistics. */
interface TeamStatistic {
  type?: string;
  value?: string | number | null;
}

interface TeamStatisticsEntry {
  team?: FixtureTeam;
  statistics?: TeamStatistic[];
}

/** A single player's stat block from /fixtures/players. */
interface PlayerStatistics {
  games?: { position?: string; rating?: string | null; minutes?: number | null };
  goals?: { total?: number | null; assists?: number | null };
  shots?: { total?: number | null; on?: number | null };
  passes?: { total?: number | null; key?: number | null; accuracy?: number | string | null };
  dribbles?: { attempts?: number | null; success?: number | null };
  duels?: { total?: number | null; won?: number | null };
  tackles?: { total?: number | null; interceptions?: number | null };
  fouls?: { drawn?: number | null; committed?: number | null };
  cards?: { yellow?: number | null; red?: number | null };
  goalkeeper?: { saves?: number | null; conceded?: number | null };
}

interface FixturePlayer {
  player?: { id?: number; name?: string };
  statistics?: PlayerStatistics[];
}

interface FixturePlayersEntry {
  team?: FixtureTeam;
  players?: FixturePlayer[];
}

/**
 * Soccer stats service, covering several leagues (EPL, MLS, UEFA, ...) at
 * once.
 *
 * Unlike the other sports this maps to no single internal `Sport.key` and no
 * single API-Sports league, so it opts out of the base class's sport-scoped
 * lookups and `/teams` sync, and overrides the live-games fetch to fan out
 * across its league list.
 */
export class SoccerService extends BaseStatsService<Fixture> {
  // Common soccer league IDs from API-Sports
  private leagueIds = {
    EPL: 39,        // English Premier League
    LaLiga: 140,    // Spanish La Liga
    SerieA: 135,    // Italian Serie A
    Bundesliga: 78, // German Bundesliga
    Ligue1: 61,     // French Ligue 1
    MLS: 253,       // Major League Soccer
    UCL: 2,         // UEFA Champions League
  };

  constructor() {
    super({ label: 'Soccer', apiSport: 'football' });
  }

  protected get gamesEndpoint(): string {
    return '/fixtures';
  }

  extractGameId(fixture: Fixture): string {
    return String(fixture.fixture?.id);
  }

  /** One live query per configured league — API-Football has no all-league filter. */
  async getLiveGames(): Promise<Fixture[]> {
    try {
      const allGames: Fixture[] = [];

      for (const leagueId of Object.values(this.leagueIds)) {
        const response = await this.client.get<ApiSportsResponse<Fixture>>(this.gamesEndpoint, {
          league: leagueId,
          live: 'all',
        });

        allGames.push(...(response.response || []));
      }

      logger.info(`Found ${allGames.length} live Soccer games`);
      return allGames;
    } catch (error) {
      logger.error('Error fetching live soccer games:', error);
      return [];
    }
  }

  async syncGameStats(externalGameId: string): Promise<void> {
    try {
      const game = await this.findGameWithTeamsByApiId(externalGameId);

      if (!game) {
        logger.warn(`Game not found: ${externalGameId}`);
        return;
      }

      const response = await this.client.get<ApiSportsResponse<TeamStatisticsEntry>>(
        '/fixtures/statistics',
        { fixture: externalGameId }
      );

      const statsData = response.response || [];
      if (statsData.length === 0) {
        logger.warn(`No stats data for game: ${externalGameId}`);
        return;
      }

      for (const teamData of statsData) {
        if (!game.homeTeam) continue;

        const teamExternalId = teamData.team?.id?.toString();
        const isHome = teamExternalId === game.homeTeam.externalId;
        const teamId = isHome ? game.homeTeamId : game.awayTeamId;

        if (!teamId) {
          logger.warn(`Missing teamId for game ${game.id}`);
          continue;
        }

        const fixtureData = await this.getFixtureDetails(externalGameId);
        const homeScore = fixtureData?.goals?.home || 0;

        const stats: Record<string, string | number | null | undefined> = {};
        for (const stat of teamData.statistics || []) {
          const key = stat.type?.toLowerCase().replace(/ /g, '_');
          let value = stat.value;

          // Convert percentage strings to numbers
          if (typeof value === 'string' && value.includes('%')) {
            value = parseFloat(value.replace('%', ''));
          }

          stats[String(key)] = value;
        }

        await this.upsertGameStats({
          gameId: game.id,
          teamId,
          isHome,
          // Soccer has no periods to break out, so record the final score.
          quarterScores: [homeScore],
          stats: {
            shots_on_goal: stats.shots_on_goal || 0,
            shots_off_goal: stats.shots_off_goal || 0,
            total_shots: stats.total_shots || 0,
            blocked_shots: stats.blocked_shots || 0,
            shots_insidebox: stats.shots_insidebox || 0,
            shots_outsidebox: stats.shots_outsidebox || 0,
            fouls: stats.fouls || 0,
            corner_kicks: stats.corner_kicks || 0,
            offsides: stats.offsides || 0,
            ball_possession: stats.ball_possession || 0,
            yellow_cards: stats.yellow_cards || 0,
            red_cards: stats.red_cards || 0,
            goalkeeper_saves: stats.goalkeeper_saves || 0,
            total_passes: stats.total_passes || 0,
            passes_accurate: stats.passes_accurate || 0,
            passes_percentage: stats['passes_%'] || 0,
          },
        });
      }

      logger.info(`Synced soccer game stats: ${externalGameId}`);
    } catch (error) {
      logger.error(`Error syncing soccer game stats for ${externalGameId}:`, error);
    }
  }

  async syncPlayerStats(externalGameId: string): Promise<void> {
    try {
      const game = await this.findGameByApiId(externalGameId);

      if (!game) {
        logger.warn(`Game not found: ${externalGameId}`);
        return;
      }

      const response = await this.client.get<ApiSportsResponse<FixturePlayersEntry>>(
        '/fixtures/players',
        { fixture: externalGameId }
      );

      for (const teamData of response.response || []) {
        const teamExternalId = teamData.team?.id?.toString();
        if (!teamExternalId) continue;

        // Soccer teams are not synced through /teams, so they carry no
        // apiSportsTeamId — match on the odds-sourced external id instead.
        const team = await prisma.team.findFirst({ where: { externalId: teamExternalId } });
        if (!team) continue;

        for (const playerData of teamData.players || []) {
          const player = await this.upsertPlayer({
            externalId: playerData.player?.id?.toString(),
            fullName: playerData.player?.name || '',
            teamId: team.id,
          });

          const playerStats = playerData.statistics?.[0] || {};

          await this.upsertPlayerGameStats({
            gameId: game.id,
            playerId: player.id,
            teamId: team.id,
            stats: {
              position: playerStats.games?.position || 'N/A',
              rating: playerStats.games?.rating || null,
              minutes: playerStats.games?.minutes || 0,
              goals: playerStats.goals?.total || 0,
              assists: playerStats.goals?.assists || 0,
              shots_total: playerStats.shots?.total || 0,
              shots_on: playerStats.shots?.on || 0,
              passes_total: playerStats.passes?.total || 0,
              passes_key: playerStats.passes?.key || 0,
              passes_accuracy: playerStats.passes?.accuracy || 0,
              dribbles_attempts: playerStats.dribbles?.attempts || 0,
              dribbles_success: playerStats.dribbles?.success || 0,
              duels_total: playerStats.duels?.total || 0,
              duels_won: playerStats.duels?.won || 0,
              tackles_total: playerStats.tackles?.total || 0,
              interceptions: playerStats.tackles?.interceptions || 0,
              fouls_drawn: playerStats.fouls?.drawn || 0,
              fouls_committed: playerStats.fouls?.committed || 0,
              yellow_cards: playerStats.cards?.yellow || 0,
              red_cards: playerStats.cards?.red || 0,
              saves: playerStats.goalkeeper?.saves || 0,
              goals_conceded: playerStats.goalkeeper?.conceded || 0,
            },
          });
        }
      }

      logger.info(`Synced soccer player stats: ${externalGameId}`);
    } catch (error) {
      logger.error(`Error syncing soccer player stats for ${externalGameId}:`, error);
    }
  }

  /** Fixture details (scores, status) for a single fixture id. */
  private async getFixtureDetails(externalGameId: string): Promise<Fixture | null> {
    try {
      const response = await this.client.get<ApiSportsResponse<Fixture>>('/fixtures', {
        id: externalGameId,
      });

      return response.response?.[0] || null;
    } catch (error) {
      logger.error(`Error fetching fixture details for ${externalGameId}:`, error);
      return null;
    }
  }
}
