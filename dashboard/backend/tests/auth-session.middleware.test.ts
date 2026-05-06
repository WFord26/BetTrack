/**
 * Unit tests for Auth-Session Middleware
 * Tests requireSessionAuth, optionalAuth, requireAdminAccess helper functions
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';

// Mock env before imports
jest.mock('../src/config/env', () => ({
  env: {
    AUTH_MODE: 'none',
    SESSION_SECRET: 'test-secret-that-is-long-enough',
    NODE_ENV: 'test',
    BASE_URL: 'http://localhost:3001',
    CORS_ORIGIN: 'http://localhost:5173',
  },
}));

jest.mock('../src/config/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../src/config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

jest.mock('../src/services/session-store.service', () => ({
  getSessionStore: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}));

import {
  requireSessionAuth,
  optionalAuth,
  requireAdminAccess,
  getUserId,
  getScopedUserId,
  isAuthEnabled,
  type AuthenticatedRequest,
} from '../src/middleware/auth-session.middleware';
import { env } from '../src/config/env';

const mockEnv = env as { AUTH_MODE: string };

function makeReq(user?: AuthenticatedRequest['user']): AuthenticatedRequest {
  return { user, path: '/api/test' } as AuthenticatedRequest;
}

function makeRes() {
  const json = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status, json } as unknown as Response, status, json };
}

describe('requireSessionAuth', () => {
  let next: jest.Mock;

  beforeEach(() => {
    next = jest.fn();
    mockEnv.AUTH_MODE = 'none';
  });

  it('calls next() when AUTH_MODE is none', () => {
    const { res } = makeRes();
    requireSessionAuth(makeReq(), res, next as NextFunction);
    expect(next).toHaveBeenCalled();
  });

  it('calls next() when user is authenticated and AUTH_MODE is oauth2', () => {
    mockEnv.AUTH_MODE = 'oauth2';
    const { res } = makeRes();
    const req = makeReq({ id: 'user-1', email: 'user@test.com', provider: 'google', isAdmin: false, isActive: true });

    requireSessionAuth(req, res, next as NextFunction);

    expect(next).toHaveBeenCalled();
  });

  it('returns 401 when AUTH_MODE is oauth2 and no user', () => {
    mockEnv.AUTH_MODE = 'oauth2';
    const { res, status, json } = makeRes();

    requireSessionAuth(makeReq(), res, next as NextFunction);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Authentication required' })
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe('optionalAuth', () => {
  let next: jest.Mock;

  beforeEach(() => {
    next = jest.fn();
    mockEnv.AUTH_MODE = 'none';
  });

  it('calls next() when AUTH_MODE is none', () => {
    const { res } = makeRes();
    const req = makeReq();

    optionalAuth(req, res, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('calls next() when AUTH_MODE is oauth2', () => {
    mockEnv.AUTH_MODE = 'oauth2';
    const { res } = makeRes();

    optionalAuth(makeReq(), res, next as NextFunction);

    expect(next).toHaveBeenCalled();
  });
});

describe('requireAdminAccess', () => {
  let next: jest.Mock;

  beforeEach(() => {
    next = jest.fn();
  });

  it('calls next() when user is an admin', () => {
    const { res } = makeRes();
    const req = makeReq({ id: 'admin-1', email: 'admin@test.com', provider: 'google', isAdmin: true, isActive: true });

    requireAdminAccess(req, res, next as NextFunction);

    expect(next).toHaveBeenCalled();
  });

  it('returns 401 when no user', () => {
    const { res, status } = makeRes();

    requireAdminAccess(makeReq(), res, next as NextFunction);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user is not an admin', () => {
    const { res, status, json } = makeRes();
    const req = makeReq({ id: 'user-1', email: 'user@test.com', provider: 'google', isAdmin: false, isActive: true });

    requireAdminAccess(req, res, next as NextFunction);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Admin access required' })
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe('getUserId', () => {
  beforeEach(() => {
    mockEnv.AUTH_MODE = 'none';
  });

  it('returns null when AUTH_MODE is none', () => {
    expect(getUserId(makeReq())).toBeNull();
  });

  it('returns user id when AUTH_MODE is oauth2 and user is present', () => {
    mockEnv.AUTH_MODE = 'oauth2';
    const req = makeReq({ id: 'user-abc', email: 'user@test.com', provider: 'google', isAdmin: false, isActive: true });

    expect(getUserId(req)).toBe('user-abc');
  });

  it('returns null when AUTH_MODE is oauth2 but no user', () => {
    mockEnv.AUTH_MODE = 'oauth2';
    expect(getUserId(makeReq())).toBeNull();
  });
});

describe('getScopedUserId', () => {
  beforeEach(() => {
    mockEnv.AUTH_MODE = 'none';
  });

  it('returns undefined when AUTH_MODE is none', () => {
    expect(getScopedUserId(makeReq())).toBeUndefined();
  });

  it('returns user id when AUTH_MODE is oauth2 and user is present', () => {
    mockEnv.AUTH_MODE = 'oauth2';
    const req = makeReq({ id: 'user-xyz', email: 'user@test.com', provider: 'google', isAdmin: false, isActive: true });

    expect(getScopedUserId(req)).toBe('user-xyz');
  });
});

describe('isAuthEnabled', () => {
  it('returns false when AUTH_MODE is none', () => {
    mockEnv.AUTH_MODE = 'none';
    expect(isAuthEnabled()).toBe(false);
  });

  it('returns true when AUTH_MODE is oauth2', () => {
    mockEnv.AUTH_MODE = 'oauth2';
    expect(isAuthEnabled()).toBe(true);
  });
});
