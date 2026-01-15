import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { logger } from '../config/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
    provider: string;
  };
}

/**
 * Middleware to check if authentication is required
 * If AUTH_MODE=none, allows all requests
 * If AUTH_MODE=oauth2, requires authenticated session
 */
export function requireSessionAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Standalone mode - no auth required
  if (env.AUTH_MODE === 'none') {
    return next();
  }

  // OAuth2 mode - check authentication
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  logger.warn(`Unauthorized access attempt to ${req.path}`);
  return res.status(401).json({ error: 'Authentication required' });
}

/**
 * Optional auth - allows both authenticated and unauthenticated requests
 * Sets req.user if authenticated
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // In standalone mode, don't set user
  if (env.AUTH_MODE === 'none') {
    req.user = undefined;
    return next();
  }

  // In OAuth2 mode, pass through regardless (user will be set if authenticated)
  next();
}

/**
 * Get user ID from request
 * Returns null in standalone mode or if not authenticated
 */
export function getUserId(req: AuthenticatedRequest): string | null {
  if (env.AUTH_MODE === 'none') {
    return null;
  }
  
  return req.user?.id || null;
}

/**
 * Check if auth is enabled
 */
export function isAuthEnabled(): boolean {
  return env.AUTH_MODE === 'oauth2';
}
