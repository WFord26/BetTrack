import axios, { AxiosInstance, AxiosError } from 'axios';
import { RateLimiter } from 'limiter';
import { logger } from '../../config/logger';

interface ApiSportsConfig {
  apiKey: string;
  sport: 'american-football' | 'basketball' | 'hockey';
}

const BASE_URLS = {
  'american-football': 'https://v1.american-football.api-sports.io',
  'basketball': 'https://v1.basketball.api-sports.io',
  'hockey': 'https://v1.hockey.api-sports.io',
};

export class ApiSportsClient {
  private client: AxiosInstance;
  private limiter: RateLimiter;
  private sport: string;

  constructor(config: ApiSportsConfig) {
    this.sport = config.sport;
    this.client = axios.create({
      baseURL: BASE_URLS[config.sport],
      headers: {
        'x-apisports-key': config.apiKey,
      },
      timeout: 10000,
    });

    // Pro tier: 300 requests/minute = 5 requests/second
    this.limiter = new RateLimiter({
      tokensPerInterval: 5,
      interval: 'second' as any,
    });

    logger.info(`ApiSportsClient initialized for ${config.sport}`);
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    // Wait for rate limiter token
    await this.limiter.removeTokens(1);

    try {
      const response = await this.client.get(endpoint, { params });
      
      // Log rate limit info if available
      const remaining = response.headers['x-ratelimit-requests-remaining'];
      if (remaining) {
        logger.debug(`API-Sports rate limit remaining: ${remaining}`);
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        // Handle rate limiting
        if (axiosError.response?.status === 429) {
          logger.warn(`Rate limited by API-Sports, waiting 60s`);
          await new Promise(resolve => setTimeout(resolve, 60000));
          return this.get(endpoint, params);
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
}
