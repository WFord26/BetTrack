/**
 * Unit tests for ESPN Weather Service
 * 
 * Tests weather data fetching from ESPN API for outdoor sports
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MockAdapter from 'axios-mock-adapter';

// Mock axios - MUST be before service import
jest.mock('axios', () => {
  const mockAxiosInstance = {
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  };
  const mockAxios = {
    create: jest.fn(() => mockAxiosInstance),
    ...mockAxiosInstance
  };
  return {
    __esModule: true,
    default: mockAxios
  };
});

import { EspnWeatherService } from '../src/services/espn-weather.service';

// Get mocked instances after imports
import axios from 'axios';

const mockAxios = axios as jest.Mocked<typeof axios>;

describe('EspnWeatherService', () => {
  let service: EspnWeatherService;
  let mockAxios: MockAdapter;

  beforeEach(() => {
    service = new EspnWeatherService();
    mockAxios = new MockAdapter(axios);
    jest.clearAllMocks();
  });

  describe('getWeatherForGame', () => {
    it('should return weather data for outdoor NFL games', async () => {
        const mockWeatherResponse = {
            events: [{
            competitions: [{
                weather: {
                temperature: 72,
                displayValue: 'Sunny',
                conditionId: '1'
                }
            }]
            }]
        };

        mockAxios.onGet(/.+/).reply(200, mockWeatherResponse);

        const result = await service.getWeatherForGame(
            'americanfootball_nfl',
            'Kansas City Chiefs',
            'Buffalo Bills'
        );

        expect(result).toBeDefined();
        expect(result?.temperature).toBe(72);
        expect(result?.condition).toBe('Sunny');
        });

    it('should return weather data for outdoor MLB games', async () => {
      const mockWeatherResponse = {
        data: {
          events: [{
            competitions: [{
              weather: {
                temperature: 85,
                displayValue: 'Partly Cloudy',
                conditionId: '2'
              }
            }]
          }]
        }
      };

      mockAxios.onGet(/.+/).reply(200, mockWeatherResponse);

      const result = await service.getWeatherForGame(
        'baseball_mlb',
        'New York Yankees',
        'Boston Red Sox'
      );

      expect(result).toBeDefined();
      expect(result?.temperature).toBe(85);
      expect(result?.condition).toBe('Partly Cloudy');
    });

    it('should return null for indoor sports (NBA)', async () => {
      const result = await service.getWeatherForGame(
        'basketball_nba',
        'Los Angeles Lakers',
        'Boston Celtics'
      );

      expect(result).toBeNull();
    });

    it('should return null for indoor sports (NHL)', async () => {
      const result = await service.getWeatherForGame(
        'icehockey_nhl',
        'Toronto Maple Leafs',
        'Montreal Canadiens'
      );

      expect(result).toBeNull();
    });

    it('should return null when sport mapping is not found', async () => {
      const result = await service.getWeatherForGame(
        'unknown_sport',
        'Team A',
        'Team B'
      );

      expect(result).toBeNull();
    });

    it('should return null when no matching game is found', async () => {
      const mockWeatherResponse = {
        data: {
          events: []
        }
      };

      mockAxios.onGet(/.+/).reply(200, mockWeatherResponse);

      const result = await service.getWeatherForGame(
        'americanfootball_nfl',
        'Nonexistent Team',
        'Another Fake Team'
      );

      expect(result).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      mockAxios.onGet(/.+/).networkError();

      const result = await service.getWeatherForGame(
        'americanfootball_nfl',
        'Kansas City Chiefs',
        'Buffalo Bills'
      );

      expect(result).toBeNull();
    });

    it('should handle network timeouts gracefully', async () => {
      mockAxios.onGet(/.+/).timeout();

      const result = await service.getWeatherForGame(
        'americanfootball_nfl',
        'Kansas City Chiefs',
        'Buffalo Bills'
      );

      expect(result).toBeNull();
    });

    it('should handle missing weather data in response', async () => {
      const mockWeatherResponse = {
        data: {
          events: [{
            competitions: [{}] // No weather field
          }]
        }
      };

      mockAxios.onGet(/.+/).reply(200, mockWeatherResponse);

      const result = await service.getWeatherForGame(
        'americanfootball_nfl',
        'Kansas City Chiefs',
        'Buffalo Bills'
      );

      expect(result).toBeNull();
    });

    it('should match games using fuzzy team name matching', async () => {
      const mockWeatherResponse = {
        data: {
          events: [{
            competitions: [{
              competitors: [
                { team: { displayName: 'Kansas City Chiefs' } },
                { team: { displayName: 'Buffalo Bills' } }
              ],
              weather: {
                temperature: 65,
                displayValue: 'Clear',
                conditionId: '1'
              }
            }]
          }]
        }
      };

      mockAxios.onGet(/.+/).reply(200, mockWeatherResponse);

      const result = await service.getWeatherForGame(
        'americanfootball_nfl',
        'Chiefs', // Partial name
        'Bills'   // Partial name
      );

      expect(result).toBeDefined();
      expect(result?.temperature).toBe(65);
    });
  });
});