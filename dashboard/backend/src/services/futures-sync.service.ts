import axios, { AxiosInstance } from 'axios';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';

interface FuturesApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time?: string;
  home_team?: string;
  away_team?: string;
  bookmakers: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string;
      outcomes: Array<{
        name: string;
        description?: string;
        price: number;
      }>;
    }>;
  }>;
}

interface FuturesSyncResult {
  success: boolean;
  futuresProcessed: number;
  oddsProcessed: number;
  snapshotsCreated: number;
  errors: string[];
  requestsRemaining?: number;
}

/**
 * Service for syncing futures (outrights) from The Odds API
 * 
 * Handles:
 * - Fetching championship/tournament winners
 * - Upserting futures and odds data
 * - Creating historical snapshots
 */
export class FuturesSyncService {
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
   * Sync futures for all active sports
   * Fetches outright sports from API (e.g., nfl_super_bowl_winner)
   */
  async syncAllFutures(): Promise<FuturesSyncResult> {
    logger.info('Starting futures sync for all sports...');

    const result: FuturesSyncResult = {
      success: true,
      futuresProcessed: 0,
      oddsProcessed: 0,
      snapshotsCreated: 0,
      errors: []
    };

    try {
      // Fetch outright sports from API (these are separate sport keys)
      logger.info('Fetching outright sports from Odds API...');
      const sportsResponse = await this.client.get('/v4/sports');
      
      const allSports = sportsResponse.data;
      const outrightSports = allSports.filter((sport: any) => sport.has_outrights === true && sport.active === true);

      if (outrightSports.length === 0) {
        logger.warn('No active outright sports found from API');
        return result;
      }

      logger.info(`Found ${outrightSports.length} active outright sports to sync`);

      // Sync each outright sport
      for (const sport of outrightSports) {
        try {
          const sportResult = await this.syncSportFutures(sport.key);
          
          result.futuresProcessed += sportResult.futuresProcessed;
          result.oddsProcessed += sportResult.oddsProcessed;
          result.snapshotsCreated += sportResult.snapshotsCreated;
          result.errors.push(...sportResult.errors);

          if (sportResult.requestsRemaining !== undefined) {
            result.requestsRemaining = sportResult.requestsRemaining;
          }
        } catch (error) {
          const errorMsg = `Error syncing futures for ${sport.key}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          logger.error(errorMsg);
          result.errors.push(errorMsg);
          result.success = false;
        }
      }

      logger.info(`Futures sync completed. Processed ${result.futuresProcessed} futures, ${result.oddsProcessed} odds`);
      return result;
    } catch (error) {
      logger.error('Fatal error in futures sync:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Sync futures for a specific sport
   */
  async syncSportFutures(sportKey: string): Promise<FuturesSyncResult> {
    logger.info(`Syncing futures for ${sportKey}...`);

    const result: FuturesSyncResult = {
      success: true,
      futuresProcessed: 0,
      oddsProcessed: 0,
      snapshotsCreated: 0,
      errors: []
    };

    try {
      // Fetch futures from API
      // Note: For outright sports, we don't specify markets parameter
      // The sport key itself (e.g., americanfootball_nfl_super_bowl_winner) IS the outright
      const response = await this.client.get(`/v4/sports/${sportKey}/odds`, {
        params: {
          regions: 'us',
          oddsFormat: 'american'
        }
      });

      const events: FuturesApiEvent[] = response.data;
      
      // Track requests remaining
      const remaining = response.headers['x-requests-remaining'];
      if (remaining) {
        result.requestsRemaining = parseInt(remaining, 10);
      }

      if (!events || events.length === 0) {
        logger.info(`No futures found for ${sportKey}`);
        return result;
      }

      logger.info(`Processing ${events.length} futures for ${sportKey}`);

      // Process each future
      for (const event of events) {
        try {
          // Upsert future
          const future = await this.upsertFuture(event, sportKey);
          result.futuresProcessed++;

          // Process bookmakers
          for (const bookmaker of event.bookmakers) {
            try {
              // Get outrights market
              const outrightsMarket = bookmaker.markets.find(m => m.key === 'outrights');
              if (!outrightsMarket) continue;

              for (const outcome of outrightsMarket.outcomes) {
                // Upsert current odds
                await prisma.currentFutureOdds.upsert({
                  where: {
                    futureId_bookmaker_outcome: {
                      futureId: future.id,
                      bookmaker: bookmaker.key,
                      outcome: outcome.name
                    }
                  },
                  update: {
                    price: outcome.price,
                    lastUpdated: new Date()
                  },
                  create: {
                    futureId: future.id,
                    bookmaker: bookmaker.key,
                    outcome: outcome.name,
                    price: outcome.price
                  }
                });
                result.oddsProcessed++;

                // Create snapshot
                await prisma.futureOddsSnapshot.create({
                  data: {
                    futureId: future.id,
                    bookmaker: bookmaker.key,
                    outcome: outcome.name,
                    price: outcome.price
                  }
                });
                result.snapshotsCreated++;

                // Upsert outcome in outcomes table
                await prisma.futureOutcome.upsert({
                  where: {
                    futureId_outcome: {
                      futureId: future.id,
                      outcome: outcome.name
                    }
                  },
                  update: {
                    description: outcome.description
                  },
                  create: {
                    futureId: future.id,
                    outcome: outcome.name,
                    description: outcome.description
                  }
                });
              }
            } catch (error) {
              logger.error(`Error processing bookmaker ${bookmaker.key}:`, error);
              result.errors.push(`Bookmaker ${bookmaker.key}: ${error instanceof Error ? error.message : 'Unknown'}`);
            }
          }
        } catch (error) {
          logger.error(`Error processing future ${event.id}:`, error);
          result.errors.push(`Future ${event.id}: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }

      return result;
    } catch (error) {
      logger.error(`Error syncing futures for ${sportKey}:`, error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Map outright sport key to base sport key
   * e.g., americanfootball_nfl_super_bowl_winner -> americanfootball_nfl
   */
  private getBaseSportKey(outrightSportKey: string): string {
    // Outright keys follow pattern: {base_sport_key}_{event_name}
    // Examples:
    // - americanfootball_nfl_super_bowl_winner -> americanfootball_nfl
    // - basketball_nba_championship_winner -> basketball_nba
    // - golf_masters_tournament_winner -> golf (special case)
    
    // Special cases
    if (outrightSportKey.startsWith('golf_')) {
      return 'golf';
    }
    if (outrightSportKey.startsWith('politics_')) {
      return 'politics';
    }
    if (outrightSportKey.startsWith('soccer_')) {
      // soccer_fifa_world_cup_winner -> soccer_fifa_world_cup or just base league
      const parts = outrightSportKey.split('_');
      // Return first 2-3 parts depending on structure
      if (parts.length > 3) {
        return parts.slice(0, 3).join('_'); // soccer_fifa_world_cup
      }
      return parts.slice(0, 2).join('_');
    }
    
    // Standard pattern: sport_league_event_winner
    // Take first 2 parts: americanfootball_nfl
    const parts = outrightSportKey.split('_');
    if (parts.length >= 2) {
      return `${parts[0]}_${parts[1]}`;
    }
    
    return outrightSportKey;
  }

  /**
   * Upsert a future in the database
   */
  private async upsertFuture(event: FuturesApiEvent, sportKey: string) {
    // Map outright sport key to base sport key
    const baseSportKey = this.getBaseSportKey(sportKey);
    
    // Get sport ID from base sport
    const sport = await prisma.sport.findUnique({
      where: { key: baseSportKey },
      select: { id: true, name: true }
    });

    if (!sport) {
      logger.warn(`Base sport not found: ${baseSportKey} (from outright: ${sportKey})`);
      throw new Error(`Sport not found: ${baseSportKey}`);
    }

    // Use the event title from API (e.g., "Super Bowl Winner 2026")
    const title = event.sport_title || `${sport.name} Championship`;

    return prisma.future.upsert({
      where: { externalId: event.id },
      update: {
        title,
        status: 'active'
      },
      create: {
        externalId: event.id,
        sportId: sport.id,
        title,
        status: 'active'
      }
    });
  }
}

export const futuresSyncService = new FuturesSyncService();
