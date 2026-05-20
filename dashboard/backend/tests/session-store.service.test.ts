/**
 * Unit tests for session-store.service
 * Tests: InMemorySessionStore, initializeSessionStore, getSessionStore, shutdownSessionStore
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

jest.mock('../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock redis - tests that don't need Redis will not use it
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    on: jest.fn(),
    connect: jest.fn().mockRejectedValue(new Error('Redis not available') as never),
    disconnect: jest.fn(),
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    scan: jest.fn(),
  })),
}));

// Mock env to control REDIS_URL
jest.mock('../src/config/env', () => ({
  env: {
    REDIS_URL: undefined,
    NODE_ENV: 'test',
    PORT: 3001,
  },
}));

describe('session-store.service', () => {
  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  // ─── Re-import module fresh for each test group ────────────────────────
  async function getModule() {
    const mod = await import('../src/services/session-store.service');
    return mod;
  }

  describe('initializeSessionStore', () => {
    it('creates an in-memory store when REDIS_URL is not set', async () => {
      const { initializeSessionStore, getSessionStore } = await getModule();

      const store = await initializeSessionStore();

      expect(store).toBeDefined();
      // Verify it works as an in-memory store
      const session = { userId: 'user-1', email: 'test@example.com', role: 'user', provider: 'local', createdAt: Date.now(), expiresAt: Date.now() + 3600000 };
      await store.set('session-1', session as any);
      const retrieved = await store.get('session-1');
      expect(retrieved).toEqual(session);
    });

    it('returns the same store on repeated calls', async () => {
      const { initializeSessionStore } = await getModule();

      const store1 = await initializeSessionStore();
      const store2 = await initializeSessionStore();

      expect(store1).toBe(store2);
    });

    it('getSessionStore returns the initialized store', async () => {
      const { initializeSessionStore, getSessionStore } = await getModule();

      await initializeSessionStore();
      const store = getSessionStore();

      expect(store).toBeDefined();
    });

    it('getSessionStore throws if not yet initialized', async () => {
      // Fresh module import with no initialization
      jest.resetModules();
      const { getSessionStore } = await import('../src/services/session-store.service');

      expect(() => getSessionStore()).toThrow('Session store not initialized');
    });
  });

  describe('shutdownSessionStore', () => {
    it('sets sessionStore to null after shutdown', async () => {
      jest.resetModules();
      const { initializeSessionStore, shutdownSessionStore, getSessionStore } = await import('../src/services/session-store.service');

      await initializeSessionStore();
      await shutdownSessionStore();

      expect(() => getSessionStore()).toThrow('Session store not initialized');
    });
  });

  describe('InMemorySessionStore', () => {
    let store: any;

    beforeEach(async () => {
      jest.resetModules();
      const mod = await import('../src/services/session-store.service');
      store = await mod.initializeSessionStore();
    });

    const makeSession = (id = 'user-1') => ({
      userId: id,
      email: `${id}@example.com`,
      role: 'user',
      provider: 'local',
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });

    it('returns null for a missing session', async () => {
      const result = await store.get('nonexistent');
      expect(result).toBeNull();
    });

    it('stores and retrieves a session by ID', async () => {
      const session = makeSession('alice');
      await store.set('sid-1', session);
      const retrieved = await store.get('sid-1');
      expect(retrieved).toEqual(session);
    });

    it('deletes a session by ID', async () => {
      const session = makeSession('bob');
      await store.set('sid-2', session);
      await store.delete('sid-2');
      const retrieved = await store.get('sid-2');
      expect(retrieved).toBeNull();
    });

    it('clear removes all stored sessions', async () => {
      await store.set('sid-3', makeSession('alice'));
      await store.set('sid-4', makeSession('bob'));

      await store.clear();

      expect(await store.get('sid-3')).toBeNull();
      expect(await store.get('sid-4')).toBeNull();
    });

    it('overwrites an existing session', async () => {
      const session1 = makeSession('charlie');
      const session2 = { ...session1, email: 'updated@example.com' };

      await store.set('sid-5', session1);
      await store.set('sid-5', session2);

      const retrieved = await store.get('sid-5');
      expect(retrieved!.email).toBe('updated@example.com');
    });

    it('delete on a nonexistent key does not throw', async () => {
      await expect(store.delete('nonexistent-key')).resolves.toBeUndefined();
    });
  });
});
