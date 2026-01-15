import { Request, Response, NextFunction } from 'express';
import { apiKeyAuth } from './api-key-auth';

/**
 * Legacy auth middleware - now uses the new apiKeyAuth system
 * Kept for backward compatibility with MCP routes
 */
export const authMiddleware = apiKeyAuth;

/**
 * Optional authentication - proceeds even if no auth provided
 */
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    // No auth provided, continue without authentication
    next();
    return;
  }
  
  // Auth provided, validate it
  return apiKeyAuth(req, res, next);
};
