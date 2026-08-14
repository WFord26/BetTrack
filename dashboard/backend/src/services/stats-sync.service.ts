import { NFLStatsService } from './api-sports/nfl.service';
import { NBAStatsService } from './api-sports/nba.service';
import { NHLStatsService } from './api-sports/nhl.service';
import { NCAABService } from './api-sports/ncaab.service';
import { NCAAFService } from './api-sports/ncaaf.service';
import { SoccerService } from './api-sports/soccer.service';
import { MLBStatsService } from './api-sports/mlb.service';
import { logger } from '../config/logger';
import { env } from '../config/env';

export interface StatsSyncResult {
  gamesProcessed: number;
  gamesUpdated: number;
  errors: string[];
}

export interface MlbBackfillOptions {
  minimumRemainingRequests?: number;
  hoursBack?: number;
  hoursForward?: number;
}

export interface MlbBackfillResult extends StatsSyncResult {
  datesProcessed: number;
  datesSkipped: number;
  requestsRemaining?: number;
  pausedDueToQuota: boolean;
}

export class StatsSyncService {
  private static mlbRangeSyncRunning = false;
  private nflService?: NFLStatsService;
  private nbaService?: NBAStatsService;
  private nhlService?: NHLStatsService;
  private ncaabService?: NCAABService;
  private ncaafService?: NCAAFService;
  private soccerService?: SoccerService;
  private mlbService?: MLBStatsService;

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
        this.mlbService = new MLBStatsService();
        logger.info('Stats services initialized for NFL, NBA, NHL, NCAAB, NCAAF, Soccer, and MLB');
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
          const gameId = String(game.id);
          
          try {
            await this.ncaabService.syncGameStats(gameId);
            await this.ncaabService.syncPlayerStats(gameId);
            result.gamesUpdated++;
          } catch (error) {
            const errorMsg = `Failed to sync NCAAB game ${gameId}: ${error}`;
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
          const gameId = String(game.id);
          
          try {
            await this.ncaafService.syncGameStats(gameId);
            await this.ncaafService.syncPlayerStats(gameId);
            result.gamesUpdated++;
          } catch (error) {
            const errorMsg = `Failed to sync NCAAF game ${gameId}: ${error}`;
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
          const gameId = String(game.fixture.id);
          
          try {
            await this.soccerService.syncGameStats(gameId);
            await this.soccerService.syncPlayerStats(gameId);
            result.gamesUpdated++;
          } catch (error) {
            const errorMsg = `Failed to sync Soccer game ${gameId}: ${error}`;
            logger.error(errorMsg);
            result.errors.push(errorMsg);
          }

          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Fetch and sync MLB live games
      if (this.mlbService) {
        const mlbGames = await this.mlbService.getLiveGames();

        for (const gameId of mlbGames) {
          result.gamesProcessed++;

          try {
            await this.mlbService.syncGameStats(gameId);
            result.gamesUpdated++;
          } catch (error) {
            const errorMsg = `Failed to sync MLB game ${gameId}: ${error}`;
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

  async syncAllTeams(): Promise<Record<string, number>> {
    const results: Record<string, number> = {};

    if (!env.API_SPORTS_KEY) {
      logger.warn('API_SPORTS_KEY not set — skipping team sync');
      return results;
    }

    const currentYear = new Date().getFullYear();
    const seasonYearOverYear = `${currentYear - 2}-${currentYear - 1}`;

    if (this.nflService) {
      try {
        results['americanfootball_nfl'] = await this.nflService.syncTeams(currentYear - 2);
      } catch (error) {
        logger.error(`NFL team sync failed: ${error}`);
        results['americanfootball_nfl'] = 0;
      }
    }

    if (this.nbaService) {
      try {
        results['basketball_nba'] = await this.nbaService.syncTeams(seasonYearOverYear);
      } catch (error) {
        logger.error(`NBA team sync failed: ${error}`);
        results['basketball_nba'] = 0;
      }
    }

    if (this.nhlService) {
      try {
        results['icehockey_nhl'] = await this.nhlService.syncTeams(currentYear - 2);
      } catch (error) {
        logger.error(`NHL team sync failed: ${error}`);
        results['icehockey_nhl'] = 0;
      }
    }

    if (this.ncaabService) {
      try {
        results['basketball_ncaab'] = await this.ncaabService.syncTeams(seasonYearOverYear);
      } catch (error) {
        logger.error(`NCAAB team sync failed: ${error}`);
        results['basketball_ncaab'] = 0;
      }
    }

    if (this.mlbService) {
      try {
        results['baseball_mlb'] = await this.mlbService.syncTeams(currentYear - 2);
      } catch (error) {
        logger.error(`MLB team sync failed: ${error}`);
        results['baseball_mlb'] = 0;
      }
    }

    const total = Object.values(results).reduce((sum, n) => sum + n, 0);
    logger.info(`Team sync complete: ${total} teams across ${Object.keys(results).length} sports`);

    return results;
  }

  async seedMlbSeasonToDate(options?: MlbBackfillOptions): Promise<MlbBackfillResult> {
    const now = new Date();
    const seasonStart = new Date(now.getFullYear(), 0, 1);

    return this.syncMlbDateRange(seasonStart, now, options);
  }

  async syncMlbHourlyWindow(options?: MlbBackfillOptions): Promise<MlbBackfillResult> {
    const hoursBack = options?.hoursBack ?? 48;
    const hoursForward = options?.hoursForward ?? 24;
    const now = new Date();
    const start = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);
    const end = new Date(now.getTime() + hoursForward * 60 * 60 * 1000);

    return this.syncMlbDateRange(start, end, options);
  }

  private async syncMlbDateRange(start: Date, end: Date, options?: MlbBackfillOptions): Promise<MlbBackfillResult> {
    const result: MlbBackfillResult = {
      gamesProcessed: 0,
      gamesUpdated: 0,
      errors: [],
      datesProcessed: 0,
      datesSkipped: 0,
      pausedDueToQuota: false,
    };

    if (!env.API_SPORTS_KEY || !this.mlbService) {
      result.errors.push('API_SPORTS_KEY not set or MLB service unavailable');
      return result;
    }

    if (StatsSyncService.mlbRangeSyncRunning) {
      result.errors.push('MLB range sync already in progress');
      logger.warn('Skipping MLB range sync because another run is active');
      return result;
    }

    const minimumRemainingRequests = options?.minimumRemainingRequests ?? 500;
    const dates = this.getDateStringsInRange(start, end);

    logger.info(
      `Starting MLB range sync from ${dates[0]} to ${dates[dates.length - 1]} (${dates.length} days, min remaining=${minimumRemainingRequests})`
    );

    StatsSyncService.mlbRangeSyncRunning = true;

    try {
      for (const date of dates) {
        if (!this.mlbService.hasSufficientQuota(minimumRemainingRequests)) {
          result.pausedDueToQuota = true;
          result.requestsRemaining = this.mlbService.getRequestsRemaining();
          result.datesSkipped += dates.length - result.datesProcessed;
          logger.warn(
            `Pausing MLB range sync due to low API quota. Remaining=${result.requestsRemaining}, required>=${minimumRemainingRequests}`
          );
          break;
        }

        try {
          const dayResult = await this.mlbService.syncGamesForDate(date, minimumRemainingRequests);
          result.datesProcessed++;
          result.gamesProcessed += dayResult.processed;
          result.gamesUpdated += dayResult.updated;
          result.requestsRemaining = dayResult.requestsRemaining;
        } catch (error) {
          const errorMsg = `Failed MLB sync for ${date}: ${error}`;
          logger.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }
    } finally {
      StatsSyncService.mlbRangeSyncRunning = false;
    }

    logger.info(
      `MLB range sync complete: dates=${result.datesProcessed}, games=${result.gamesProcessed}, updated=${result.gamesUpdated}, paused=${result.pausedDueToQuota}`
    );

    return result;
  }

  private getDateStringsInRange(start: Date, end: Date): string[] {
    const normalizedStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const normalizedEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const dates: string[] = [];

    for (let cursor = normalizedStart; cursor <= normalizedEnd; cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)) {
      dates.push(cursor.toISOString().slice(0, 10));
    }

    return dates;
  }
}
