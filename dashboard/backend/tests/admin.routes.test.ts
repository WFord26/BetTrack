import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import adminRoutes from '../src/routes/admin.routes';
import { prisma } from '../src/config/database';
import { oddsSyncService } from '../src/services/odds-sync.service';
import { futuresSyncService } from '../src/services/futures-sync.service';
import { outcomeResolverService } from '../src/services/outcome-resolver.service';
import { getOddsSyncStatus } from '../src/jobs/sync-odds.job';

// Mock dependencies
jest.mock('../src/config/database', () => ({
  prisma: {
    sport: {
      upsert: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn()
    },
    team: {
      count: jest.fn()
    },
    game: {
      count: jest.fn()
    },
    currentOdds: {
      count: jest.fn()
    },
    oddsSnapshot: {
      count: jest.fn()
    },
    bet: {
      count: jest.fn()
    },
    betLeg: {
      count: jest.fn()
    },
    siteConfig: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn()
    },
    $queryRaw: jest.fn()
  }
}));

jest.mock('../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../src/services/odds-sync.service', () => ({
  oddsSyncService: {
    syncSportOdds: jest.fn(),
    syncAllOdds: jest.fn()
  }
}));

jest.mock('../src/services/futures-sync.service', () => ({
  futuresSyncService: {
    syncSportFutures: jest.fn(),
    syncAllFutures: jest.fn()
  }
}));

jest.mock('../src/services/outcome-resolver.service', () => ({
  outcomeResolverService: {
    resolveOutcomes: jest.fn()
  }
}));

jest.mock('../src/jobs/sync-odds.job', () => ({
  getOddsSyncStatus: jest.fn()
}));

describe('Admin Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
  });

  describe('POST /api/admin/init-sports', () => {
    it('should initialize sports successfully', async () => {
      const mockSports = [
        { key: 'basketball_nba', name: 'NBA', groupName: 'Basketball', isActive: true },
        { key: 'americanfootball_nfl', name: 'NFL', groupName: 'American Football', isActive: true }
      ];

      jest.mocked(prisma.sport.upsert).mockResolvedValue(mockSports[0] as any);

      const response = await request(app)
        .post('/api/admin/init-sports')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('Initialized');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(prisma.sport.upsert).toHaveBeenCalled();
    });

    it('should handle database errors during sports initialization', async () => {
      jest.mocked(prisma.sport.upsert).mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/admin/init-sports')
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Failed to initialize sports');
      expect(response.body.error).toBe('Database connection failed');
    });

    it('should upsert all 7 predefined sports', async () => {
      jest.mocked(prisma.sport.upsert).mockResolvedValue({} as any);

      await request(app)
        .post('/api/admin/init-sports')
        .expect(200);

      expect(prisma.sport.upsert).toHaveBeenCalledTimes(7);
    });
  });

  describe('POST /api/admin/sync-odds', () => {
    it('should trigger odds sync for all sports', async () => {
      const mockPromise = Promise.resolve();
      jest.mocked(oddsSyncService.syncAllOdds).mockReturnValue(mockPromise as any);

      const response = await request(app)
        .post('/api/admin/sync-odds')
        .send({})
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Odds sync started in background');
      expect(response.body.data.sportKey).toBe('all');
      expect(oddsSyncService.syncAllOdds).toHaveBeenCalledTimes(1);
    });

    it('should trigger odds sync for specific sport', async () => {
      const mockPromise = Promise.resolve();
      jest.mocked(oddsSyncService.syncSportOdds).mockReturnValue(mockPromise as any);

      const response = await request(app)
        .post('/api/admin/sync-odds')
        .send({ sportKey: 'basketball_nba' })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.sportKey).toBe('basketball_nba');
      expect(oddsSyncService.syncSportOdds).toHaveBeenCalledWith('basketball_nba');
    });

    it('should handle sync initiation errors', async () => {
      jest.mocked(oddsSyncService.syncAllOdds).mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      const response = await request(app)
        .post('/api/admin/sync-odds')
        .send({})
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Failed to start odds sync');
      expect(response.body.error).toBe('Service unavailable');
    });

    it('should not await sync completion (background execution)', async () => {
      const mockPromise = new Promise((resolve) => setTimeout(resolve, 100));
      jest.mocked(oddsSyncService.syncAllOdds).mockReturnValue(mockPromise as any);

      const startTime = Date.now();
      await request(app)
        .post('/api/admin/sync-odds')
        .send({})
        .expect(200);
      const elapsed = Date.now() - startTime;

      // Should return immediately (< 50ms), not wait 100ms
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('POST /api/admin/resolve-outcomes', () => {
    it('should trigger outcome resolution successfully', async () => {
      const mockPromise = Promise.resolve();
      jest.mocked(outcomeResolverService.resolveOutcomes).mockReturnValue(mockPromise as any);

      const response = await request(app)
        .post('/api/admin/resolve-outcomes')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Outcome resolution started in background');
      expect(outcomeResolverService.resolveOutcomes).toHaveBeenCalledTimes(1);
    });

    it('should handle resolution initiation errors', async () => {
      jest.mocked(outcomeResolverService.resolveOutcomes).mockImplementation(() => {
        throw new Error('Resolver service error');
      });

      const response = await request(app)
        .post('/api/admin/resolve-outcomes')
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Failed to start outcome resolution');
      expect(response.body.error).toBe('Resolver service error');
    });

    it('should not await resolution completion (background execution)', async () => {
      const mockPromise = new Promise((resolve) => setTimeout(resolve, 100));
      jest.mocked(outcomeResolverService.resolveOutcomes).mockReturnValue(mockPromise as any);

      const startTime = Date.now();
      await request(app)
        .post('/api/admin/resolve-outcomes')
        .expect(200);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('POST /api/admin/sync-futures', () => {
    it('should trigger futures sync for all sports', async () => {
      const mockPromise = Promise.resolve();
      jest.mocked(futuresSyncService.syncAllFutures).mockReturnValue(mockPromise as any);

      const response = await request(app)
        .post('/api/admin/sync-futures')
        .send({})
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Futures sync started in background');
      expect(response.body.data.sportKey).toBe('all');
      expect(futuresSyncService.syncAllFutures).toHaveBeenCalledTimes(1);
    });

    it('should trigger futures sync for specific sport', async () => {
      const mockPromise = Promise.resolve();
      jest.mocked(futuresSyncService.syncSportFutures).mockReturnValue(mockPromise as any);

      const response = await request(app)
        .post('/api/admin/sync-futures')
        .send({ sportKey: 'basketball_nba' })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.sportKey).toBe('basketball_nba');
      expect(futuresSyncService.syncSportFutures).toHaveBeenCalledWith('basketball_nba');
    });

    it('should handle futures sync initiation errors', async () => {
      jest.mocked(futuresSyncService.syncAllFutures).mockImplementation(() => {
        throw new Error('Futures service error');
      });

      const response = await request(app)
        .post('/api/admin/sync-futures')
        .send({})
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Failed to start futures sync');
      expect(response.body.error).toBe('Futures service error');
    });

    it('should not await futures sync completion (background execution)', async () => {
      const mockPromise = new Promise((resolve) => setTimeout(resolve, 100));
      jest.mocked(futuresSyncService.syncAllFutures).mockReturnValue(mockPromise as any);

      const startTime = Date.now();
      await request(app)
        .post('/api/admin/sync-futures')
        .send({})
        .expect(200);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('GET /api/admin/stats', () => {
    it('should return comprehensive database statistics', async () => {
      jest.mocked(prisma.sport.count).mockResolvedValue(7);
      jest.mocked(prisma.team.count).mockResolvedValue(150);
      jest.mocked(prisma.game.count).mockResolvedValue(500);
      jest.mocked(prisma.currentOdds.count).mockResolvedValue(1200);
      jest.mocked(prisma.oddsSnapshot.count).mockResolvedValue(5000);
      jest.mocked(prisma.bet.count).mockResolvedValue(250);
      jest.mocked(prisma.betLeg.count).mockResolvedValue(600);
      jest.mocked(prisma.sport.findMany).mockResolvedValue([
        { key: 'basketball_nba', name: 'NBA' },
        { key: 'americanfootball_nfl', name: 'NFL' }
      ] as any);

      const response = await request(app)
        .get('/api/admin/stats')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.database).toEqual({
        sports: 7,
        teams: 150,
        games: 500,
        currentOdds: 1200,
        oddsSnapshots: 5000,
        bets: 250,
        betLegs: 600
      });
      expect(response.body.data.activeSports).toBeInstanceOf(Array);
      expect(response.body.data.recentGames).toBeDefined();
    });

    it('should calculate recent games count correctly', async () => {
      jest.mocked(prisma.sport.count).mockResolvedValue(7);
      jest.mocked(prisma.team.count).mockResolvedValue(150);
      jest.mocked(prisma.game.count).mockResolvedValueOnce(500).mockResolvedValueOnce(120);
      jest.mocked(prisma.currentOdds.count).mockResolvedValue(1200);
      jest.mocked(prisma.oddsSnapshot.count).mockResolvedValue(5000);
      jest.mocked(prisma.bet.count).mockResolvedValue(250);
      jest.mocked(prisma.betLeg.count).mockResolvedValue(600);
      jest.mocked(prisma.sport.findMany).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/admin/stats')
        .expect(200);

      expect(response.body.data.recentGames).toBe(120);
      expect(prisma.game.count).toHaveBeenCalledTimes(2);
    });

    it('should handle database errors in stats endpoint', async () => {
      jest.mocked(prisma.sport.count).mockRejectedValue(new Error('Database timeout'));

      const response = await request(app)
        .get('/api/admin/stats')
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Failed to get stats');
      expect(response.body.error).toBe('Database timeout');
    });

    it('should handle zero counts gracefully', async () => {
      jest.mocked(prisma.sport.count).mockResolvedValue(0);
      jest.mocked(prisma.team.count).mockResolvedValue(0);
      jest.mocked(prisma.game.count).mockResolvedValue(0);
      jest.mocked(prisma.currentOdds.count).mockResolvedValue(0);
      jest.mocked(prisma.oddsSnapshot.count).mockResolvedValue(0);
      jest.mocked(prisma.bet.count).mockResolvedValue(0);
      jest.mocked(prisma.betLeg.count).mockResolvedValue(0);
      jest.mocked(prisma.sport.findMany).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/admin/stats')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.database.sports).toBe(0);
      expect(response.body.data.activeSports).toEqual([]);
    });
  });

  describe('GET /api/admin/health', () => {
    it('should return healthy status with all metrics', async () => {
      jest.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }] as any);
      jest.mocked(prisma.sport.count).mockResolvedValue(7);
      jest.mocked(prisma.game.count).mockResolvedValue(500);
      jest.mocked(getOddsSyncStatus).mockReturnValue({
        lastResult: { requestsRemaining: 450 }
      } as any);

      const response = await request(app)
        .get('/api/admin/health')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.database).toBe('connected');
      expect(response.body.data.dataInitialized).toBe(true);
      expect(response.body.data.hasGames).toBe(true);
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.apiRequestsRemaining).toBe(450);
    });

    it('should detect uninitialized database', async () => {
      jest.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }] as any);
      jest.mocked(prisma.sport.count).mockResolvedValue(0);
      jest.mocked(prisma.game.count).mockResolvedValue(0);
      jest.mocked(getOddsSyncStatus).mockReturnValue({ lastResult: null } as any);

      const response = await request(app)
        .get('/api/admin/health')
        .expect(200);

      expect(response.body.data.dataInitialized).toBe(false);
      expect(response.body.data.hasGames).toBe(false);
      expect(response.body.data.apiRequestsRemaining).toBeUndefined();
    });

    it('should return 503 when database connection fails', async () => {
      jest.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Connection refused'));

      const response = await request(app)
        .get('/api/admin/health')
        .expect(503);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Service unhealthy');
      expect(response.body.error).toBe('Connection refused');
    });

    it('should include valid ISO timestamp', async () => {
      jest.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }] as any);
      jest.mocked(prisma.sport.count).mockResolvedValue(7);
      jest.mocked(prisma.game.count).mockResolvedValue(500);
      jest.mocked(getOddsSyncStatus).mockReturnValue({ lastResult: null } as any);

      const response = await request(app)
        .get('/api/admin/health')
        .expect(200);

      const timestamp = new Date(response.body.data.timestamp);
      expect(timestamp.toISOString()).toBe(response.body.data.timestamp);
    });
  });

  describe('GET /api/admin/site-config', () => {
    it('should return existing site configuration', async () => {
      const mockConfig = {
        id: 1,
        siteName: 'My Sports Betting',
        logoUrl: 'https://example.com/logo.png',
        domainUrl: 'https://mybets.com'
      };

      jest.mocked(prisma.siteConfig.findUnique).mockResolvedValue(mockConfig as any);

      const response = await request(app)
        .get('/api/admin/site-config')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toEqual(mockConfig);
    });

    it('should create default config if none exists', async () => {
      const defaultConfig = {
        id: 1,
        siteName: 'Sports Betting',
        logoUrl: null,
        domainUrl: null
      };

      jest.mocked(prisma.siteConfig.findUnique).mockResolvedValue(null);
      jest.mocked(prisma.siteConfig.create).mockResolvedValue(defaultConfig as any);

      const response = await request(app)
        .get('/api/admin/site-config')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toEqual(defaultConfig);
      expect(prisma.siteConfig.create).toHaveBeenCalledWith({
        data: {
          id: 1,
          siteName: 'Sports Betting',
          logoUrl: null,
          domainUrl: null
        }
      });
    });

    it('should handle database errors when fetching config', async () => {
      jest.mocked(prisma.siteConfig.findUnique).mockRejectedValue(new Error('Query failed'));

      const response = await request(app)
        .get('/api/admin/site-config')
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Failed to get site configuration');
      expect(response.body.error).toBe('Query failed');
    });
  });

  describe('PUT /api/admin/site-config', () => {
    it('should update all site configuration fields', async () => {
      const updateData = {
        siteName: 'Updated Sports Betting',
        logoUrl: 'https://example.com/new-logo.png',
        domainUrl: 'https://newdomain.com'
      };

      const mockUpdatedConfig = { id: 1, ...updateData };
      jest.mocked(prisma.siteConfig.upsert).mockResolvedValue(mockUpdatedConfig as any);

      const response = await request(app)
        .put('/api/admin/site-config')
        .send(updateData)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Site configuration updated successfully');
      expect(response.body.data).toEqual(mockUpdatedConfig);
    });

    it('should update only siteName', async () => {
      const updateData = { siteName: 'New Name' };
      const mockConfig = { id: 1, siteName: 'New Name', logoUrl: null, domainUrl: null };
      jest.mocked(prisma.siteConfig.upsert).mockResolvedValue(mockConfig as any);

      const response = await request(app)
        .put('/api/admin/site-config')
        .send(updateData)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(prisma.siteConfig.upsert).toHaveBeenCalled();
    });

    it('should reject siteName longer than 100 characters', async () => {
      const longName = 'a'.repeat(101);

      const response = await request(app)
        .put('/api/admin/site-config')
        .send({ siteName: longName })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Site name must be 100 characters or less');
      expect(prisma.siteConfig.upsert).not.toHaveBeenCalled();
    });

    it('should reject logoUrl longer than 500 characters', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(500);

      const response = await request(app)
        .put('/api/admin/site-config')
        .send({ logoUrl: longUrl })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Logo URL must be 500 characters or less');
      expect(prisma.siteConfig.upsert).not.toHaveBeenCalled();
    });

    it('should reject domainUrl longer than 255 characters', async () => {
      const longUrl = 'https://' + 'a'.repeat(250) + '.com';

      const response = await request(app)
        .put('/api/admin/site-config')
        .send({ domainUrl: longUrl })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Domain URL must be 255 characters or less');
      expect(prisma.siteConfig.upsert).not.toHaveBeenCalled();
    });

    it('should allow clearing logoUrl with empty string', async () => {
      const mockConfig = { id: 1, siteName: 'Test', logoUrl: null, domainUrl: null };
      jest.mocked(prisma.siteConfig.upsert).mockResolvedValue(mockConfig as any);

      const response = await request(app)
        .put('/api/admin/site-config')
        .send({ logoUrl: '' })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(prisma.siteConfig.upsert).toHaveBeenCalled();
    });

    it('should allow clearing domainUrl with empty string', async () => {
      const mockConfig = { id: 1, siteName: 'Test', logoUrl: null, domainUrl: null };
      jest.mocked(prisma.siteConfig.upsert).mockResolvedValue(mockConfig as any);

      const response = await request(app)
        .put('/api/admin/site-config')
        .send({ domainUrl: '' })
        .expect(200);

      expect(response.body.status).toBe('success');
    });

    it('should handle database errors during update', async () => {
      jest.mocked(prisma.siteConfig.upsert).mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .put('/api/admin/site-config')
        .send({ siteName: 'Test' })
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Failed to update site configuration');
      expect(response.body.error).toBe('Update failed');
    });

    it('should create config if none exists during update', async () => {
      const mockConfig = {
        id: 1,
        siteName: 'New Site',
        logoUrl: 'https://example.com/logo.png',
        domainUrl: null
      };

      jest.mocked(prisma.siteConfig.upsert).mockResolvedValue(mockConfig as any);

      const response = await request(app)
        .put('/api/admin/site-config')
        .send({ siteName: 'New Site', logoUrl: 'https://example.com/logo.png' })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toEqual(mockConfig);
    });

    it('should accept valid 100 character siteName', async () => {
      const validName = 'a'.repeat(100);
      const mockConfig = { id: 1, siteName: validName, logoUrl: null, domainUrl: null };
      jest.mocked(prisma.siteConfig.upsert).mockResolvedValue(mockConfig as any);

      const response = await request(app)
        .put('/api/admin/site-config')
        .send({ siteName: validName })
        .expect(200);

      expect(response.body.status).toBe('success');
    });

    it('should accept valid 500 character logoUrl', async () => {
      const validUrl = 'https://example.com/' + 'a'.repeat(480);
      const mockConfig = { id: 1, siteName: 'Test', logoUrl: validUrl, domainUrl: null };
      jest.mocked(prisma.siteConfig.upsert).mockResolvedValue(mockConfig as any);

      const response = await request(app)
        .put('/api/admin/site-config')
        .send({ logoUrl: validUrl })
        .expect(200);

      expect(response.body.status).toBe('success');
    });

    it('should accept valid 255 character domainUrl', async () => {
      const validUrl = 'https://' + 'a'.repeat(240) + '.com';
      const mockConfig = { id: 1, siteName: 'Test', logoUrl: null, domainUrl: validUrl };
      jest.mocked(prisma.siteConfig.upsert).mockResolvedValue(mockConfig as any);

      const response = await request(app)
        .put('/api/admin/site-config')
        .send({ domainUrl: validUrl })
        .expect(200);

      expect(response.body.status).toBe('success');
    });
  });
});
