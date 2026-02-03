import { PrismaClient } from '@prisma/client';
import { ApiSportsClient } from './client';
import { logger } from '../../config/logger';

// Initialize API-Sports client for soccer (note: API-Sports doesn't have soccer, using football)
// This will need API key for soccer league
const apiSportsClient = new ApiSportsClient({
  apiKey: process.env.API_SPORTS_KEY || '',
  sport: 'american-football' // Note: need to update client for soccer support
});

const prisma = new PrismaClient();

/**
 * Soccer stats service
 * Supports multiple soccer leagues (EPL, MLS, UEFA, etc.)
 */

export class SoccerService {
  // Common soccer league IDs from API-Sports
  private leagueIds = {
    EPL: 39,       // English Premier League
    LaLiga: 140,   // Spanish La Liga
    SerieA: 135,   // Italian Serie A
    Bundesliga: 78, // German Bundesliga
    Ligue1: 61,    // French Ligue 1
    MLS: 253,      // Major League Soccer
    UCL: 2         // UEFA Champions League
  };

  /**
   * Get live soccer games across all configured leagues
   */
  async getLiveGames(): Promise<any[]> {
    try {
      const allGames: any[] = [];

      // Check each league for live games
      for (const [leagueName, leagueId] of Object.entries(this.leagueIds)) {
        const response = await apiSportsClient.get('/fixtures', {
          params: {
            league: leagueId,
            live: 'all'
          }
        });

        const games = response.data?.response || [];
        allGames.push(...games);
      }

      return allGames;
    } catch (error) {
      logger.error('Error fetching live soccer games:', error);
      return [];
    }
  }

  /**
   * Sync game stats for a specific soccer game
   */
  async syncGameStats(externalGameId: string): Promise<void> {
    try {
      // Find the game in our database
      const game = await prisma.game.findUnique({
        where: { externalId: externalGameId },
        include: { homeTeam: true, awayTeam: true }
      });

      if (!game) {
        logger.warn(`Game not found: ${externalGameId}`);
        return;
      }

      // Fetch game statistics from API-Sports
      const response = await apiSportsClient.get('/fixtures/statistics', {
        params: {
          fixture: externalGameId
        }
      });

      const statsData = response.data?.response || [];
      if (statsData.length === 0) {
        logger.warn(`No stats data for game: ${externalGameId}`);
        return;
      }

      // Process each team's statistics
      for (const teamData of statsData) {
        const teamExternalId = teamData.team?.id?.toString();
        const isHome = teamExternalId === game.homeTeam.externalId;
        const teamId = isHome ? game.homeTeamId : game.awayTeamId;

        // Extract match score
        const fixtureData = await this.getFixtureDetails(externalGameId);
        const homeScore = fixtureData?.goals?.home || 0;
        const awayScore = fixtureData?.goals?.away || 0;

        // Parse statistics into a usable format
        const statistics = teamData.statistics || [];
        const stats: any = {};

        statistics.forEach((stat: any) => {
          const key = stat.type?.toLowerCase().replace(/ /g, '_');
          let value = stat.value;

          // Convert percentage strings to numbers
          if (typeof value === 'string' && value.includes('%')) {
            value = parseFloat(value.replace('%', ''));
          }

          stats[key] = value;
        });

        // Ensure common stats are present
        const standardizedStats = {
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
          passes_percentage: stats['passes_%'] || 0
        };

        // Upsert game stats
        await prisma.gameStats.upsert({
          where: {
            gameId_teamId: {
              gameId: game.id,
              teamId
            }
          },
          update: {
            homeScore: isHome ? homeScore : undefined,
            awayScore: !isHome ? awayScore : undefined,
            quarterScores: [homeScore], // Soccer doesn't have quarters, just final score
            stats: standardizedStats
          },
          create: {
            gameId: game.id,
            teamId,
            isHome,
            homeScore: isHome ? homeScore : 0,
            awayScore: !isHome ? awayScore : 0,
            quarterScores: [homeScore],
            stats: standardizedStats
          }
        });
      }

      logger.info(`Synced soccer game stats: ${externalGameId}`);
    } catch (error) {
      logger.error(`Error syncing soccer game stats for ${externalGameId}:`, error);
    }
  }

  /**
   * Sync player stats for a specific soccer game
   */
  async syncPlayerStats(externalGameId: string): Promise<void> {
    try {
      const game = await prisma.game.findUnique({
        where: { externalId: externalGameId }
      });

      if (!game) {
        logger.warn(`Game not found: ${externalGameId}`);
        return;
      }

      // Fetch player statistics
      const response = await apiSportsClient.get('/fixtures/players', {
        params: {
          fixture: externalGameId
        }
      });

      const playersData = response.data?.response || [];

      for (const teamData of playersData) {
        const teamExternalId = teamData.team?.id?.toString();
        
        // Find team in our database
        const team = await prisma.team.findFirst({
          where: { externalId: teamExternalId }
        });

        if (!team) continue;

        const players = teamData.players || [];

        for (const playerData of players) {
          // Ensure player exists in database
          const player = await prisma.player.upsert({
            where: {
              externalId_sport: {
                externalId: playerData.player?.id?.toString(),
                sport: game.sport // Use the game's sport key (e.g., 'soccer_epl')
              }
            },
            update: {
              name: playerData.player?.name,
              teamId: team.id
            },
            create: {
              externalId: playerData.player?.id?.toString(),
              name: playerData.player?.name,
              teamId: team.id,
              sport: game.sport
            }
          });

          // Prepare player stats
          const playerStats = playerData.statistics?.[0] || {};
          
          const stats = {
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
            goals_conceded: playerStats.goalkeeper?.conceded || 0
          };

          // Upsert player game stats
          await prisma.playerGameStats.upsert({
            where: {
              gameId_playerId: {
                gameId: game.id,
                playerId: player.id
              }
            },
            update: { stats },
            create: {
              gameId: game.id,
              playerId: player.id,
              stats
            }
          });
        }
      }

      logger.info(`Synced soccer player stats: ${externalGameId}`);
    } catch (error) {
      logger.error(`Error syncing soccer player stats for ${externalGameId}:`, error);
    }
  }

  /**
   * Helper to get fixture details (scores, status)
   */
  private async getFixtureDetails(externalGameId: string): Promise<any> {
    try {
      const response = await apiSportsClient.get('/fixtures', {
        params: {
          id: externalGameId
        }
      });

      return response.data?.response?.[0] || null;
    } catch (error) {
      logger.error(`Error fetching fixture details for ${externalGameId}:`, error);
      return null;
    }
  }
}

export const soccerService = new SoccerService();
