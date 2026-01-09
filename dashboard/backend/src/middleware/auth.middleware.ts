import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

export class AuthError extends Error {
  statusCode = 401;
  
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Middleware to validate Bearer token for MCP endpoints
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    if (!token) {
      throw new AuthError('No token provided');
    }

    // Hash the token to compare with stored hash
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find token in database
    const apiToken = await prisma.apiToken.findUnique({
      where: { tokenHash }
    });

    if (!apiToken) {
      throw new AuthError('Invalid token');
    }

    // Check if token is expired
    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      throw new AuthError('Token expired');
    }

    // Update last used timestamp
    await prisma.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsed: new Date() }
    });

    // Attach token info to request
    (req as any).apiToken = apiToken;

    next();
  } catch (error) {
    if (error instanceof AuthError) {
      logger.warn(`Authentication failed: ${error.message}`);
      res.status(error.statusCode).json({
        status: 'error',
        message: error.message
      });
      return;
    }
    next(error);
  }
};

/**
 * Optional auth - doesn't fail if no token, but validates if present
 */
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  return authMiddleware(req, res, next);
};
