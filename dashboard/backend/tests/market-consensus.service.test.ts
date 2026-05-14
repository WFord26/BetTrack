import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MarketConsensusService } from '../src/services/market-consensus.service';

jest.mock('../src/config/database', () => ({
  prisma: {
    currentOdds: {
      findMany: jest.fn(),
    },
    marketConsensus: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { prisma } from '../src/config/database';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('MarketConsensusService', () => {
  let service: MarketConsensusService;

  beforeEach(() => {
    service = new MarketConsensusService();
    jest.clearAllMocks();
  });

  describe('calculateConsensus', () => {
    it('calculates phase-2 consensus metrics for spreads', async () => {
      mockPrisma.currentOdds.findMany.mockResolvedValue([
        {
          bookmaker: 'pinnacle',
          marketType: 'spreads',
          homeSpread: -3,
          homeSpreadPrice: -110,
          awaySpread: 3,
          awaySpreadPrice: -110,
        },
        {
          bookmaker: 'draftkings',
          marketType: 'spreads',
          homeSpread: -3.5,
          homeSpreadPrice: -105,
          awaySpread: 3.5,
          awaySpreadPrice: -112,
        },
        {
          bookmaker: 'fanduel',
          marketType: 'spreads',
          homeSpread: -3,
          homeSpreadPrice: -115,
          awaySpread: 3,
          awaySpreadPrice: -109,
        },
        {
          bookmaker: 'circa',
          marketType: 'spreads',
          homeSpread: -2.5,
          homeSpreadPrice: -120,
          awaySpread: 2.5,
          awaySpreadPrice: -101,
        },
        {
          bookmaker: 'betmgm',
          marketType: 'spreads',
          homeSpread: -7,
          homeSpreadPrice: -108,
          awaySpread: 7,
          awaySpreadPrice: -107,
        },
      ] as any);

      const result = await service.calculateConsensus('game-1', 'spreads');

      expect(result).not.toBeNull();
      expect(result!.consensusLine).toBe(-3);
      expect(result!.consensusPrice).toBe(-110);
      expect(result!.medianLine).toBe(-3);
      expect(result!.meanLine).toBe(-3.8);
      expect(result!.modeLine).toBe(-3);
      expect(result!.range).toBe(4.5);
      expect(result!.interquartileRange).toBe(0.5);
      expect(result!.bestValueSide).toBe('away');
      expect(result!.bestValueBookmaker).toBe('circa');
      expect(result!.bestValueLine).toBe(2.5);
      expect(result!.sharpBookWeight).toBe(40);
      expect(result!.outlierBookmakers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ bookmaker: 'betmgm' }),
        ])
      );
      expect(result!.disagreementScore).toBeGreaterThan(0);
    });
  });

  describe('identifyOutliers', () => {
    it('returns per-market outlier lists for a game', async () => {
      mockPrisma.currentOdds.findMany.mockImplementation(async ({ where }: any) => {
        if (where.marketType === 'h2h') {
          return [
            { bookmaker: 'pinnacle', homePrice: -110, awayPrice: 110 },
            { bookmaker: 'fanduel', homePrice: -108, awayPrice: 108 },
          ] as any;
        }

        if (where.marketType === 'spreads') {
          return [
            {
              bookmaker: 'pinnacle',
              homeSpread: -3,
              homeSpreadPrice: -110,
              awaySpread: 3,
              awaySpreadPrice: -110,
            },
            {
              bookmaker: 'draftkings',
              homeSpread: -3,
              homeSpreadPrice: -110,
              awaySpread: 3,
              awaySpreadPrice: -110,
            },
            {
              bookmaker: 'fanduel',
              homeSpread: -3,
              homeSpreadPrice: -111,
              awaySpread: 3,
              awaySpreadPrice: -109,
            },
            {
              bookmaker: 'circa',
              homeSpread: -3,
              homeSpreadPrice: -108,
              awaySpread: 3,
              awaySpreadPrice: -112,
            },
            {
              bookmaker: 'caesars',
              homeSpread: -3,
              homeSpreadPrice: -110,
              awaySpread: 3,
              awaySpreadPrice: -110,
            },
            {
              bookmaker: 'betmgm',
              homeSpread: -12,
              homeSpreadPrice: -108,
              awaySpread: 12,
              awaySpreadPrice: -108,
            },
          ] as any;
        }

        return [
          {
            bookmaker: 'pinnacle',
            totalLine: 46.5,
            overPrice: -110,
            underPrice: -110,
          },
          {
            bookmaker: 'fanduel',
            totalLine: 46.5,
            overPrice: -108,
            underPrice: -112,
          },
        ] as any;
      });

      const outliers = await service.identifyOutliers('game-1');

      expect(outliers).toHaveLength(3);
      const spreads = outliers.find((o) => o.marketType === 'spreads');
      expect(spreads).toBeDefined();
      expect(spreads!.outlierBookmakers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ bookmaker: 'betmgm' }),
        ])
      );
    });
  });
});
