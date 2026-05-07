/**
 * Integration tests for Analytics CLV Routes
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';

// Mock session-store
jest.mock('../src/services/session-store.service', () => ({
  initializeSessionStore: jest.fn(),
  shutdownSessionStore: jest.fn(),
  getSessionStore: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
  })),
  sessionStore: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
  },
}));

// Bypass auth
jest.mock('../src/middleware/auth-session.middleware', () => ({
  requireSessionAuth: jest.fn((_req: any, _res: any, next: any) => next()),
  optionalAuth: jest.fn((_req: any, _res: any, next: any) => next()),
  isAuthEnabled: jest.fn(() => false),
  getScopedUserId: jest.fn(() => undefined),
  getUserId: jest.fn(() => null),
  requireAdminAccess: jest.fn((_req: any, _res: any, next: any) => next()),
  attachAuthSession: jest.fn((_req: any, _res: any, next: any) => next()),
}));

// Mock Prisma
jest.mock('../src/config/database', () => ({
  prisma: {
    bet: { findMany: jest.fn() },
    betLeg: { findMany: jest.fn() },
    currentOdds: { findMany: jest.fn() },
  },
}));

// Mock clvService
jest.mock('../src/services/clv.service', () => ({
  clvService: {
    generateCLVReport: jest.fn(),
    calculateBetCLV: jest.fn(),
  },
}));

import app from '../src/app';
import { clvService } from '../src/services/clv.service';

const mockClvService = clvService as jest.Mocked<typeof clvService>;

const sampleReport = {
  summary: {
    avgCLV: 2.5,
    totalBets: 20,
    betsWithCLV: 18,
    edgeBets: 10,
    flatBets: 5,
    negativeCLVBets: 3,
  },
  bySport: [
    { sportKey: 'basketball_nba', avgCLV: 3.1, totalBets: 10 },
  ],
  byBookmaker: [
    { bookmaker: 'draftkings', avgCLV: 2.8, totalBets: 8 },
  ],
  byBetType: [
    { betType: 'single', avgCLV: 2.2, totalBets: 15 },
  ],
  recentBets: [],
};

describe('GET /api/analytics/clv/summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with CLV summary', async () => {
    mockClvService.generateCLVReport.mockResolvedValue(sampleReport as any);

    const res = await request(app).get('/api/analytics/clv/summary');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ avgCLV: 2.5 });
  });

  it('returns 500 when service throws', async () => {
    mockClvService.generateCLVReport.mockRejectedValue(new Error('DB error'));

    const res = await request(app).get('/api/analytics/clv/summary');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/analytics/clv/by-sport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with CLV by sport', async () => {
    mockClvService.generateCLVReport.mockResolvedValue(sampleReport as any);

    const res = await request(app).get('/api/analytics/clv/by-sport');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 500 when service throws', async () => {
    mockClvService.generateCLVReport.mockRejectedValue(new Error('Service error'));

    const res = await request(app).get('/api/analytics/clv/by-sport');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/analytics/clv/by-bookmaker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with CLV by bookmaker', async () => {
    mockClvService.generateCLVReport.mockResolvedValue(sampleReport as any);

    const res = await request(app).get('/api/analytics/clv/by-bookmaker');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/analytics/clv/trends', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with CLV trends', async () => {
    mockClvService.generateCLVReport.mockResolvedValue(sampleReport as any);

    const res = await request(app).get('/api/analytics/clv/trends');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('accepts sportKey and betType query params', async () => {
    mockClvService.generateCLVReport.mockResolvedValue(sampleReport as any);

    const res = await request(app)
      .get('/api/analytics/clv/trends')
      .query({ sportKey: 'basketball_nba', betType: 'single' });

    expect(res.status).toBe(200);
    expect(mockClvService.generateCLVReport).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ sportKey: 'basketball_nba', betType: 'single' })
    );
  });
});
