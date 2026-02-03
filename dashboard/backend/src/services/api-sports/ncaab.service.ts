import { PrismaClient } from '@prisma/client';
import { ApiSportsClient } from './client';
import { logger } from '../../config/logger';

// Initialize API-Sports client for basketball
const apiSportsClient = new ApiSportsClient({
  apiKey: process.env.API_SPORTS_KEY || '',
  sport: 'basketball'
});

const prisma = new PrismaClient();

/**
 * NCAA Basketball (NCAAB) stats service
 * League ID: 127 for NCAA Basketball
 */

export class NCAABService {
  private leagueId = 127; // NCAA Basketball league ID

  /**
   * Get live NCAA Basketball games
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
      logger.error('Error fetching live NCAAB games:', error);
      return [];
    }
  }

  /**
   * Sync game stats for a specific NCAA Basketball game
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
        if (!game.homeTeam) continue; // Skip if homeTeam not loaded
        
        const isHome = teamData.team?.id === game.homeTeam.externalId;
        const teamId = isHome ? game.homeTeamId : game.awayTeamId;
        
        if (!teamId) {
          logger.warn(`Team ID not found for game ${game.id}`);
          continue;
        }
        
        // Extract quarter scores (NCAA Basketball has 2 halves + potential OT)
        const periods = teamData.statistics?.periods || [];
        const quarterScores = periods.map((p: any) => p.points || 0);
        
        // Calculate total score
        const totalScore = quarterScores.reduce((sum: number, score: number) => sum + score, 0);

        // Prepare stats object
        const stats = {
          points: totalScore,
          field_goals: teamData.statistics?.field_goals_made || 0,
          field_goals_attempts: teamData.statistics?.field_goals_attempts || 0,
          field_goal_percentage: teamData.statistics?.field_goal_percentage || 0,
          three_pointers: teamData.statistics?.three_points_made || 0,
          three_point_attempts: teamData.statistics?.three_points_attempts || 0,
          three_point_percentage: teamData.statistics?.three_point_percentage || 0,
          free_throws: teamData.statistics?.free_throws_made || 0,
          free_throw_attempts: teamData.statistics?.free_throws_attempts || 0,
          free_throw_percentage: teamData.statistics?.free_throw_percentage || 0,
          rebounds: teamData.statistics?.rebounds || 0,
          offensive_rebounds: teamData.statistics?.offensive_rebounds || 0,
          defensive_rebounds: teamData.statistics?.defensive_rebounds || 0,
          assists: teamData.statistics?.assists || 0,
          steals: teamData.statistics?.steals || 0,
          blocks: teamData.statistics?.blocks || 0,
          turnovers: teamData.statistics?.turnovers || 0,
          fouls: teamData.statistics?.fouls || 0
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

      logger.info(`Synced NCAAB game stats: ${externalGameId}`);
    } catch (error) {
      logger.error(`Error syncing NCAAB game stats for ${externalGameId}:`, error);
    }
  }

  /**
   * Sync player stats for a specific NCAA Basketball game
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

      const playersData = (response as any).data?.response || [];

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

          // Prepare player stats
          const stats = {
            minutes: playerData.statistics?.minutes || '0:00',
            points: playerData.statistics?.points || 0,
            rebounds: playerData.statistics?.rebounds || 0,
            assists: playerData.statistics?.assists || 0,
            field_goals_made: playerData.statistics?.field_goals_made || 0,
            field_goals_attempts: playerData.statistics?.field_goals_attempts || 0,
            field_goal_percentage: playerData.statistics?.field_goal_percentage || 0,
            three_pointers_made: playerData.statistics?.three_points_made || 0,
            three_point_attempts: playerData.statistics?.three_points_attempts || 0,
            three_point_percentage: playerData.statistics?.three_point_percentage || 0,
            free_throws_made: playerData.statistics?.free_throws_made || 0,
            free_throw_attempts: playerData.statistics?.free_throws_attempts || 0,
            free_throw_percentage: playerData.statistics?.free_throw_percentage || 0,
            offensive_rebounds: playerData.statistics?.offensive_rebounds || 0,
            defensive_rebounds: playerData.statistics?.defensive_rebounds || 0,
            steals: playerData.statistics?.steals || 0,
            blocks: playerData.statistics?.blocks || 0,
            turnovers: playerData.statistics?.turnovers || 0,
            fouls: playerData.statistics?.fouls || 0,
            plus_minus: playerData.statistics?.plus_minus || 0
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
              playerId: player.id,              teamId: player.teamId || game.homeTeamId || 0,              stats
            }
          });
        }
      }

      logger.info(`Synced NCAAB player stats: ${externalGameId}`);
    } catch (error) {
      logger.error(`Error syncing NCAAB player stats for ${externalGameId}:`, error);
    }
  }
}

export const ncaabService = new NCAABService();
