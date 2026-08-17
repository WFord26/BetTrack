/**
 * Shared Validation Schemas
 * 
 * Reusable Zod schemas for common request patterns across the API.
 * Eliminates duplicated validation logic and ensures consistency.
 */

import { z } from 'zod';

/**
 * Pagination parameters schema
 * 
 * Used across analytics routes to standardize pagination:
 * - limit: Number of results (1-100, default 20)
 * - offset: Number of results to skip (0+, default 0)
 */
export const paginationSchema = z.object({
  limit: z
    .union([z.string(), z.number()])
    .transform((val) => {
      if (typeof val === 'string') return parseInt(val, 10);
      return val;
    })
    .refine((val) => !isNaN(val), 'limit must be a valid number')
    .pipe(z.number().int().min(1, 'limit must be at least 1').max(100, 'limit must be at most 100'))
    .default(20),

  offset: z
    .union([z.string(), z.number()])
    .transform((val) => {
      if (typeof val === 'string') return parseInt(val, 10);
      return val;
    })
    .refine((val) => !isNaN(val), 'offset must be a valid number')
    .pipe(z.number().int().min(0, 'offset must be at least 0'))
    .default(0),
});

/**
 * Pagination query parameters with optional filters
 */
export type PaginationParams = z.infer<typeof paginationSchema>;

/**
 * Date range query parameters
 * 
 * Used for filtering data by date range:
 * - startDate: ISO 8601 formatted date string
 * - endDate: ISO 8601 formatted date string
 */
export const dateRangeSchema = z.object({
  startDate: z
    .string()
    .datetime({ offset: true })
    .optional(),

  endDate: z
    .string()
    .datetime({ offset: true })
    .optional(),
});

export type DateRangeParams = z.infer<typeof dateRangeSchema>;

/**
 * Sort parameters schema
 * 
 * Used for standardizing sort queries:
 * - sortBy: Field name to sort by
 * - sortOrder: 'asc' or 'desc'
 */
export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type SortParams = z.infer<typeof sortSchema>;

/**
 * Combined query parameters schema (pagination + sorting + date range)
 */
export const queryParamsSchema = paginationSchema
  .merge(sortSchema)
  .merge(dateRangeSchema);

export type QueryParams = z.infer<typeof queryParamsSchema>;

/**
 * Helper function to safely parse query parameters
 */
export const parseQueryParams = (query: Record<string, any>): QueryParams => {
  return queryParamsSchema.parse(query);
};

/**
 * Helper function to safely parse pagination-only parameters
 */
export const parsePaginationParams = (query: Record<string, any>): PaginationParams => {
  return paginationSchema.parse(query);
};
