/**
 * Async Request Handler Wrapper
 * 
 * Wraps async route handlers and passes any thrown errors to the Express error middleware.
 * Eliminates the need for try/catch blocks in route handlers.
 * 
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => {
 *     const data = await someAsyncOperation();
 *     res.json(data);
 *   }));
 * 
 *   // Errors are automatically caught and passed to error middleware
 *   // Define specific error handling in middleware/error.middleware.ts
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

/**
 * Wraps an async route handler and catches any thrown errors,
 * passing them to Express error middleware via next()
 */
export const asyncHandler = (
  fn: AsyncRequestHandler
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Wrap the async function and catch any errors
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default asyncHandler;
