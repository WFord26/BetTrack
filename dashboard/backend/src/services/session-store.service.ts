import { createClient, RedisClientType } from 'redis';
import { env } from '../config/env';
import { logger } from '../config/logger';
import type { AuthSession } from '../types/auth.types';

/**
 * Session store interface - abstracts Redis vs in-memory implementation
 */
interface ISessionStore {
  get(sessionId: string): Promise<AuthSession | null>;
  set(sessionId: string, session: AuthSession): Promise<void>;
  delete(sessionId: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * In-memory session store (fallback when Redis is unavailable)
 * SECURITY: For horizontal scaling and production, Redis store is REQUIRED
 */
class InMemorySessionStore implements ISessionStore {
  private sessions = new Map<string, AuthSession>();

  async get(sessionId: string): Promise<AuthSession | null> {
    const session = this.sessions.get(sessionId);
    return session || null;
  }

  async set(sessionId: string, session: AuthSession): Promise<void> {
    this.sessions.set(sessionId, session);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async clear(): Promise<void> {
    this.sessions.clear();
  }
}

/**
 * Redis-backed session store for production
 * SECURITY: Sessions persist across restarts and scale horizontally
 */
class RedisSessionStore implements ISessionStore {
  private client: RedisClientType;
  private connected = false;
  private readonly SESSION_PREFIX = 'session:';
  private readonly SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  constructor(redisUrl: string) {
    this.client = createClient({
      url: redisUrl
    });

    this.client.on('error', (err) => {
      logger.error('Redis session store error:', err);
      this.connected = false;
    });

    this.client.on('connect', () => {
      logger.info('Redis session store connected');
      this.connected = true;
    });

    this.client.on('disconnect', () => {
      logger.warn('Redis session store disconnected');
      this.connected = false;
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.connected = true;
      logger.info('✓ Redis session store initialized');
    } catch (error) {
      logger.error('Failed to connect to Redis session store:', error);
      this.connected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.disconnect();
      this.connected = false;
    }
  }

  async get(sessionId: string): Promise<AuthSession | null> {
    if (!this.connected) {
      logger.warn('Redis session store not connected, session lookup failed');
      return null;
    }

    try {
      const key = `${this.SESSION_PREFIX}${sessionId}`;
      const data = await this.client.get(key);
      
      if (!data) {
        return null;
      }

      return JSON.parse(data) as AuthSession;
    } catch (error) {
      logger.error('Failed to get session from Redis:', error);
      return null;
    }
  }

  async set(sessionId: string, session: AuthSession): Promise<void> {
    if (!this.connected) {
      logger.warn('Redis session store not connected, session save failed');
      return;
    }

    try {
      const key = `${this.SESSION_PREFIX}${sessionId}`;
      await this.client.setEx(
        key,
        this.SESSION_TTL,
        JSON.stringify(session)
      );
    } catch (error) {
      logger.error('Failed to set session in Redis:', error);
    }
  }

  async delete(sessionId: string): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      const key = `${this.SESSION_PREFIX}${sessionId}`;
      await this.client.del(key);
    } catch (error) {
      logger.error('Failed to delete session from Redis:', error);
    }
  }

  async clear(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      const pattern = `${this.SESSION_PREFIX}*`;
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      logger.error('Failed to clear sessions in Redis:', error);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Session store factory - creates Redis store if available, falls back to in-memory
 */
let sessionStore: ISessionStore | null = null;
let redisStore: RedisSessionStore | null = null;

export async function initializeSessionStore(): Promise<ISessionStore> {
  if (sessionStore) {
    return sessionStore;
  }

  if (env.REDIS_URL) {
    try {
      logger.info('Initializing Redis session store...');
      redisStore = new RedisSessionStore(env.REDIS_URL);
      await redisStore.connect();
      sessionStore = redisStore;
      return sessionStore;
    } catch (error) {
      logger.error('Failed to initialize Redis session store, falling back to in-memory:', error);
      // Fall through to in-memory store
    }
  }

  logger.warn(
    '⚠️  Using in-memory session store (development only). ' +
    'For production, set REDIS_URL for persistent, scalable sessions.'
  );

  sessionStore = new InMemorySessionStore();
  return sessionStore;
}

/**
 * Get the current session store instance
 */
export function getSessionStore(): ISessionStore {
  if (!sessionStore) {
    throw new Error('Session store not initialized. Call initializeSessionStore() first.');
  }
  return sessionStore;
}

/**
 * Graceful shutdown for Redis store
 */
export async function shutdownSessionStore(): Promise<void> {
  if (redisStore) {
    await redisStore.disconnect();
  }
  sessionStore = null;
}
