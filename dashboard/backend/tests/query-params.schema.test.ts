import { describe, it, expect } from '@jest/globals';
import {
  paginationSchema,
  dateRangeSchema,
  sortSchema,
  queryParamsSchema,
  parseQueryParams,
  parsePaginationParams,
} from '../src/schemas/query-params.schema';

describe('query-params.schema', () => {
  describe('paginationSchema', () => {
    it('parses string limit/offset into numbers', () => {
      const result = paginationSchema.parse({ limit: '10', offset: '5' });
      expect(result).toEqual({ limit: 10, offset: 5 });
    });

    it('accepts numeric limit/offset directly', () => {
      const result = paginationSchema.parse({ limit: 25, offset: 0 });
      expect(result).toEqual({ limit: 25, offset: 0 });
    });

    it('applies defaults when omitted', () => {
      const result = paginationSchema.parse({});
      expect(result).toEqual({ limit: 20, offset: 0 });
    });

    it('rejects a non-numeric limit string', () => {
      expect(() => paginationSchema.parse({ limit: 'abc' })).toThrow();
    });

    it('rejects a non-numeric offset string', () => {
      expect(() => paginationSchema.parse({ offset: 'abc' })).toThrow();
    });

    it('rejects limit above the max', () => {
      expect(() => paginationSchema.parse({ limit: 500 })).toThrow();
    });

    it('rejects negative offset', () => {
      expect(() => paginationSchema.parse({ offset: -1 })).toThrow();
    });
  });

  describe('dateRangeSchema', () => {
    it('accepts a valid ISO date range', () => {
      const result = dateRangeSchema.parse({
        startDate: '2026-01-01T00:00:00Z',
        endDate: '2026-01-31T00:00:00Z',
      });
      expect(result.startDate).toBe('2026-01-01T00:00:00Z');
    });

    it('allows omitted dates', () => {
      expect(dateRangeSchema.parse({})).toEqual({});
    });
  });

  describe('sortSchema', () => {
    it('defaults sortOrder to desc', () => {
      expect(sortSchema.parse({})).toEqual({ sortOrder: 'desc' });
    });

    it('accepts an explicit sortBy/sortOrder', () => {
      expect(sortSchema.parse({ sortBy: 'createdAt', sortOrder: 'asc' })).toEqual({
        sortBy: 'createdAt',
        sortOrder: 'asc',
      });
    });
  });

  describe('queryParamsSchema', () => {
    it('merges pagination, sort, and date range', () => {
      const result = queryParamsSchema.parse({ limit: '5', sortOrder: 'asc' });
      expect(result).toMatchObject({ limit: 5, offset: 0, sortOrder: 'asc' });
    });
  });

  describe('parseQueryParams', () => {
    it('parses a full query object', () => {
      const result = parseQueryParams({ limit: '15', offset: '2', sortOrder: 'asc' });
      expect(result).toMatchObject({ limit: 15, offset: 2, sortOrder: 'asc' });
    });
  });

  describe('parsePaginationParams', () => {
    it('parses pagination-only query object', () => {
      const result = parsePaginationParams({ limit: '15', offset: '2' });
      expect(result).toEqual({ limit: 15, offset: 2 });
    });
  });
});
