import axios, { AxiosInstance, AxiosError } from 'axios';
import { RateLimiter } from 'limiter';
import { logger } from '../../config/logger';

/** API-Sports splits its catalogue across one host per sport family. */
export type ApiSportsSport = 'american-football' | 'basketball' | 'hockey' | 'baseball' | 'football';

interface ApiSportsConfig {
  apiKey: string;
  sport: ApiSportsSport;
  tier?: 'free' | 'pro' | 'ultra' | 'mega';
}

/** Every API-Sports endpoint wraps its payload in a `response` array. */
export interface ApiSportsResponse<T> {
  response?: T[];
}

const BASE_URLS = {
  'american-football': 'https://v1.american-football.api-sports.io',
  'basketball': 'https://v1.basketball.api-sports.io',
  'hockey': 'https://v1.hockey.api-sports.io',
  'baseball': 'https://v1.baseball.api-sports.io',
  'football': 'https://v3.football.api-sports.io',
};

// Requests/second by API-Sports subscription tier.
const TIER_REQUESTS_PER_SECOND: Record<NonNullable<ApiSportsConfig['tier']>, number> = {
  free: 1,
  pro: 5,
  ultra: 10,
  mega: 20,
};

const MAX_RATE_LIMIT_RETRIES = 3;

export class ApiSportsClient {
  private client: AxiosInstance;
  private limiter: RateLimiter;
  private sport: string;
  private lastRemainingRequests?: number;

  constructor(config: ApiSportsConfig) {
    this.sport = config.sport;
    this.client = axios.create({
      baseURL: BASE_URLS[config.sport],
      headers: {
        'x-apisports-key': config.apiKey,
      },
      timeout: 10000,
    });

    const tier = config.tier ?? 'pro';
    this.limiter = new RateLimiter({
      tokensPerInterval: TIER_REQUESTS_PER_SECOND[tier],
      interval: 'second' as any,
    });

    logger.info(`ApiSportsClient initialized for ${config.sport} (${tier} tier)`);
  }

  async get<T>(endpoint: string, params?: Record<string, any>, retryCount = 0): Promise<T> {
    // Wait for rate limiter token
    await this.limiter.removeTokens(1);

    try {
      const response = await this.client.get(endpoint, { params });

      // Log rate limit info if available
      const remainingHeader = response.headers['x-ratelimit-requests-remaining'];
      const remaining = Array.isArray(remainingHeader)
        ? parseInt(remainingHeader[0], 10)
        : parseInt(String(remainingHeader), 10);

      if (!Number.isNaN(remaining)) {
        this.lastRemainingRequests = remaining;
        logger.debug(`API-Sports rate limit remaining: ${remaining}`);
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        // Handle rate limiting
        if (axiosError.response?.status === 429) {
          if (retryCount >= MAX_RATE_LIMIT_RETRIES) {
            throw new Error(
              `API-Sports ${this.sport} request failed: rate limited after ${MAX_RATE_LIMIT_RETRIES} retries`
            );
          }
          logger.warn(`Rate limited by API-Sports, waiting 60s (retry ${retryCount + 1}/${MAX_RATE_LIMIT_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, 60000));
          return this.get(endpoint, params, retryCount + 1);
        }

        // Handle other errors
        logger.error(`API-Sports request failed: ${axiosError.message}`, {
          endpoint,
          status: axiosError.response?.status,
          data: axiosError.response?.data,
        });

        throw new Error(`API-Sports ${this.sport} request failed: ${axiosError.message}`);
      }

      throw error;
    }
  }

  getLastRemainingRequests(): number | undefined {
    return this.lastRemainingRequests;
  }

  hasSufficientRemaining(minimumRemaining: number): boolean {
    if (this.lastRemainingRequests === undefined) {
      return true;
    }

    return this.lastRemainingRequests >= minimumRemaining;
  }
}
