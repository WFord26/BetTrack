import { NFLStatsService } from './api-sports/nfl.service';
import { NBAStatsService } from './api-sports/nba.service';
import { NHLStatsService } from './api-sports/nhl.service';
import { NCAABService } from './api-sports/ncaab.service';
import { NCAAFService } from './api-sports/ncaaf.service';
import { SoccerService } from './api-sports/soccer.service';
import { MLBStatsService } from './api-sports/mlb.service';
import { BaseStatsService } from './api-sports/base-stats.service';
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

export interface FootballBackfillOptions {
  minimumRemainingRequests?: number;
  hoursBack?: number;
  hoursForward?: number;
}

export interface FootballBackfillResult extends StatsSyncResult {
  datesProcessed: number;
  datesSkipped: number;
  requestsRemaining?: number;
  pausedDueToQuota: boolean;
}

export class StatsSyncService {
  private static mlbRangeSyncRunning = false;
  private static footballRangeSyncRunning = false;
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

  /** Every initialized stats service, in live-sync order. */
  private get statsServices(): BaseStatsService<any>[] {
    const services: Array<BaseStatsService<any> | undefined> = [
      this.nflService,
      this.nbaService,
      this.nhlService,
      this.ncaabService,
      this.ncaafService,
      this.soccerService,
      this.mlbService,
    ];

    return services.filter((service): service is BaseStatsService<any> => service !== undefined);
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
      for (const service of this.statsServices) {
        const games = await service.getLiveGames();

        for (const game of games) {
          result.gamesProcessed++;
          const gameId = service.extractGameId(game);

          try {
            await service.syncGameStats(gameId);
            await service.syncPlayerStats(gameId);
            result.gamesUpdated++;
          } catch (error) {
            const errorMsg = `Failed to sync ${service.label} game ${gameId}: ${error}`;
            logger.error(errorMsg);
            result.errors.push(errorMsg);
          }

          // Small delay to respect rate limits
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
          if (this.ncaafService) {
            await this.ncaafService.syncTeamStats(teamId, season);
          }
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
    // Basketball seasons are labelled by the pair of years they span.
    const seasonYearOverYear = `${currentYear - 2}-${currentYear - 1}`;

    const plan: Array<[BaseStatsService<any> | undefined, number | string]> = [
      [this.nflService, currentYear - 2],
      [this.nbaService, seasonYearOverYear],
      [this.nhlService, currentYear - 2],
      [this.ncaabService, seasonYearOverYear],
      [this.mlbService, currentYear - 2],
      [this.ncaafService, currentYear - 2],
    ];

    for (const [service, season] of plan) {
      if (!service?.sportKey) continue;

      try {
        results[service.sportKey] = await service.syncTeams(season);
      } catch (error) {
        logger.error(`${service.label} team sync failed: ${error}`);
        results[service.sportKey] = 0;
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

  async syncFootballHourlyWindow(options?: FootballBackfillOptions): Promise<FootballBackfillResult> {
    // Football games cluster Thu/Sat/Sun/Mon, so use a wider default window
    // than MLB's daily cadence — this keeps a Sunday slate covered by a
    // Monday-morning check even after a missed run.
    const hoursBack = options?.hoursBack ?? 96;
    const hoursForward = options?.hoursForward ?? 72;
    const now = new Date();
    const start = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);
    const end = new Date(now.getTime() + hoursForward * 60 * 60 * 1000);

    return this.syncFootballDateRange(start, end, options);
  }

  private async syncFootballDateRange(
    start: Date,
    end: Date,
    options?: FootballBackfillOptions
  ): Promise<FootballBackfillResult> {
    const result: FootballBackfillResult = {
      gamesProcessed: 0,
      gamesUpdated: 0,
      errors: [],
      datesProcessed: 0,
      datesSkipped: 0,
      pausedDueToQuota: false,
    };

    if (!env.API_SPORTS_KEY || (!this.nflService && !this.ncaafService)) {
      result.errors.push('API_SPORTS_KEY not set or football services unavailable');
      return result;
    }

    if (StatsSyncService.footballRangeSyncRunning) {
      result.errors.push('Football range sync already in progress');
      logger.warn('Skipping football range sync because another run is active');
      return result;
    }

    const minimumRemainingRequests = options?.minimumRemainingRequests ?? 500;
    const dates = this.getDateStringsInRange(start, end);

    logger.info(
      `Starting football range sync from ${dates[0]} to ${dates[dates.length - 1]} (${dates.length} days, min remaining=${minimumRemainingRequests})`
    );

    StatsSyncService.footballRangeSyncRunning = true;

    try {
      for (const date of dates) {
        const nflQuotaOk = this.nflService?.hasSufficientQuota(minimumRemainingRequests) ?? true;
        const ncaafQuotaOk = this.ncaafService?.hasSufficientQuota(minimumRemainingRequests) ?? true;

        if (!nflQuotaOk || !ncaafQuotaOk) {
          result.pausedDueToQuota = true;
          result.requestsRemaining = this.nflService?.getRequestsRemaining() ?? this.ncaafService?.getRequestsRemaining();
          result.datesSkipped += dates.length - result.datesProcessed;
          logger.warn(
            `Pausing football range sync due to low API quota. Remaining=${result.requestsRemaining}, required>=${minimumRemainingRequests}`
          );
          break;
        }

        if (this.nflService) {
          try {
            const dayResult = await this.nflService.syncGamesForDate(date, minimumRemainingRequests);
            result.gamesProcessed += dayResult.processed;
            result.gamesUpdated += dayResult.updated;
            result.requestsRemaining = dayResult.requestsRemaining;
          } catch (error) {
            const errorMsg = `Failed NFL sync for ${date}: ${error}`;
            logger.error(errorMsg);
            result.errors.push(errorMsg);
          }
        }

        if (this.ncaafService) {
          try {
            const dayResult = await this.ncaafService.syncGamesForDate(date, minimumRemainingRequests);
            result.gamesProcessed += dayResult.processed;
            result.gamesUpdated += dayResult.updated;
            result.requestsRemaining = dayResult.requestsRemaining;
          } catch (error) {
            const errorMsg = `Failed NCAAF sync for ${date}: ${error}`;
            logger.error(errorMsg);
            result.errors.push(errorMsg);
          }
        }

        result.datesProcessed++;
      }
    } finally {
      StatsSyncService.footballRangeSyncRunning = false;
    }

    logger.info(
      `Football range sync complete: dates=${result.datesProcessed}, games=${result.gamesProcessed}, updated=${result.gamesUpdated}, paused=${result.pausedDueToQuota}`
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
