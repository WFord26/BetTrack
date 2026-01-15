import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import apiKeysRoutes from '../src/routes/api-keys.routes';
import { prisma } from '../src/config/database';
import * as apiKeyGenerator from '../src/utils/api-key-generator';

// Mock dependencies
jest.mock('../src/config/database', () => ({
  prisma: {
    apiKey: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    apiKeyUsage: {
      findMany: jest.fn()
    }
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

jest.mock('../src/utils/api-key-generator', () => ({
  generateApiKey: jest.fn(),
  hashApiKey: jest.fn(),
  getKeyPrefix: jest.fn()
}));

describe('API Keys Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    
    // Middleware to simulate session
    app.use((req: any, res, next) => {
      req.session = req.headers['x-test-session'] 
        ? JSON.parse(req.headers['x-test-session'] as string)
        : null;
      next();
    });
    
    app.use('/api/keys', apiKeysRoutes);
  });

  describe('GET /api/keys', () => {
    it('should list all API keys in standalone mode (no auth)', async () => {
      const mockKeys = [
        {
          id: 'key1',
          name: 'Production Key',
          keyPrefix: 'sk_prod_abc',
          permissions: { read: true, write: true, bets: true, stats: true },
          lastUsedAt: null,
          expiresAt: null,
          revoked: false,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01')
        },
        {
          id: 'key2',
          name: 'Test Key',
          keyPrefix: 'sk_test_xyz',
          permissions: { read: true, write: false, bets: false, stats: true },
          lastUsedAt: new Date('2026-01-10'),
          expiresAt: new Date('2026-12-31'),
          revoked: false,
          createdAt: new Date('2025-12-01'),
          updatedAt: new Date('2025-12-01')
        }
      ];

      jest.mocked(prisma.apiKey.findMany).mockResolvedValue(mockKeys as any);

      const response = await request(app)
        .get('/api/keys')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.keys).toHaveLength(2);
      expect(response.body.data.keys[0].name).toBe('Production Key');
      expect(prisma.apiKey.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        select: expect.any(Object)
      });
    });

    it('should filter keys by userId in auth mode', async () => {
      const mockKeys = [
        {
          id: 'key1',
          name: 'User Key',
          keyPrefix: 'sk_prod_abc',
          permissions: { read: true, write: true, bets: true, stats: true },
          lastUsedAt: null,
          expiresAt: null,
          revoked: false,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01')
        }
      ];

      jest.mocked(prisma.apiKey.findMany).mockResolvedValue(mockKeys as any);

      const response = await request(app)
        .get('/api/keys')
        .set('x-test-session', JSON.stringify({ user: { id: 'user123' } }))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.keys).toHaveLength(1);
      expect(prisma.apiKey.findMany).toHaveBeenCalledWith({
        where: { userId: 'user123' },
        orderBy: { createdAt: 'desc' },
        select: expect.any(Object)
      });
    });

    it('should return empty array when no keys exist', async () => {
      jest.mocked(prisma.apiKey.findMany).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/keys')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.keys).toEqual([]);
    });

    it('should handle database errors', async () => {
      jest.mocked(prisma.apiKey.findMany).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/keys')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch API keys');
    });

    it('should order keys by createdAt descending', async () => {
      jest.mocked(prisma.apiKey.findMany).mockResolvedValue([]);

      await request(app)
        .get('/api/keys')
        .expect(200);

      expect(prisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' }
        })
      );
    });

    it('should not include keyHash in response', async () => {
      const mockKeys = [
        {
          id: 'key1',
          name: 'Test Key',
          keyPrefix: 'sk_prod_abc',
          permissions: { read: true },
          lastUsedAt: null,
          expiresAt: null,
          revoked: false,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01')
        }
      ];

      jest.mocked(prisma.apiKey.findMany).mockResolvedValue(mockKeys as any);

      const response = await request(app)
        .get('/api/keys')
        .expect(200);

      expect(response.body.data.keys[0]).not.toHaveProperty('keyHash');
      expect(prisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.not.objectContaining({ keyHash: true })
        })
      );
    });
  });

  describe('POST /api/keys', () => {
    it('should create a new API key with all fields', async () => {
      const mockKey = {
        id: 'key123',
        name: 'Production API Key',
        keyHash: 'hashed_key',
        keyPrefix: 'sk_prod_abc123de',
        permissions: { read: true, write: true, bets: true, stats: true },
        expiresAt: new Date('2027-01-01'),
        createdAt: new Date('2026-01-15'),
        updatedAt: new Date('2026-01-15'),
        userId: null,
        revoked: false,
        lastUsedAt: null
      };

      jest.mocked(apiKeyGenerator.generateApiKey).mockReturnValue('sk_prod_abc123def456ghi789jkl012mno345pq');
      jest.mocked(apiKeyGenerator.hashApiKey).mockResolvedValue('hashed_key');
      jest.mocked(apiKeyGenerator.getKeyPrefix).mockReturnValue('sk_prod_abc123de');
      jest.mocked(prisma.apiKey.create).mockResolvedValue(mockKey as any);

      const response = await request(app)
        .post('/api/keys')
        .send({
          name: 'Production API Key',
          permissions: { read: true, write: true, bets: true, stats: true },
          expiresAt: '2027-01-01T00:00:00Z'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.key).toBe('sk_prod_abc123def456ghi789jkl012mno345pq');
      expect(response.body.data.name).toBe('Production API Key');
      expect(response.body.data.keyPrefix).toBe('sk_prod_abc123de');
      expect(response.body.message).toContain('Save this key');
    });

    it('should create key with default permissions when not provided', async () => {
      const mockKey = {
        id: 'key123',
        name: 'Test Key',
        keyHash: 'hashed_key',
        keyPrefix: 'sk_test_abc',
        permissions: { read: true, write: true, bets: true, stats: true },
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: null,
        revoked: false,
        lastUsedAt: null
      };

      jest.mocked(apiKeyGenerator.generateApiKey).mockReturnValue('sk_test_abc123');
      jest.mocked(apiKeyGenerator.hashApiKey).mockResolvedValue('hashed_key');
      jest.mocked(apiKeyGenerator.getKeyPrefix).mockReturnValue('sk_test_abc');
      jest.mocked(prisma.apiKey.create).mockResolvedValue(mockKey as any);

      const response = await request(app)
        .post('/api/keys')
        .send({ name: 'Test Key' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.permissions).toEqual({
        read: true,
        write: true,
        bets: true,
        stats: true
      });
    });

    it('should reject request without name', async () => {
      const response = await request(app)
        .post('/api/keys')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Name is required');
      expect(prisma.apiKey.create).not.toHaveBeenCalled();
    });

    it('should reject request with empty name', async () => {
      const response = await request(app)
        .post('/api/keys')
        .send({ name: '   ' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Name is required');
    });

    it('should reject request with non-string name', async () => {
      const response = await request(app)
        .post('/api/keys')
        .send({ name: 123 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Name is required');
    });

    it('should reject invalid expiration date', async () => {
      const response = await request(app)
        .post('/api/keys')
        .send({
          name: 'Test Key',
          expiresAt: 'invalid-date'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid expiration date');
      expect(prisma.apiKey.create).not.toHaveBeenCalled();
    });

    it('should trim whitespace from name', async () => {
      const mockKey = {
        id: 'key123',
        name: 'Trimmed Key',
        keyHash: 'hashed_key',
        keyPrefix: 'sk_prod_abc',
        permissions: { read: true, write: true, bets: true, stats: true },
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: null,
        revoked: false,
        lastUsedAt: null
      };

      jest.mocked(apiKeyGenerator.generateApiKey).mockReturnValue('sk_prod_abc123');
      jest.mocked(apiKeyGenerator.hashApiKey).mockResolvedValue('hashed_key');
      jest.mocked(apiKeyGenerator.getKeyPrefix).mockReturnValue('sk_prod_abc');
      jest.mocked(prisma.apiKey.create).mockResolvedValue(mockKey as any);

      await request(app)
        .post('/api/keys')
        .send({ name: '  Trimmed Key  ' })
        .expect(201);

      expect(prisma.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Trimmed Key' })
        })
      );
    });

    it('should associate key with userId in auth mode', async () => {
      const mockKey = {
        id: 'key123',
        name: 'User Key',
        keyHash: 'hashed_key',
        keyPrefix: 'sk_prod_abc',
        permissions: { read: true, write: true, bets: true, stats: true },
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user123',
        revoked: false,
        lastUsedAt: null
      };

      jest.mocked(apiKeyGenerator.generateApiKey).mockReturnValue('sk_prod_abc123');
      jest.mocked(apiKeyGenerator.hashApiKey).mockResolvedValue('hashed_key');
      jest.mocked(apiKeyGenerator.getKeyPrefix).mockReturnValue('sk_prod_abc');
      jest.mocked(prisma.apiKey.create).mockResolvedValue(mockKey as any);

      await request(app)
        .post('/api/keys')
        .set('x-test-session', JSON.stringify({ user: { id: 'user123' } }))
        .send({ name: 'User Key' })
        .expect(201);

      expect(prisma.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user123' })
        })
      );
    });

    it('should handle database errors during creation', async () => {
      jest.mocked(apiKeyGenerator.generateApiKey).mockReturnValue('sk_prod_abc123');
      jest.mocked(apiKeyGenerator.hashApiKey).mockResolvedValue('hashed_key');
      jest.mocked(apiKeyGenerator.getKeyPrefix).mockReturnValue('sk_prod_abc');
      jest.mocked(prisma.apiKey.create).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/keys')
        .send({ name: 'Test Key' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to create API key');
    });

    it('should accept custom permissions', async () => {
      const customPermissions = { read: true, write: false, bets: false, stats: true };
      const mockKey = {
        id: 'key123',
        name: 'Limited Key',
        keyHash: 'hashed_key',
        keyPrefix: 'sk_prod_abc',
        permissions: customPermissions,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: null,
        revoked: false,
        lastUsedAt: null
      };

      jest.mocked(apiKeyGenerator.generateApiKey).mockReturnValue('sk_prod_abc123');
      jest.mocked(apiKeyGenerator.hashApiKey).mockResolvedValue('hashed_key');
      jest.mocked(apiKeyGenerator.getKeyPrefix).mockReturnValue('sk_prod_abc');
      jest.mocked(prisma.apiKey.create).mockResolvedValue(mockKey as any);

      const response = await request(app)
        .post('/api/keys')
        .send({ name: 'Limited Key', permissions: customPermissions })
        .expect(201);

      expect(response.body.data.permissions).toEqual(customPermissions);
    });
  });

  describe('PUT /api/keys/:id', () => {
    it('should update API key name', async () => {
      const existingKey = {
        id: 'key123',
        name: 'Old Name',
        userId: null,
        keyPrefix: 'sk_prod_abc',
        permissions: { read: true },
        expiresAt: null,
        revoked: false,
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updatedKey = { ...existingKey, name: 'New Name', updatedAt: new Date() };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);
      jest.mocked(prisma.apiKey.update).mockResolvedValue(updatedKey as any);

      const response = await request(app)
        .put('/api/keys/key123')
        .send({ name: 'New Name' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Name');
      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key123' },
        data: { name: 'New Name' }
      });
    });

    it('should update API key permissions', async () => {
      const existingKey = {
        id: 'key123',
        name: 'Test Key',
        userId: null,
        permissions: { read: true, write: true, bets: true, stats: true }
      };

      const newPermissions = { read: true, write: false, bets: false, stats: true };
      const updatedKey = { ...existingKey, permissions: newPermissions, updatedAt: new Date() };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);
      jest.mocked(prisma.apiKey.update).mockResolvedValue(updatedKey as any);

      const response = await request(app)
        .put('/api/keys/key123')
        .send({ permissions: newPermissions })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.permissions).toEqual(newPermissions);
    });

    it('should update both name and permissions', async () => {
      const existingKey = {
        id: 'key123',
        name: 'Old Name',
        userId: null,
        permissions: { read: true, write: true }
      };

      const newPermissions = { read: true, write: false };
      const updatedKey = {
        ...existingKey,
        name: 'New Name',
        permissions: newPermissions,
        updatedAt: new Date()
      };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);
      jest.mocked(prisma.apiKey.update).mockResolvedValue(updatedKey as any);

      const response = await request(app)
        .put('/api/keys/key123')
        .send({ name: 'New Name', permissions: newPermissions })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Name');
      expect(response.body.data.permissions).toEqual(newPermissions);
    });

    it('should return 404 when key does not exist', async () => {
      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .put('/api/keys/nonexistent')
        .send({ name: 'New Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key not found');
      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });

    it('should return 403 when user does not own the key', async () => {
      const existingKey = {
        id: 'key123',
        name: 'Other User Key',
        userId: 'user456',
        permissions: { read: true }
      };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);

      const response = await request(app)
        .put('/api/keys/key123')
        .set('x-test-session', JSON.stringify({ user: { id: 'user123' } }))
        .send({ name: 'New Name' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access denied');
      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });

    it('should allow update when user owns the key', async () => {
      const existingKey = {
        id: 'key123',
        name: 'User Key',
        userId: 'user123',
        permissions: { read: true }
      };

      const updatedKey = { ...existingKey, name: 'Updated Name', updatedAt: new Date() };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);
      jest.mocked(prisma.apiKey.update).mockResolvedValue(updatedKey as any);

      const response = await request(app)
        .put('/api/keys/key123')
        .set('x-test-session', JSON.stringify({ user: { id: 'user123' } }))
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should trim whitespace from updated name', async () => {
      const existingKey = {
        id: 'key123',
        name: 'Old Name',
        userId: null,
        permissions: { read: true }
      };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);
      jest.mocked(prisma.apiKey.update).mockResolvedValue({ ...existingKey, name: 'Trimmed' } as any);

      await request(app)
        .put('/api/keys/key123')
        .send({ name: '  Trimmed  ' })
        .expect(200);

      expect(prisma.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: 'Trimmed' }
        })
      );
    });

    it('should ignore empty string name', async () => {
      const existingKey = {
        id: 'key123',
        name: 'Original Name',
        userId: null,
        permissions: { read: true }
      };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);
      jest.mocked(prisma.apiKey.update).mockResolvedValue(existingKey as any);

      await request(app)
        .put('/api/keys/key123')
        .send({ name: '   ' })
        .expect(200);

      expect(prisma.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {}
        })
      );
    });

    it('should ignore non-string name', async () => {
      const existingKey = {
        id: 'key123',
        name: 'Original Name',
        userId: null,
        permissions: { read: true }
      };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);
      jest.mocked(prisma.apiKey.update).mockResolvedValue(existingKey as any);

      await request(app)
        .put('/api/keys/key123')
        .send({ name: 123 })
        .expect(200);

      expect(prisma.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {}
        })
      );
    });

    it('should ignore non-object permissions', async () => {
      const existingKey = {
        id: 'key123',
        name: 'Test Key',
        userId: null,
        permissions: { read: true }
      };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);
      jest.mocked(prisma.apiKey.update).mockResolvedValue(existingKey as any);

      await request(app)
        .put('/api/keys/key123')
        .send({ permissions: 'invalid' })
        .expect(200);

      expect(prisma.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {}
        })
      );
    });

    it('should handle database errors during update', async () => {
      const existingKey = {
        id: 'key123',
        name: 'Test Key',
        userId: null,
        permissions: { read: true }
      };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);
      jest.mocked(prisma.apiKey.update).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/api/keys/key123')
        .send({ name: 'New Name' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to update API key');
    });
  });

  describe('DELETE /api/keys/:id', () => {
    it('should revoke API key', async () => {
      const existingKey = {
        id: 'key123',
        name: 'Test Key',
        keyPrefix: 'sk_prod_abc',
        userId: null,
        revoked: false
      };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);
      jest.mocked(prisma.apiKey.update).mockResolvedValue({ ...existingKey, revoked: true } as any);

      const response = await request(app)
        .delete('/api/keys/key123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('API key revoked successfully');
      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key123' },
        data: { revoked: true }
      });
    });

    it('should return 404 when key does not exist', async () => {
      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/keys/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key not found');
      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });

    it('should return 403 when user does not own the key', async () => {
      const existingKey = {
        id: 'key123',
        name: 'Other User Key',
        keyPrefix: 'sk_prod_abc',
        userId: 'user456',
        revoked: false
      };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);

      const response = await request(app)
        .delete('/api/keys/key123')
        .set('x-test-session', JSON.stringify({ user: { id: 'user123' } }))
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access denied');
      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });

    it('should allow deletion when user owns the key', async () => {
      const existingKey = {
        id: 'key123',
        name: 'User Key',
        keyPrefix: 'sk_prod_abc',
        userId: 'user123',
        revoked: false
      };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);
      jest.mocked(prisma.apiKey.update).mockResolvedValue({ ...existingKey, revoked: true } as any);

      const response = await request(app)
        .delete('/api/keys/key123')
        .set('x-test-session', JSON.stringify({ user: { id: 'user123' } }))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key123' },
        data: { revoked: true }
      });
    });

    it('should handle database errors during revocation', async () => {
      const existingKey = {
        id: 'key123',
        name: 'Test Key',
        keyPrefix: 'sk_prod_abc',
        userId: null,
        revoked: false
      };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);
      jest.mocked(prisma.apiKey.update).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .delete('/api/keys/key123')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to revoke API key');
    });

    it('should allow revoking already revoked key', async () => {
      const existingKey = {
        id: 'key123',
        name: 'Test Key',
        keyPrefix: 'sk_prod_abc',
        userId: null,
        revoked: true
      };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);
      jest.mocked(prisma.apiKey.update).mockResolvedValue(existingKey as any);

      const response = await request(app)
        .delete('/api/keys/key123')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/keys/:id/usage', () => {
    it('should return usage statistics with default limit', async () => {
      const existingKey = {
        id: 'key123',
        name: 'Test Key',
        userId: null
      };

      const mockUsage = [
        {
          id: 'usage1',
          endpoint: '/api/games',
          method: 'GET',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          createdAt: new Date('2026-01-15T10:00:00Z')
        },
        {
          id: 'usage2',
          endpoint: '/api/bets',
          method: 'POST',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          createdAt: new Date('2026-01-15T11:00:00Z')
        }
      ];

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);
      jest.mocked(prisma.apiKeyUsage.findMany).mockResolvedValue(mockUsage as any);

      const response = await request(app)
        .get('/api/keys/key123/usage')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.usage).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
      expect(prisma.apiKeyUsage.findMany).toHaveBeenCalledWith({
        where: { apiKeyId: 'key123' },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: expect.any(Object)
      });
    });

    it('should respect custom limit parameter', async () => {
      const existingKey = {
        id: 'key123',
        name: 'Test Key',
        userId: null
      };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);
      jest.mocked(prisma.apiKeyUsage.findMany).mockResolvedValue([]);

      await request(app)
        .get('/api/keys/key123/usage?limit=50')
        .expect(200);

      expect(prisma.apiKeyUsage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50
        })
      );
    });

    it('should return empty array when no usage exists', async () => {
      const existingKey = {
        id: 'key123',
        name: 'Test Key',
        userId: null
      };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);
      jest.mocked(prisma.apiKeyUsage.findMany).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/keys/key123/usage')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.usage).toEqual([]);
      expect(response.body.data.total).toBe(0);
    });

    it('should return 404 when key does not exist', async () => {
      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/keys/nonexistent/usage')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key not found');
      expect(prisma.apiKeyUsage.findMany).not.toHaveBeenCalled();
    });

    it('should return 403 when user does not own the key', async () => {
      const existingKey = {
        id: 'key123',
        name: 'Other User Key',
        userId: 'user456'
      };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);

      const response = await request(app)
        .get('/api/keys/key123/usage')
        .set('x-test-session', JSON.stringify({ user: { id: 'user123' } }))
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access denied');
      expect(prisma.apiKeyUsage.findMany).not.toHaveBeenCalled();
    });

    it('should allow access when user owns the key', async () => {
      const existingKey = {
        id: 'key123',
        name: 'User Key',
        userId: 'user123'
      };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);
      jest.mocked(prisma.apiKeyUsage.findMany).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/keys/key123/usage')
        .set('x-test-session', JSON.stringify({ user: { id: 'user123' } }))
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should order usage by createdAt descending', async () => {
      const existingKey = {
        id: 'key123',
        name: 'Test Key',
        userId: null
      };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);
      jest.mocked(prisma.apiKeyUsage.findMany).mockResolvedValue([]);

      await request(app)
        .get('/api/keys/key123/usage')
        .expect(200);

      expect(prisma.apiKeyUsage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' }
        })
      );
    });

    it('should handle database errors when fetching usage', async () => {
      const existingKey = {
        id: 'key123',
        name: 'Test Key',
        userId: null
      };

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);
      jest.mocked(prisma.apiKeyUsage.findMany).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/keys/key123/usage')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch usage statistics');
    });

    it('should include all required usage fields', async () => {
      const existingKey = {
        id: 'key123',
        name: 'Test Key',
        userId: null
      };

      const mockUsage = [
        {
          id: 'usage1',
          endpoint: '/api/games',
          method: 'GET',
          ipAddress: '192.168.1.1',
          userAgent: 'curl/7.68.0',
          createdAt: new Date('2026-01-15T10:00:00Z')
        }
      ];

      jest.mocked(prisma.apiKey.findUnique).mockResolvedValue(existingKey as any);
      jest.mocked(prisma.apiKeyUsage.findMany).mockResolvedValue(mockUsage as any);

      const response = await request(app)
        .get('/api/keys/key123/usage')
        .expect(200);

      const usage = response.body.data.usage[0];
      expect(usage).toHaveProperty('id');
      expect(usage).toHaveProperty('endpoint');
      expect(usage).toHaveProperty('method');
      expect(usage).toHaveProperty('ipAddress');
      expect(usage).toHaveProperty('userAgent');
      expect(usage).toHaveProperty('createdAt');
    });
  });
});
