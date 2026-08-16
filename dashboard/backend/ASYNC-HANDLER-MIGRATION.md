# AsyncHandler Migration Guide

## Overview

This document provides a step-by-step guide for migrating route handlers from manual try/catch blocks to the centralized `asyncHandler` wrapper.

**Benefits:**
- Eliminates 63+ hand-rolled try/catch blocks
- Centralized error handling via error middleware
- Consistent error responses across all endpoints
- Reduced code duplication
- Easier to maintain and extend error handling

## Pattern Comparison

### Before (current pattern)

```typescript
router.post('/endpoint', async (req: Request, res: Response) => {
  try {
    const data = await someAsyncOperation();
    res.json(data);
  } catch (error: any) {
    logger.error('Failed to do something:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to do something',
      error: error.message
    });
  }
});
```

### After (asyncHandler pattern)

```typescript
router.post('/endpoint', asyncHandler(async (req: Request, res: Response) => {
  const data = await someAsyncOperation();
  res.json(data);
}));
```

**Key changes:**
1. Add `asyncHandler()` wrapper around the handler function
2. Remove entire try/catch block
3. Remove manual error response (handled by error middleware)
4. Keep logging context at the service/middleware level

## Implementation Steps

### Step 1: Import asyncHandler

Add to route file imports:

```typescript
import { asyncHandler } from '../utils/async-handler';
```

### Step 2: Wrap Handler Functions

Change:
```typescript
router.post('/endpoint', async (req: Request, res: Response) => {
```

To:
```typescript
router.post('/endpoint', asyncHandler(async (req: Request, res: Response) => {
```

And close the wrapper:
```typescript
}));  // asyncHandler + route registration
```

### Step 3: Remove try/catch Blocks

Delete:
- The entire `try {` block opening
- The entire `catch (error: any) { ... }` block

Leave only the success path logic.

### Step 4: Optional - Add Logging Context

Move error logging to service/middleware layer or use structured logging:

```typescript
// In service layer
logger.error('Failed to initialize sports:', error);

// NOT in route handler (already logged by error middleware)
```

### Step 5: Update Zod Validation

Use the shared validation schemas for consistent parameter handling:

```typescript
import { parsePaginationParams } from '../schemas/query-params.schema';

router.get('/data', asyncHandler(async (req: Request, res: Response) => {
  const { limit, offset } = parsePaginationParams(req.query);
  
  const data = await getDataWithPagination(limit, offset);
  res.json(data);
}));
```

## Priority Order

Routes ranked by number of try/catch blocks (highest priority first):

1. **admin.routes.ts** — 15 endpoints ✅ (2 converted as examples)
2. **bets.routes.ts** — ~10 endpoints
3. **games.routes.ts** — ~8 endpoints
4. **stats.routes.ts** — ~7 endpoints
5. **analytics-*.routes.ts** (6 files) — ~5 endpoints each

## Example Conversions

### Simple GET Endpoint

Before:
```typescript
router.get('/sports', async (_req: Request, res: Response) => {
  try {
    const sports = await prisma.sport.findMany();
    res.json(sports);
  } catch (error: any) {
    logger.error('Failed to fetch sports:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch sports',
      error: error.message
    });
  }
});
```

After:
```typescript
router.get('/sports', asyncHandler(async (_req: Request, res: Response) => {
  const sports = await prisma.sport.findMany();
  res.json(sports);
}));
```

### POST with Body Validation

Before:
```typescript
router.post('/bets', async (req: Request, res: Response) => {
  try {
    const validated = betSchema.parse(req.body);
    const bet = await prisma.bet.create({ data: validated });
    res.json(bet);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    logger.error('Failed to create bet:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create bet'
    });
  }
});
```

After:
```typescript
router.post(
  '/bets',
  validateBody(betSchema),  // Validation happens in middleware
  asyncHandler(async (req: Request, res: Response) => {
    const validated = req.body;  // Already validated
    const bet = await prisma.bet.create({ data: validated });
    res.json(bet);
  })
);
```

### Complex Handler with Background Jobs

Before:
```typescript
router.post('/sync-odds', async (req: Request, res: Response) => {
  try {
    const { sportKey } = req.body;

    // Background job
    const syncPromise = oddsSyncService.syncAllOdds()
      .catch(error => logger.error('Sync failed:', error));

    res.json({ status: 'started' });
  } catch (error: any) {
    logger.error('Failed to start sync:', error);
    res.status(500).json({ status: 'error' });
  }
});
```

After:
```typescript
router.post('/sync-odds', asyncHandler(async (req: Request, res: Response) => {
  const { sportKey } = req.body;

  // Background job (error already logged by Promise.catch)
  oddsSyncService.syncAllOdds()
    .catch(error => logger.error('Background sync failed:', error));

  res.json({ status: 'started' });
}));
```

## Shared Validation Schemas

### Pagination

```typescript
import { parsePaginationParams } from '../schemas/query-params.schema';

router.get('/data', asyncHandler(async (req: Request, res: Response) => {
  const { limit, offset } = parsePaginationParams(req.query);
  // ... use limit and offset
}));
```

### Date Range

```typescript
import { dateRangeSchema } from '../schemas/query-params.schema';

router.get('/events', asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  // ... filter by date range
}));
```

### Combined Query Parameters

```typescript
import { queryParamsSchema } from '../schemas/query-params.schema';

router.get('/data', asyncHandler(async (req: Request, res: Response) => {
  const params = queryParamsSchema.parse(req.query);
  const { limit, offset, sortBy, sortOrder, startDate, endDate } = params;
  // ... use parameters
}));
```

## Error Handling

### Automatic Centralized Handling

Errors thrown in asyncHandler are caught and passed to the error middleware:

```typescript
// middleware/error.middleware.ts
export const errorMiddleware = (err: Error, req, res, next) => {
  // All errors from asyncHandler arrive here
  logger.error(`${err.statusCode} - ${err.message}`);
  res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message
  });
};
```

### Custom Error Classes

Use `AppError` for domain-specific errors:

```typescript
import { AppError } from '../middleware/error.middleware';

router.get('/user/:id', asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json(user);
}));
```

## Testing

### Route Handler Tests

```typescript
import request from 'supertest';
import app from '../app';

describe('Admin Routes with asyncHandler', () => {
  it('should handle successful requests', async () => {
    const res = await request(app)
      .post('/api/admin/init-sports')
      .expect(200);

    expect(res.body.status).toBe('success');
  });

  it('should handle errors via error middleware', async () => {
    // Mock prisma to throw error
    jest.spyOn(prisma.sport, 'upsert').mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/admin/init-sports')
      .expect(500);

    expect(res.body.status).toBe('error');
  });
});
```

## Checklist for Each Route File

- [ ] Import asyncHandler utility
- [ ] Wrap all route handler functions with asyncHandler
- [ ] Remove all try/catch blocks from route handlers
- [ ] Replace ad-hoc pagination parsing with `parsePaginationParams()`
- [ ] Replace ad-hoc date range parsing with `dateRangeSchema.parse()`
- [ ] Verify error responses still work via error middleware
- [ ] Run tests (`npm test`)
- [ ] Verify coverage hasn't decreased
- [ ] Submit as single PR per file

## PR Template

When submitting PRs for asyncHandler migration:

```markdown
## Description

Refactor [filename] to use asyncHandler middleware for error handling.

- Removed [N] hand-rolled try/catch blocks
- Centralized error responses via error middleware
- Updated pagination/query parameter handling with shared schemas
- All [N] tests passing

## Changes

- Removed redundant error handling code
- Improved code clarity by removing 63+ lines of boilerplate
- Error handling now consistent across all endpoints

## Testing

- [x] All existing tests pass
- [x] Manual testing confirms error responses work
- [x] Coverage maintained/improved
```

## Common Pitfalls

### ❌ Don't forget the closing wrapper

```typescript
// WRONG - missing asyncHandler()
router.get('/endpoint', async (req, res) => {
  const data = await getData();
  res.json(data);
});

// CORRECT
router.get('/endpoint', asyncHandler(async (req, res) => {
  const data = await getData();
  res.json(data);
}));
```

### ❌ Don't remove logging at service level

```typescript
// WRONG - removed all logging
router.post('/action', asyncHandler(async (req, res) => {
  await someService.doAction();  // No logging if it fails
  res.json({ status: 'ok' });
}));

// CORRECT - logging at service level
router.post('/action', asyncHandler(async (req, res) => {
  try {
    await someService.doAction();  // Service logs internally
  } catch (error) {
    logger.error('Action failed:', error);
    throw error;  // asyncHandler catches and passes to middleware
  }
  res.json({ status: 'ok' });
}));
```

### ❌ Don't mix validation approaches

```typescript
// WRONG - mixing manual parsing with shared schemas
const limit = parseInt(req.query.limit as string) || 20;
const { offset } = parsePaginationParams(req.query);  // Inconsistent

// CORRECT - use shared schema consistently
const { limit, offset } = parsePaginationParams(req.query);
```

## Questions?

If you encounter issues during migration:
1. Check this guide's "Common Pitfalls" section
2. Review existing examples in `admin.routes.ts`
3. Check error middleware behavior in `middleware/error.middleware.ts`
4. Ensure error middleware is registered in app setup
