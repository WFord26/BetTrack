import { ApiSportsClient } from './client';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { resolveApiSportsTeam, upsertApiSportsGame } from './game-resolver';

const prisma = new PrismaClient();

interface NCAAFGame {
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
    home: {
      quarter_1: number | null;
      quarter_2: number | null;
      quarter_3: number | null;
      quarter_4: number | null;
      overtime: number | null;
      total: number | null;
    };
    away: {
      quarter_1: number | null;
      quarter_2: number | null;
      quarter_3: number | null;
      quarter_4: number | null;
      overtime: number | null;
      total: number | null;
    };
  };
}

export interface NCAAFDateSyncResult {
  processed: number;
  updated: number;
  skipped: number;
  requestsRemaining?: number;
}

/**
 * NCAA Football (NCAAF) stats service.
 * League ID confirmed as 2 against the live API-Sports /leagues endpoint
 * (NFL is league 1, on the same "american-football" sport).
 */
export class NCAAFService {
  private client: ApiSportsClient;
  private leagueId = 2;

  constructor() {
    if (!env.API_SPORTS_KEY) {
      throw new Error('API_SPORTS_KEY is required for NCAAFService');
    }

    this.client = new ApiSportsClient({
      apiKey: env.API_SPORTS_KEY,
      sport: 'american-football',
      tier: env.API_SPORTS_TIER,
    });
  }

  /** See NFLStatsService.resolveSeasonForDate — same Jan/Feb season-boundary rule. */
  private resolveSeasonForDate(date: Date): number {
    return date.getMonth() <= 1 ? date.getFullYear() - 1 : date.getFullYear();
  }

  getRequestsRemaining(): number | undefined {
    return this.client.getLastRemainingRequests();
  }

  hasSufficientQuota(minimumRemaining: number): boolean {
    return this.client.hasSufficientRemaining(minimumRemaining);
  }

  /**
   * Get live NCAA Football games
   */
  async getLiveGames(): Promise<NCAAFGame[]> {
    try {
      const response = await this.client.get<{ response: NCAAFGame[] }>('/games', {
        league: this.leagueId,
        live: 'all',
      });

      return response.response || [];
    } catch (error) {
      logger.error('Error fetching live NCAAF games:', error);
      return [];
    }
  }

  async getGamesByDate(date: string, season?: number): Promise<NCAAFGame[]> {
    const resolvedSeason = season ?? this.resolveSeasonForDate(new Date(date));

    const response = await this.client.get<{ response: NCAAFGame[] }>('/games', {
      league: this.leagueId,
      season: resolvedSeason,
      date,
    });

    return response.response || [];
  }

  async syncGamesForDate(date: string, minimumRemaining: number): Promise<NCAAFDateSyncResult> {
    const result: NCAAFDateSyncResult = { processed: 0, updated: 0, skipped: 0 };

    if (!this.hasSufficientQuota(minimumRemaining)) {
      result.requestsRemaining = this.getRequestsRemaining();
      return result;
    }

    const games = await this.getGamesByDate(date);
    result.processed = games.length;

    for (const game of games) {
      await this.upsertGameFromApi(game);

      const status = this.mapApiStatusToLocal(game.game.status);
      if (status === 'live' || status === 'completed') {
        await this.syncGameStats(game.game.id.toString());
        result.updated++;
      } else {
        result.skipped++;
      }
    }

    result.requestsRemaining = this.getRequestsRemaining();
    return result;
  }

  private mapApiStatusToLocal(status: NCAAFGame['game']['status']): string {
    const short = (status?.short || '').toUpperCase();
    const long = (status?.long || '').toLowerCase();

    if (short === 'FT' || short === 'AOT' || long.includes('finished') || long.includes('final')) {
      return 'completed';
    }

    if (short === 'NS' || short === 'TBD' || long.includes('scheduled') || long.includes('postponed')) {
      return 'scheduled';
    }

    if (/^Q[1-4]$/.test(short) || short === 'HT' || short === 'OT' || long.includes('in play')) {
      return 'live';
    }

    return 'scheduled';
  }

  private async upsertGameFromApi(gameData: NCAAFGame): Promise<string | null> {
    const homeTeam = await resolveApiSportsTeam(gameData.teams.home, 'americanfootball_ncaaf');
    const awayTeam = await resolveApiSportsTeam(gameData.teams.away, 'americanfootball_ncaaf');

    const commenceTime = new Date(gameData.game.date.timestamp * 1000);
    if (Number.isNaN(commenceTime.getTime())) {
      logger.warn(`Skipping NCAAF game ${gameData.game.id} due to invalid date value`);
      return null;
    }

    const seasonValue = gameData.league?.season?.toString() || this.resolveSeasonForDate(commenceTime).toString();

    return upsertApiSportsGame({
      sportKey: 'americanfootball_ncaaf',
      apiSportsGameId: gameData.game.id.toString(),
      apiSportsLeagueId: this.leagueId,
      homeTeamName: gameData.teams.home.name,
      awayTeamName: gameData.teams.away.name,
      homeTeamId: homeTeam?.id,
      awayTeamId: awayTeam?.id,
      commenceTime,
      season: seasonValue,
      status: this.mapApiStatusToLocal(gameData.game.status),
      homeScore: gameData.scores.home.total,
      awayScore: gameData.scores.away.total,
    });
  }

  /**
   * Sync game stats for a specific NCAA Football game
   */
  async syncGameStats(externalGameId: string): Promise<void> {
    try {
      const game = await prisma.game.findFirst({
        where: {
          apiSportsGameId: externalGameId,
          sport: { key: 'americanfootball_ncaaf' },
        },
        include: { homeTeam: true, awayTeam: true },
      });

      if (!game) {
        logger.warn(`Game not found: ${externalGameId}`);
        return;
      }

      const response = await this.client.get<{ response: any[] }>('/games/statistics', {
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

        const stats = {
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
        };

        await prisma.gameStats.upsert({
          where: {
            gameId_teamId: { gameId: game.id, teamId },
          },
          update: {
            quarterScores,
            stats,
            updatedAt: new Date(),
          },
          create: {
            gameId: game.id,
            teamId,
            isHome,
            quarterScores,
            stats,
          },
        });
      }

      logger.info(`Synced NCAAF game stats: ${externalGameId}`);
    } catch (error) {
      logger.error(`Error syncing NCAAF game stats for ${externalGameId}:`, error);
    }
  }

  /**
   * Sync player stats for a specific NCAA Football game
   */
  async syncPlayerStats(externalGameId: string): Promise<void> {
    try {
      const game = await prisma.game.findFirst({
        where: {
          apiSportsGameId: externalGameId,
          sport: { key: 'americanfootball_ncaaf' },
        },
      });

      if (!game) {
        logger.warn(`Game not found: ${externalGameId}`);
        return;
      }

      const response = await this.client.get<{ response: any[] }>('/games/players', {
        id: externalGameId,
      });

      const playersData = response.response || [];

      for (const teamData of playersData) {
        const teamApiSportsId = teamData.team?.id;

        const team = await prisma.team.findFirst({
          where: { apiSportsTeamId: teamApiSportsId, sport: { key: 'americanfootball_ncaaf' } },
        });

        if (!team) continue;

        const players = teamData.players || [];

        for (const playerData of players) {
          const playerExternalId = playerData.player?.id?.toString();
          const playerName = playerData.player?.name || '';

          let player = await prisma.player.findFirst({
            where: { externalId: playerExternalId },
          });

          if (player) {
            player = await prisma.player.update({
              where: { id: player.id },
              data: {
                firstName: playerName.split(' ')[0] || '',
                lastName: playerName.split(' ').slice(1).join(' ') || '',
                teamId: team.id,
              },
            });
          } else {
            player = await prisma.player.create({
              data: {
                externalId: playerExternalId,
                firstName: playerName.split(' ')[0] || '',
                lastName: playerName.split(' ').slice(1).join(' ') || '',
                teamId: team.id,
              },
            });
          }

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

          await prisma.playerGameStats.upsert({
            where: {
              gameId_playerId: { gameId: game.id, playerId: player.id },
            },
            update: { stats },
            create: {
              gameId: game.id,
              playerId: player.id,
              teamId: player.teamId || game.homeTeamId || 0,
              stats,
            },
          });
        }
      }

      logger.info(`Synced NCAAF player stats: ${externalGameId}`);
    } catch (error) {
      logger.error(`Error syncing NCAAF player stats for ${externalGameId}:`, error);
    }
  }

  async syncTeamStats(teamId: number, season: number): Promise<void> {
    try {
      const response = await this.client.get<{ response: any[] }>('/teams/statistics', {
        id: teamId,
        league: this.leagueId,
        season: season.toString(),
      });

      if (!response.response?.length) {
        logger.warn(`No team stats found for NCAAF team ${teamId}`);
        return;
      }

      const teamData = response.response[0];

      const team = await prisma.team.findFirst({
        where: {
          apiSportsTeamId: teamId,
          sport: { key: 'americanfootball_ncaaf' },
        },
      });

      if (!team) {
        logger.warn(`Team not found: ${teamId}`);
        return;
      }

      await prisma.teamStats.upsert({
        where: {
          teamId_season_seasonType: {
            teamId: team.id,
            season,
            seasonType: 'regular',
          },
        },
        create: {
          teamId: team.id,
          sportKey: 'americanfootball_ncaaf',
          season,
          seasonType: 'regular',
          offense: teamData.offense || {},
          defense: teamData.defense || {},
          standings: {
            wins: teamData.wins || 0,
            losses: teamData.losses || 0,
            ties: teamData.ties || 0,
          },
          gamesPlayed: teamData.games_played || 0,
        },
        update: {
          offense: teamData.offense || {},
          defense: teamData.defense || {},
          standings: {
            wins: teamData.wins || 0,
            losses: teamData.losses || 0,
            ties: teamData.ties || 0,
          },
          gamesPlayed: teamData.games_played || 0,
          lastUpdated: new Date(),
        },
      });

      logger.info(`Successfully synced team stats for NCAAF team ${teamId}`);
    } catch (error) {
      logger.error(`Failed to sync NCAAF team stats: ${error}`);
      throw error;
    }
  }

  async syncTeams(season: number = new Date().getFullYear() - 2): Promise<number> {
    try {
      logger.info(`Syncing NCAAF teams for season ${season}`);

      interface ApiTeam {
        id: number;
        name: string;
        code?: string;
        logo: string;
      }

      const response = await this.client.get<{ response: ApiTeam[] }>('/teams', {
        league: this.leagueId,
        season,
      });

      if (!response.response?.length) {
        logger.warn('No NCAAF teams returned from API-Sports');
        return 0;
      }

      const sport = await prisma.sport.findUnique({ where: { key: 'americanfootball_ncaaf' } });
      if (!sport) {
        logger.error('Sport "americanfootball_ncaaf" not found. Run /api/admin/init-sports first.');
        return 0;
      }

      let count = 0;
      for (const team of response.response) {
        const existing = await prisma.team.findFirst({
          where: { apiSportsTeamId: team.id, sportId: sport.id },
        });

        if (existing) {
          await prisma.team.update({
            where: { id: existing.id },
            data: {
              name: team.name,
              abbreviation: team.code || null,
              logoUrl: team.logo || null,
            },
          });
        } else {
          await prisma.team.create({
            data: {
              sportId: sport.id,
              apiSportsTeamId: team.id,
              name: team.name,
              abbreviation: team.code || null,
              logoUrl: team.logo || null,
            },
          });
        }
        count++;
      }

      logger.info(`Synced ${count} NCAAF teams for season ${season}`);
      return count;
    } catch (error) {
      logger.error(`Failed to sync NCAAF teams: ${error}`);
      throw error;
    }
  }
}
