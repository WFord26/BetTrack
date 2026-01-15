import axios, { AxiosInstance } from 'axios';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { espnWeatherService } from './espn-weather.service';
import {
  OddsApiEvent,
  OddsApiBookmaker,
  OddsApiMarket,
  SyncResult,
  ParsedMarketOdds
} from '../types/odds-api.types';

/**
 * Service for syncing odds from The Odds API
 * 
 * Handles:
 * - Fetching odds for multiple sports
 * - Upserting games and odds data
 * - Creating historical snapshots
 * - Rate limit tracking
 */
export class OddsSyncService {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl = 'https://api.the-odds-api.com';

  constructor() {
    this.apiKey = env.ODDS_API_KEY;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Accept': 'application/json'
      }
    });

    // Request interceptor to add API key
    this.client.interceptors.request.use((config) => {
      config.params = {
        ...config.params,
        apiKey: this.apiKey
      };
      return config;
    });

    // Response interceptor to log rate limits
    this.client.interceptors.response.use((response) => {
      const remaining = response.headers['x-requests-remaining'];
      const used = response.headers['x-requests-used'];
      
      if (remaining) {
        logger.info(`Odds API requests remaining: ${remaining}`);
      }
      if (used) {
        logger.debug(`Odds API requests used: ${used}`);
      }

      return response;
    });
  }

  /**
   * Sync odds for all active sports
   */
  async syncAllOdds(): Promise<SyncResult> {
    logger.info('Starting odds sync for all sports...');

    const result: SyncResult = {
      success: true,
      gamesProcessed: 0,
      oddsProcessed: 0,
      snapshotsCreated: 0,
      errors: []
    };

    try {
      // Get active sports from database
      const activeSports = await prisma.sport.findMany({
        where: { isActive: true },
        select: { key: true, name: true }
      });

      if (activeSports.length === 0) {
        logger.warn('No active sports found in database');
        return result;
      }

      logger.info(`Found ${activeSports.length} active sports to sync`);

      // Sync each sport
      for (const sport of activeSports) {
        try {
          const sportResult = await this.syncSportOdds(sport.key);
          
          result.gamesProcessed += sportResult.gamesProcessed;
          result.oddsProcessed += sportResult.oddsProcessed;
          result.snapshotsCreated += sportResult.snapshotsCreated;
          result.errors.push(...sportResult.errors);
          
          if (sportResult.requestsRemaining !== undefined) {
            result.requestsRemaining = sportResult.requestsRemaining;
          }

          // Add delay between sports to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          const errorMsg = `Failed to sync ${sport.key}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          logger.error(errorMsg);
          result.errors.push(errorMsg);
          result.success = false;
        }
      }

      logger.info(`Odds sync complete: ${result.gamesProcessed} games, ${result.oddsProcessed} odds, ${result.snapshotsCreated} snapshots`);
      
      if (result.errors.length > 0) {
        logger.warn(`Sync completed with ${result.errors.length} errors`);
      }

    } catch (error) {
      const errorMsg = `Fatal error during sync: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(errorMsg);
      result.success = false;
      result.errors.push(errorMsg);
    }

    return result;
  }

  /**
   * Sync odds for a specific sport
   */
  async syncSportOdds(sportKey: string): Promise<SyncResult> {
    logger.info(`Syncing odds for ${sportKey}...`);

    const result: SyncResult = {
      success: true,
      gamesProcessed: 0,
      oddsProcessed: 0,
      snapshotsCreated: 0,
      errors: []
    };

    try {
      // Fetch odds from API
      const response = await this.client.get(`/v4/sports/${sportKey}/odds`, {
        params: {
          regions: 'us',
          markets: 'h2h,spreads,totals',
          oddsFormat: 'american'
        }
      });

      const events: OddsApiEvent[] = response.data;
      
      // Track requests remaining
      const remaining = response.headers['x-requests-remaining'];
      if (remaining) {
        result.requestsRemaining = parseInt(remaining, 10);
      }

      if (!events || events.length === 0) {
        logger.info(`No events found for ${sportKey}`);
        return result;
      }

      logger.info(`Processing ${events.length} events for ${sportKey}`);

      // Process each event
      for (const event of events) {
        try {
          // Upsert game
          const game = await this.upsertGame(event, sportKey);
          result.gamesProcessed++;

          // Process bookmakers
          for (const bookmaker of event.bookmakers) {
            try {
              const oddsCount = await this.upsertOdds(game.id, bookmaker);
              result.oddsProcessed += oddsCount.current;
              result.snapshotsCreated += oddsCount.snapshots;
            } catch (error) {
              const errorMsg = `Failed to upsert odds for ${bookmaker.key}: ${error instanceof Error ? error.message : 'Unknown error'}`;
              logger.error(errorMsg);
              result.errors.push(errorMsg);
            }
          }
        } catch (error) {
          const errorMsg = `Failed to process event ${event.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          logger.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      logger.info(`Completed ${sportKey}: ${result.gamesProcessed} games, ${result.oddsProcessed} odds`);

    } catch (error) {
      const errorMsg = `Failed to fetch odds for ${sportKey}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(errorMsg);
      result.success = false;
      result.errors.push(errorMsg);

      // Check for rate limit errors
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        logger.error('Rate limit exceeded!');
      }
    }

    return result;
  }

  /**
   * Upsert a game record
   */
  private async upsertGame(event: OddsApiEvent, sportKey: string): Promise<{ id: string }> {
    // Get sport ID
    const sport = await prisma.sport.findUnique({
      where: { key: sportKey },
      select: { id: true }
    });

    if (!sport) {
      throw new Error(`Sport not found: ${sportKey}`);
    }

    // Fetch weather for outdoor games
    let weather: string | null = null;
    const outdoorSports = ['americanfootball_nfl', 'baseball_mlb'];
    
    if (outdoorSports.includes(sportKey)) {
      try {
        const weatherInfo = await espnWeatherService.getWeatherForGame(
          sportKey,
          event.home_team,
          event.away_team
        );
        
        if (weatherInfo) {
          weather = espnWeatherService.formatWeather(weatherInfo);
        }
      } catch (error) {
        // Weather fetch is non-critical, just log and continue
        logger.debug(`Could not fetch weather for ${event.home_team} vs ${event.away_team}`);
      }
    }

    // Upsert game
    const game = await prisma.game.upsert({
      where: { externalId: event.id },
      update: {
        homeTeamName: event.home_team,
        awayTeamName: event.away_team,
        commenceTime: new Date(event.commence_time),
        weather: weather,
        updatedAt: new Date()
      },
      create: {
        externalId: event.id,
        sportId: sport.id,
        homeTeamName: event.home_team,
        awayTeamName: event.away_team,
        commenceTime: new Date(event.commence_time),
        weather: weather,
        status: 'scheduled'
      },
      select: { id: true }
    });

    return game;
  }

  /**
   * Upsert odds for a bookmaker
   */
  private async upsertOdds(
    gameId: string,
    bookmaker: OddsApiBookmaker
  ): Promise<{ current: number; snapshots: number }> {
    let currentCount = 0;
    let snapshotCount = 0;

    // Process each market type
    for (const market of bookmaker.markets) {
      try {
        const parsedOdds = this.parseMarketOdds(market);
        
        if (!parsedOdds) {
          continue;
        }

        // Upsert current odds
        await prisma.currentOdds.upsert({
          where: {
            gameId_bookmaker_marketType: {
              gameId,
              bookmaker: bookmaker.key,
              marketType: market.key
            }
          },
          update: {
            ...parsedOdds,
            lastUpdated: new Date(market.last_update)
          },
          create: {
            gameId,
            bookmaker: bookmaker.key,
            marketType: market.key,
            ...parsedOdds,
            lastUpdated: new Date(market.last_update)
          }
        });
        currentCount++;

        // Create snapshot for history
        await prisma.oddsSnapshot.create({
          data: {
            gameId,
            bookmaker: bookmaker.key,
            marketType: market.key,
            ...parsedOdds,
            capturedAt: new Date()
          }
        });
        snapshotCount++;

      } catch (error) {
        logger.error(`Failed to process market ${market.key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { current: currentCount, snapshots: snapshotCount };
  }

  /**
   * Parse market odds based on market type
   */
  private parseMarketOdds(market: OddsApiMarket): ParsedMarketOdds | null {
    const odds: ParsedMarketOdds = {};

    if (market.key === 'h2h') {
      // Moneyline odds
      for (const outcome of market.outcomes) {
        if (outcome.name.toLowerCase().includes('home') || market.outcomes.indexOf(outcome) === 0) {
          odds.homePrice = outcome.price;
        } else {
          odds.awayPrice = outcome.price;
        }
      }
    } else if (market.key === 'spreads') {
      // Spread odds
      for (const outcome of market.outcomes) {
        if (outcome.point !== undefined) {
          if (outcome.name.toLowerCase().includes('home') || market.outcomes.indexOf(outcome) === 0) {
            odds.homeSpread = outcome.point;
            odds.homeSpreadPrice = outcome.price;
          } else {
            odds.awaySpread = outcome.point;
            odds.awaySpreadPrice = outcome.price;
          }
        }
      }
    } else if (market.key === 'totals') {
      // Total odds
      for (const outcome of market.outcomes) {
        if (outcome.point !== undefined) {
          odds.totalLine = outcome.point;
          if (outcome.name.toLowerCase() === 'over') {
            odds.overPrice = outcome.price;
          } else if (outcome.name.toLowerCase() === 'under') {
            odds.underPrice = outcome.price;
          }
        }
      }
    }

    // Return null if no odds were parsed
    return Object.keys(odds).length > 0 ? odds : null;
  }
}

// Export singleton instance
export const oddsSyncService = new OddsSyncService();
