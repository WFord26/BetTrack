import { NFLStatsService } from './api-sports/nfl.service';
import { NBAStatsService } from './api-sports/nba.service';
import { NHLStatsService } from './api-sports/nhl.service';
import { NCAABService } from './api-sports/ncaab.service';
import { NCAAFService } from './api-sports/ncaaf.service';
import { SoccerService } from './api-sports/soccer.service';
import { logger } from '../config/logger';
import { env } from '../config/env';

export interface StatsSyncResult {
  gamesProcessed: number;
  gamesUpdated: number;
  errors: string[];
}

export class StatsSyncService {
  private nflService?: NFLStatsService;
  private nbaService?: NBAStatsService;
  private nhlService?: NHLStatsService;
  private ncaabService?: NCAABService;
  private ncaafService?: NCAAFService;
  private soccerService?: SoccerService;

  constructor() {
    // Only initialize services if API key is available
    if (env.API_SPORTS_KEY) {
      try {
        this.nflService = new NFLStatsService();
        this.nbaService = new NBAStatsService();
        this.nhlService = new NHLStatsService();
        this.ncaabService = new NCAABService();
        this.ncaafService = new NCAAFService();
        this.soccerService = new SoccerService();
        logger.info('Stats services initialized for NFL, NBA, NHL, NCAAB, NCAAF, and Soccer');
      } catch (error) {
        logger.warn('Failed to initialize stats services, stats sync disabled');
      }
    }
  }

  async syncAllLiveStats(): Promise<StatsSyncResult> {
    const result: StatsSyncResult = {
      gamesProcessed: 0,
      gamesUpdated: 0,
      errors: [],
    };

    if (!env.API_SPORTS_KEY) {
      return result;
    }

    try {
      // Fetch and sync NFL live games
      if (this.nflService) {
        const nflGames = await this.nflService.getLiveGames();
        
        for (const gameId of nflGames) {
          result.gamesProcessed++;
          
          try {
            await this.nflService.syncGameStats(gameId);
            result.gamesUpdated++;
          } catch (error) {
            const errorMsg = `Failed to sync NFL game ${gameId}: ${error}`;
            logger.error(errorMsg);
            result.errors.push(errorMsg);
          }

          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Fetch and sync NBA live games
      if (this.nbaService) {
        const nbaGames = await this.nbaService.getLiveGames();
        
        for (const gameId of nbaGames) {
          result.gamesProcessed++;
          
          try {
            await this.nbaService.syncGameStats(gameId);
            result.gamesUpdated++;
          } catch (error) {
            const errorMsg = `Failed to sync NBA game ${gameId}: ${error}`;
            logger.error(errorMsg);
            result.errors.push(errorMsg);
          }

          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Fetch and sync NHL live games
      if (this.nhlService) {
        const nhlGames = await this.nhlService.getLiveGames();
        
        for (const gameId of nhlGames) {
          result.gamesProcessed++;
          
          try {
            await this.nhlService.syncGameStats(gameId);
            result.gamesUpdated++;
          } catch (error) {
            const errorMsg = `Failed to sync NHL game ${gameId}: ${error}`;
            logger.error(errorMsg);
            result.errors.push(errorMsg);
          }

          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Fetch and sync NCAA Basketball live games
      if (this.ncaabService) {
        const ncaabGames = await this.ncaabService.getLiveGames();
        
        for (const game of ncaabGames) {
          result.gamesProcessed++;
          
          try {
            await this.ncaabService.syncGameStats(game.id);
            await this.ncaabService.syncPlayerStats(game.id);
            result.gamesUpdated++;
          } catch (error) {
            const errorMsg = `Failed to sync NCAAB game ${game.id}: ${error}`;
            logger.error(errorMsg);
            result.errors.push(errorMsg);
          }

          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Fetch and sync NCAA Football live games
      if (this.ncaafService) {
        const ncaafGames = await this.ncaafService.getLiveGames();
        
        for (const game of ncaafGames) {
          result.gamesProcessed++;
          
          try {
            await this.ncaafService.syncGameStats(game.id);
            await this.ncaafService.syncPlayerStats(game.id);
            result.gamesUpdated++;
          } catch (error) {
            const errorMsg = `Failed to sync NCAAF game ${game.id}: ${error}`;
            logger.error(errorMsg);
            result.errors.push(errorMsg);
          }

          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Fetch and sync Soccer live games
      if (this.soccerService) {
        const soccerGames = await this.soccerService.getLiveGames();
        
        for (const game of soccerGames) {
          result.gamesProcessed++;
          
          try {
            await this.soccerService.syncGameStats(game.fixture.id);
            await this.soccerService.syncPlayerStats(game.fixture.id);
            result.gamesUpdated++;
          } catch (error) {
            const errorMsg = `Failed to sync Soccer game ${game.fixture.id}: ${error}`;
            logger.error(errorMsg);
            result.errors.push(errorMsg);
          }

          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      logger.info(`Stats sync completed: ${result.gamesUpdated}/${result.gamesProcessed} games updated`);
    } catch (error) {
      const errorMsg = `Stats sync failed: ${error}`;
      logger.error(errorMsg);
      result.errors.push(errorMsg);
    }

    return result;
  }

  async syncTeamSeasonStats(sportKey: string, teamId: number, season: number): Promise<void> {
    try {
      switch (sportKey) {
        case 'americanfootball_nfl':
          if (this.nflService) {
            await this.nflService.syncTeamStats(teamId, season);
          }
          break;
        case 'basketball_nba':
          // TODO: Implement NBA team stats sync
          logger.warn('NBA team stats sync not yet implemented');
          break;
        case 'basketball_ncaab':
          // TODO: Implement NCAAB team stats sync
          logger.warn('NCAAB team stats sync not yet implemented');
          break;
        case 'americanfootball_ncaaf':
          // TODO: Implement NCAAF team stats sync
          logger.warn('NCAAF team stats sync not yet implemented');
          break;
        case 'icehockey_nhl':
          // TODO: Implement NHL team stats sync
          logger.warn('NHL team stats sync not yet implemented');
          break;
        case 'soccer_epl':
        case 'soccer_spain_la_liga':
        case 'soccer_usa_mls':
          // TODO: Implement Soccer team stats sync
          logger.warn('Soccer team stats sync not yet implemented');
          break;
        default:
          logger.warn(`Team stats sync not implemented for sport: ${sportKey}`);
      }
    } catch (error) {
      logger.error(`Failed to sync team stats: ${error}`);
      throw error;
    }
  }
}
