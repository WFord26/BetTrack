import axios, { AxiosInstance } from 'axios';
import { logger } from '../config/logger';
import { ESPN_SPORT_MAPPING } from '../types/outcome.types';

/**
 * Weather information from ESPN
 */
export interface WeatherInfo {
  temperature?: number;
  condition?: string;
  icon?: string;
}

/**
 * Service for fetching weather data from ESPN API
 */
export class EspnWeatherService {
  private client: AxiosInstance;
  private readonly baseUrl = 'https://site.api.espn.com/apis/site/v2/sports';

  constructor() {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Fetch weather for a specific game
   * ESPN provides weather in the event details API
   */
  async getWeatherForGame(
    sportKey: string,
    homeTeamName: string,
    awayTeamName: string
  ): Promise<WeatherInfo | null> {
    const mapping = ESPN_SPORT_MAPPING[sportKey];

    if (!mapping) {
      logger.debug(`No ESPN mapping for sport: ${sportKey}`);
      return null;
    }

    // Only fetch weather for outdoor sports
    const outdoorSports = ['americanfootball_nfl', 'baseball_mlb'];
    if (!outdoorSports.includes(sportKey)) {
      return null;
    }

    try {
      // Fetch scoreboard to get event ID
      const scoreboardResponse = await this.client.get(
        `/${mapping.sport}/${mapping.league}/scoreboard`
      );

      if (!scoreboardResponse.data.events) {
        return null;
      }

      // Find matching event
      const matchedEvent = scoreboardResponse.data.events.find((event: any) => {
        const competition = event.competitions?.[0];
        if (!competition?.competitors) return false;

        const homeComp = competition.competitors.find((c: any) => c.homeAway === 'home');
        const awayComp = competition.competitors.find((c: any) => c.homeAway === 'away');

        return (
          homeComp?.team?.displayName?.toLowerCase().includes(homeTeamName.toLowerCase()) ||
          awayComp?.team?.displayName?.toLowerCase().includes(awayTeamName.toLowerCase())
        );
      });

      if (!matchedEvent) {
        return null;
      }

      // Check if weather data exists in competition
      const competition = matchedEvent.competitions?.[0];
      const weather = competition?.weather;

      if (weather) {
        return {
          temperature: weather.temperature,
          condition: weather.displayValue || weather.conditionId,
          icon: weather.link?.href
        };
      }

      return null;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.debug(`ESPN weather fetch error: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Format weather for display
   */
  formatWeather(weather: WeatherInfo | null): string {
    if (!weather) {
      return '';
    }

    const parts: string[] = [];

    if (weather.temperature) {
      parts.push(`${weather.temperature}°F`);
    }

    if (weather.condition) {
      parts.push(weather.condition);
    }

    return parts.join(', ');
  }
}

export const espnWeatherService = new EspnWeatherService();
