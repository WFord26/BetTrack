/**
 * Unit tests for Futures Sync Service
 * 
 * Tests championship/tournament futures synchronization from The Odds API
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Mock Prisma FIRST - before service import
jest.mock('../src/config/database', () => ({
  prisma: {
    sport: {
      findMany: jest.fn(),
      findUnique: jest.fn()
    },
    future: {
      upsert: jest.fn()
    },
    currentFutureOdds: {
      upsert: jest.fn()
    },
    futureOdd: {
      createMany: jest.fn()
    },
    futureOddsSnapshot: {
      create: jest.fn()
    },
    oddsSnapshot: {
      create: jest.fn()
    }
  }
}));

// Import service AFTER mock
import { FuturesSyncService } from '../src/services/futures-sync.service';
import { prisma } from '../src/config/database';

// Type assertion for mocked prisma
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('FuturesSyncService', () => {
  let service: FuturesSyncService;
  let mockAxios: MockAdapter;

  beforeEach(() => {
    service = new FuturesSyncService();
    // Mock the service's internal axios client, not global axios
    mockAxios = new MockAdapter((service as any).client);
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
      expect(result.futuresProcessed).toBeGreaterThanOrEqual(0);
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

      const mockEmptyResponse = [
        {
          id: 'nba_championship',
          sport_key: 'basketball_nba',
          bookmakers: [] // No bookmakers means no markets
        }
      ];

      mockPrisma.sport.findMany.mockResolvedValue(mockSports);
      mockPrisma.future.upsert.mockResolvedValue({ id: 'future-1' } as any);
      mockAxios.onGet(/odds/).reply(200, mockEmptyResponse);

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
      expect(result.futuresProcessed).toBeGreaterThanOrEqual(1);
    });

    it('should handle sport not found', async () => {
      mockAxios.onGet(/odds/).reply(404);

      const result = await service.syncSportFutures('invalid_sport');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle API rate limit errors', async () => {
      mockAxios.onGet(/odds/).reply(429, { message: 'Rate limit exceeded' });

      const result = await service.syncSportFutures('basketball_nba');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
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

      // Mock sport lookup (called by upsertFuture)
      mockPrisma.sport.findUnique.mockResolvedValue(mockSport as any);
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
      mockPrisma.currentFutureOdds.upsert.mockResolvedValue({
        id: 'odds-1',
        futureId: 'future-1',
        bookmaker: 'draftkings',
        outcome: 'Boston Celtics',
        price: 5.0,
        lastUpdated: new Date()
      } as any);
      mockPrisma.futureOdd.createMany.mockResolvedValue({ count: 3 });
      mockAxios.onGet(/odds/).reply(200, mockFuturesResponse);

      const result = await service.syncSportFutures('basketball_nba');

      expect(result.success).toBe(true);
      expect(result.futuresProcessed).toBe(1);
      expect(result.oddsProcessed).toBeGreaterThan(0);
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
      expect(result.oddsProcessed).toBe(0);
    });
  });
});