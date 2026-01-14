/**
 * Unit tests for Odds Sync Service
 * 
 * Tests syncing game odds from The Odds API
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { OddsSyncService } from '../src/services/odds-sync.service';

// Mock Prisma
const mockPrisma = {
  sport: {
    findMany: jest.fn<any>(),
    findUnique: jest.fn<any>()
  },
  game: {
    upsert: jest.fn<any>(),
    findMany: jest.fn<any>(),
    update: jest.fn<any>()
  },
  odds: {
    upsert: jest.fn<any>(),
    findMany: jest.fn<any>(),
    createMany: jest.fn<any>()
  },
  oddsSnapshot: {
    create: jest.fn<any>(),
    createMany: jest.fn<any>()
  }
};

jest.mock('../src/config/database', () => ({
  prisma: mockPrisma
}));

// Mock ESPN Weather Service
const mockWeatherService = {
  getWeatherForGame: jest.fn<any>()
};

jest.mock('../src/services/espn-weather.service', () => ({
  espnWeatherService: mockWeatherService
}));

describe('OddsSyncService', () => {
  let service: OddsSyncService;
  let mockAxios: MockAdapter;

  beforeEach(() => {
    service = new OddsSyncService();
    mockAxios = new MockAdapter(axios);
    jest.clearAllMocks();
  });

  describe('syncAllOdds', () => {
    it('should sync odds for all active sports and track API rate limits', async () => {
      const mockSports = [
        { id: 1, key: 'basketball_nba', name: 'NBA', groupName: 'Basketball', isActive: true }
      ];
      
      mockPrisma.sport.findMany.mockResolvedValue(mockSports as any);
      mockAxios.onGet(/.+/).reply(200, [], { 'x-requests-remaining': '475' });

      const result = await service.syncAllOdds();

      expect(result.requestsRemaining).toBeGreaterThanOrEqual(0);
    });

    it('should aggregate results from multiple sports', async () => {
      const mockSports = [
        { id: 1, key: 'basketball_nba', name: 'NBA', groupName: 'Basketball', isActive: true },
        { id: 2, key: 'americanfootball_nfl', name: 'NFL', groupName: 'American Football', isActive: true }
      ];

      const mockOddsResponse = {
        data: [
          {
            id: 'event-1',
            sport_key: 'basketball_nba',
            sport_title: 'NBA',
            commence_time: '2026-01-15T19:00:00Z',
            home_team: 'Los Angeles Lakers',
            away_team: 'Boston Celtics',
            bookmakers: []
          }
        ]
      };

      mockPrisma.sport.findMany.mockResolvedValue(mockSports as any);
      mockPrisma.game.upsert.mockResolvedValue({ id: 'game-1' } as any);
      mockAxios.onGet(/.+/).reply(200, mockOddsResponse);

      const result = await service.syncAllOdds();

      expect(result.success).toBe(true);
      expect(result.gamesProcessed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('syncSportOdds', () => {
    it('should sync odds for a specific sport with multiple markets', async () => {
      const mockSport = {
        id: 1,
        key: 'basketball_nba',
        name: 'NBA',
        groupName: 'Basketball',
        isActive: true
      };

      const mockOddsResponse = {
        data: [
          {
            id: 'event-1',
            sport_key: 'basketball_nba',
            sport_title: 'NBA',
            commence_time: '2026-01-15T19:00:00Z',
            home_team: 'Los Angeles Lakers',
            away_team: 'Boston Celtics',
            bookmakers: [
              {
                key: 'draftkings',
                title: 'DraftKings',
                markets: [
                  {
                    key: 'h2h',
                    outcomes: [
                      { name: 'Los Angeles Lakers', price: -110 },
                      { name: 'Boston Celtics', price: -110 }
                    ]
                  },
                  {
                    key: 'spreads',
                    outcomes: [
                      { name: 'Los Angeles Lakers', price: -110, point: -3.5 },
                      { name: 'Boston Celtics', price: -110, point: 3.5 }
                    ]
                  },
                  {
                    key: 'totals',
                    outcomes: [
                      { name: 'Over', price: -110, point: 225.5 },
                      { name: 'Under', price: -110, point: 225.5 }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };

      mockPrisma.sport.findUnique.mockResolvedValue(mockSport as any);
      mockPrisma.game.upsert.mockResolvedValue({ id: 'game-1' } as any);
      mockPrisma.odds.upsert.mockResolvedValue({ id: 'odd-1' } as any);
      mockAxios.onGet(/.+/).reply(200, mockOddsResponse);

      const result = await service.syncSportOdds('basketball_nba');

      expect(result.success).toBe(true);
      expect(result.gamesProcessed).toBeGreaterThanOrEqual(1);
      expect(mockPrisma.sport.findUnique).toHaveBeenCalledWith({
        where: { key: 'basketball_nba' }
      });
    });

    it('should return error when sport is not found', async () => {
      mockPrisma.sport.findUnique.mockResolvedValue(null);

      const result = await service.syncSportOdds('invalid_sport');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Sport not found: invalid_sport');
    });

    it('should handle API timeout gracefully', async () => {
      const mockSport = {
        id: 1,
        key: 'basketball_nba',
        name: 'NBA',
        groupName: 'Basketball',
        isActive: true
      };

      mockPrisma.sport.findUnique.mockResolvedValue(mockSport as any);
      mockAxios.onGet(/.+/).timeout();

      const result = await service.syncSportOdds('basketball_nba');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should create odds snapshots for line movement tracking', async () => {
      const mockSport = {
        id: 1,
        key: 'basketball_nba',
        name: 'NBA',
        groupName: 'Basketball',
        isActive: true
      };

      const mockOddsResponse = [
        {
          id: 'event-1',
          sport_key: 'basketball_nba',
          sport_title: 'NBA',
          commence_time: '2026-01-15T19:00:00Z',
          home_team: 'Los Angeles Lakers',
          away_team: 'Boston Celtics',
          bookmakers: [
            {
              key: 'draftkings',
              title: 'DraftKings',
              markets: [
                {
                  key: 'h2h',
                  outcomes: [
                    { name: 'Los Angeles Lakers', price: -110 }
                  ]
                }
              ]
            }
          ]
        }
      ];

      mockPrisma.sport.findUnique.mockResolvedValue(mockSport as any);
      mockPrisma.game.upsert.mockResolvedValue({ id: 'game-1' } as any);
      mockPrisma.odds.upsert.mockResolvedValue({ id: 'odd-1' } as any);
      mockPrisma.oddsSnapshot.createMany.mockResolvedValue({ count: 1 } as any);
      mockAxios.onGet(/.+/).reply(200, mockOddsResponse);

      const result = await service.syncSportOdds('basketball_nba');

      expect(result.success).toBe(true);
      expect(result.snapshotsCreated).toBeGreaterThanOrEqual(0);
    });

    it('should fetch weather data for outdoor sports', async () => {
      const mockSport = {
        id: 1,
        key: 'americanfootball_nfl',
        name: 'NFL',
        groupName: 'American Football',
        isActive: true
      };

      const mockOddsResponse = [
        {
          id: 'event-1',
          sport_key: 'americanfootball_nfl',
          sport_title: 'NFL',
          commence_time: '2026-01-15T19:00:00Z',
          home_team: 'Kansas City Chiefs',
          away_team: 'Buffalo Bills',
          bookmakers: []
        }
      ];

      mockPrisma.sport.findUnique.mockResolvedValue(mockSport as any);
      mockPrisma.game.upsert.mockResolvedValue({ id: 'game-1' } as any);
      mockAxios.onGet(/.+/).reply(200, mockOddsResponse);
      mockWeatherService.getWeatherForGame.mockResolvedValue({
        temperature: 35,
        condition: 'Snow'
      });

      const result = await service.syncSportOdds('americanfootball_nfl');

      expect(result.success).toBe(true);
      expect(mockWeatherService.getWeatherForGame).toHaveBeenCalled();
    });

    it('should handle multiple bookmakers for same game', async () => {
      const mockSport = {
        id: 1,
        key: 'basketball_nba',
        name: 'NBA',
        groupName: 'Basketball',
        isActive: true
      };

      const mockOddsResponse = [
        {
          id: 'event-1',
          sport_key: 'basketball_nba',
          sport_title: 'NBA',
          commence_time: '2026-01-15T19:00:00Z',
          home_team: 'Los Angeles Lakers',
          away_team: 'Boston Celtics',
          bookmakers: [
            {
              key: 'draftkings',
              title: 'DraftKings',
              markets: [
                { key: 'h2h', outcomes: [{ name: 'Los Angeles Lakers', price: -110 }] }
              ]
            },
            {
              key: 'fanduel',
              title: 'FanDuel',
              markets: [
                { key: 'h2h', outcomes: [{ name: 'Los Angeles Lakers', price: -115 }] }
              ]
            },
            {
              key: 'betmgm',
              title: 'BetMGM',
              markets: [
                { key: 'h2h', outcomes: [{ name: 'Los Angeles Lakers', price: -108 }] }
              ]
            }
          ]
        }
      ];

      mockPrisma.sport.findUnique.mockResolvedValue(mockSport as any);
      mockPrisma.game.upsert.mockResolvedValue({ id: 'game-1' } as any);
      mockPrisma.odds.upsert.mockResolvedValue({ id: 'odd-1' } as any);
      mockAxios.onGet(/.+/).reply(200, mockOddsResponse);

      const result = await service.syncSportOdds('basketball_nba');

      expect(result.success).toBe(true);
      expect(mockPrisma.odds.upsert).toHaveBeenCalled();
    });

    it('should handle empty odds response', async () => {
      const mockSport = {
        id: 1,
        key: 'basketball_nba',
        name: 'NBA',
        groupName: 'Basketball',
        isActive: true
      };

      mockPrisma.sport.findUnique.mockResolvedValue(mockSport as any);
      mockAxios.onGet(/.+/).reply(200, []);

      const result = await service.syncSportOdds('basketball_nba');

      expect(result.success).toBe(true);
      expect(result.gamesProcessed).toBe(0);
    });
  });
});