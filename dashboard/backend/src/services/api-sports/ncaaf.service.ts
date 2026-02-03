import { PrismaClient } from '@prisma/client';
import { ApiSportsClient } from './client';
import { logger } from '../../config/logger';

// Initialize API-Sports client for american football
const apiSportsClient = new ApiSportsClient({
  apiKey: process.env.API_SPORTS_KEY || '',
  sport: 'american-football'
});

const prisma = new PrismaClient();

/**
 * NCAA Football (NCAAF) stats service
 * League ID: 1 for NCAA Football
 */

export class NCAAFService {
  private leagueId = 1; // NCAA Football league ID

  /**
   * Get live NCAA Football games
   */
  async getLiveGames(): Promise<any[]> {
    try {
      const response = await apiSportsClient.get('/games', {
        params: {
          league: this.leagueId,
          live: 'all'
        }
      });

      return (response as any).data?.response || [];
    } catch (error) {
      logger.error('Error fetching live NCAAF games:', error);
      return [];
    }
  }

  /**
   * Sync game stats for a specific NCAA Football game
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
      const response = await apiSportsClient.get('/games/statistics', {
        params: {
          id: externalGameId
        }
      });

      const statsData = (response as any).data?.response?.[0];
      if (!statsData) {
        logger.warn(`No stats data for game: ${externalGameId}`);
        return;
      }

      // Extract team statistics
      const teams = statsData.teams || [];
      
      for (const teamData of teams) {
        if (!game.homeTeam) continue;
        
        const isHome = teamData.team?.id === game.homeTeam.externalId;
        const teamId = isHome ? game.homeTeamId : game.awayTeamId;
        
        if (!teamId) {
          logger.warn(`Team ID not found for game ${game.id}`);
          continue;
        }
        
        // Extract quarter scores (4 quarters + potential OT)
        const periods = teamData.statistics?.periods || [];
        const quarterScores = periods.map((p: any) => p.points || 0);
        
        // Calculate total score
        const totalScore = quarterScores.reduce((sum: number, score: number) => sum + score, 0);

        // Prepare stats object (American football stats)
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
          sacks: teamData.statistics?.sacks || 0
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
            quarterScores,
            stats,
            updatedAt: new Date()
          },
          create: {
            gameId: game.id,
            teamId,
            isHome,
            quarterScores,
            stats
          }
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
      const game = await prisma.game.findUnique({
        where: { externalId: externalGameId }
      });

      if (!game) {
        logger.warn(`Game not found: ${externalGameId}`);
        return;
      }

      // Fetch player statistics
      const response = await apiSportsClient.get('/games/players', {
        params: {
          id: externalGameId
        }
      });

      const playersData = response.data?.response || [];

      for (const teamData of playersData) {
        const teamExternalId = teamData.team?.id;
        
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
              externalId: playerData.player?.id?.toString()
            },
            update: {
              firstName: playerData.player?.name?.split(' ')[0] || '',
              lastName: playerData.player?.name?.split(' ').slice(1).join(' ') || '',
              teamId: team.id
            },
            create: {
              externalId: playerData.player?.id?.toString(),
              firstName: playerData.player?.name?.split(' ')[0] || '',
              lastName: playerData.player?.name?.split(' ').slice(1).join(' ') || '',
              teamId: team.id
            }
          });

          // Prepare player stats (position-specific stats)
          const stats: any = {
            position: playerData.position || 'N/A'
          };

          // Passing stats
          if (playerData.statistics?.passing) {
            stats.passing_completions = playerData.statistics.passing.completions || 0;
            stats.passing_attempts = playerData.statistics.passing.attempts || 0;
            stats.passing_yards = playerData.statistics.passing.yards || 0;
            stats.passing_touchdowns = playerData.statistics.passing.touchdowns || 0;
            stats.interceptions = playerData.statistics.passing.interceptions || 0;
          }

          // Rushing stats
          if (playerData.statistics?.rushing) {
            stats.rushing_attempts = playerData.statistics.rushing.attempts || 0;
            stats.rushing_yards = playerData.statistics.rushing.yards || 0;
            stats.rushing_touchdowns = playerData.statistics.rushing.touchdowns || 0;
          }

          // Receiving stats
          if (playerData.statistics?.receiving) {
            stats.receptions = playerData.statistics.receiving.receptions || 0;
            stats.receiving_yards = playerData.statistics.receiving.yards || 0;
            stats.receiving_touchdowns = playerData.statistics.receiving.touchdowns || 0;
          }

          // Defensive stats
          if (playerData.statistics?.defense) {
            stats.tackles = playerData.statistics.defense.tackles || 0;
            stats.sacks = playerData.statistics.defense.sacks || 0;
            stats.interceptions_defense = playerData.statistics.defense.interceptions || 0;
          }

          // Kicking stats
          if (playerData.statistics?.kicking) {
            stats.field_goals_made = playerData.statistics.kicking.field_goals_made || 0;
            stats.field_goals_attempts = playerData.statistics.kicking.field_goals_attempts || 0;
            stats.extra_points_made = playerData.statistics.kicking.extra_points_made || 0;
          }

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
              teamId: player.teamId || game.homeTeamId || 0,
              stats
            }
          });
        }
      }

      logger.info(`Synced NCAAF player stats: ${externalGameId}`);
    } catch (error) {
      logger.error(`Error syncing NCAAF player stats for ${externalGameId}:`, error);
    }
  }
}

export const ncaafService = new NCAAFService();
