/**
 * Unit tests for Futures Sync Service
 * 
 * Tests championship/tournament futures synchronization from The Odds API
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FuturesSyncService } from '../src/services/futures-sync.service';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Mock Prisma
const mockPrisma = {
  sport: {
    findMany: jest.fn<any>(),
    findUnique: jest.fn<any>()
  },
  future: {
    upsert: jest.fn<any>()
  },
  futureOdd: {
    createMany: jest.fn<any>()
  },
  oddsSnapshot: {
    create: jest.fn<any>()
  }
};

jest.mock('../src/config/database', () => ({
  prisma: mockPrisma
}));

describe('FuturesSyncService', () => {
  let service: FuturesSyncService;
  let mockAxios: MockAdapter;

  beforeEach(() => {
    service = new FuturesSyncService();
    mockAxios = new MockAdapter(axios);
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockAxios.reset();
  });

  describe('syncAllFutures', () => {
    it('should sync futures for all active sports', async () => {
      const mockSports = [
        { id: 1, key: 'basketball_nba', name: 'NBA', groupName: 'Basketball', isActive: true },
        { id: 2, key: 'americanfootball_nfl', name: 'NFL', groupName: 'American Football', isActive: true }
      ];

      const mockFuturesResponse = [
        {
          id: 'nba_championship',
          sport_key: 'basketball_nba',
          sport_title: 'NBA',
          commence_time: '2026-06-01T00:00:00Z',
          bookmakers: [
            {
              key: 'draftkings',
              title: 'DraftKings',
              markets: [
                {
                  key: 'outrights',
                  outcomes: [
                    { name: 'Boston Celtics', price: 5.0 },
                    { name: 'Los Angeles Lakers', price: 6.5 }
                  ]
                }
              ]
            }
          ]
        }
      ];

      mockPrisma.sport.findMany.mockResolvedValue(mockSports);
      mockPrisma.future.upsert.mockResolvedValue({ id: 'future-1' });
      mockPrisma.futureOdd.createMany.mockResolvedValue({ count: 2 });
      mockAxios.onGet(/odds/).reply(200, mockFuturesResponse);

      const result = await service.syncAllFutures();

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('sportCount');
    });

    it('should handle API errors gracefully', async () => {
      const mockSports = [
        { id: 1, key: 'basketball_nba', name: 'NBA', groupName: 'Basketball', isActive: true }
      ];

      mockPrisma.sport.findMany.mockResolvedValue(mockSports);
      mockAxios.onGet(/odds/).networkError();

      const result = await service.syncAllFutures();

      expect(result).toHaveProperty('errors');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should skip sports with no futures markets', async () => {
      const mockSports = [
        { id: 1, key: 'basketball_nba', name: 'NBA', groupName: 'Basketball', isActive: true }
      ];

      mockPrisma.sport.findMany.mockResolvedValue(mockSports);
      mockAxios.onGet(/odds/).reply(200, []);

      const result = await service.syncAllFutures();

      expect(result.success).toBe(true);
    });
  });

  describe('syncSportFutures', () => {
    it('should sync futures for specific sport', async () => {
      const mockSport = { 
        id: 1, 
        key: 'basketball_nba', 
        name: 'NBA', 
        groupName: 'Basketball',
        isActive: true 
      };

      const mockFuturesResponse = [
        {
          id: 'nba_championship',
          sport_key: 'basketball_nba',
          sport_title: 'NBA',
          commence_time: '2026-06-01T00:00:00Z',
          bookmakers: [
            {
              key: 'draftkings',
              title: 'DraftKings',
              markets: [
                {
                  key: 'outrights',
                  outcomes: [
                    { name: 'Boston Celtics', price: 5.0 },
                    { name: 'Los Angeles Lakers', price: 6.5 }
                  ]
                }
              ]
            }
          ]
        }
      ];

      mockPrisma.sport.findUnique.mockResolvedValue(mockSport);
      mockPrisma.future.upsert.mockResolvedValue({ 
        id: 'future-1',
        sportId: 1,
        externalId: 'nba_championship',
        createdAt: new Date(),
        status: 'active',
        updatedAt: new Date(),
        title: 'NBA Championship',
        description: null,
        season: null,
        settlementDate: null,
        winner: null
      });
      mockPrisma.futureOdd.createMany.mockResolvedValue({ count: 2 });
      mockAxios.onGet(/odds/).reply(200, mockFuturesResponse);

      const result = await service.syncSportFutures('basketball_nba');

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('futureCount');
    });

    it('should handle sport not found', async () => {
      mockPrisma.sport.findUnique.mockResolvedValue(null);

      await expect(service.syncSportFutures('invalid_sport')).rejects.toThrow();
    });

    it('should handle API rate limit errors', async () => {
      const mockSport = { 
        id: 1, 
        key: 'basketball_nba', 
        name: 'NBA', 
        groupName: 'Basketball',
        isActive: true 
      };

      mockPrisma.sport.findUnique.mockResolvedValue(mockSport);
      mockAxios.onGet(/odds/).reply(429, { message: 'Rate limit exceeded' });

      await expect(service.syncSportFutures('basketball_nba')).rejects.toThrow();
    });

    it('should create multiple outcomes for championship futures', async () => {
      const mockSport = { 
        id: 1, 
        key: 'basketball_nba', 
        name: 'NBA', 
        groupName: 'Basketball',
        isActive: true 
      };

      const mockFuturesResponse = [
        {
          id: 'nba_championship',
          sport_key: 'basketball_nba',
          sport_title: 'NBA',
          commence_time: '2026-06-01T00:00:00Z',
          bookmakers: [
            {
              key: 'draftkings',
              title: 'DraftKings',
              markets: [
                {
                  key: 'outrights',
                  outcomes: [
                    { name: 'Boston Celtics', price: 5.0 },
                    { name: 'Los Angeles Lakers', price: 6.5 },
                    { name: 'Milwaukee Bucks', price: 7.0 }
                  ]
                }
              ]
            }
          ]
        }
      ];

      mockPrisma.sport.findUnique.mockResolvedValue(mockSport);
      mockPrisma.future.upsert.mockResolvedValue({ 
        id: 'future-1',
        sportId: 1,
        externalId: 'nba_championship',
        createdAt: new Date(),
        status: 'active',
        updatedAt: new Date(),
        title: 'NBA Championship',
        description: null,
        season: null,
        settlementDate: null,
        winner: null
      });
      mockPrisma.futureOdd.createMany.mockResolvedValue({ count: 3 });
      mockAxios.onGet(/odds/).reply(200, mockFuturesResponse);

      const result = await service.syncSportFutures('basketball_nba');

      expect(result.success).toBe(true);
      expect(mockPrisma.futureOdd.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ outcomeName: 'Boston Celtics' }),
          expect.objectContaining({ outcomeName: 'Los Angeles Lakers' }),
          expect.objectContaining({ outcomeName: 'Milwaukee Bucks' })
        ])
      });
    });

    it('should handle empty bookmakers gracefully', async () => {
      const mockSport = { 
        id: 1, 
        key: 'basketball_nba', 
        name: 'NBA', 
        groupName: 'Basketball',
        isActive: true 
      };

      const mockFuturesResponse = [
        {
          id: 'nba_championship',
          sport_key: 'basketball_nba',
          sport_title: 'NBA',
          commence_time: '2026-06-01T00:00:00Z',
          bookmakers: []
        }
      ];

      mockPrisma.sport.findUnique.mockResolvedValue(mockSport);
      mockPrisma.future.upsert.mockResolvedValue({ 
        id: 'future-1',
        sportId: 1,
        externalId: 'nba_championship',
        createdAt: new Date(),
        status: 'active',
        updatedAt: new Date(),
        title: 'NBA Championship',
        description: null,
        season: null,
        settlementDate: null,
        winner: null
      });
      mockAxios.onGet(/odds/).reply(200, mockFuturesResponse);

      const result = await service.syncSportFutures('basketball_nba');

      expect(result.success).toBe(true);
      expect(mockPrisma.futureOdd.createMany).not.toHaveBeenCalled();
    });
  });
});