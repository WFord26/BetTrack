import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { verifyApiKey } from '../utils/api-key-generator';

export class ApiKeyAuthError extends Error {
  statusCode = 401;
  
  constructor(message: string) {
    super(message);
    this.name = 'ApiKeyAuthError';
  }
}

/**
 * Extend Express Request to include apiKey data
 */
declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: string;
        userId: string | null;
        name: string;
        permissions: any;
      };
    }
  }
}

/**
 * Middleware to authenticate requests using API keys
 * Usage: Add to routes that should be accessible via API key
 */
export const apiKeyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    // Check for Bearer token with sk_ prefix
    if (!authHeader || !authHeader.startsWith('Bearer sk_')) {
      throw new ApiKeyAuthError('Invalid or missing API key');
    }

    const key = authHeader.replace('Bearer ', '');

    // Find all non-revoked, non-expired API keys
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        revoked: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    });

    // Verify the key against each stored hash
    let matchedKey: typeof apiKeys[0] | null = null;
    for (const apiKey of apiKeys) {
      const isValid = await verifyApiKey(key, apiKey.keyHash);
      if (isValid) {
        matchedKey = apiKey;
        break;
      }
    }

    if (!matchedKey) {
      throw new ApiKeyAuthError('Invalid or expired API key');
    }

    // Update last used timestamp (async, don't wait)
    prisma.apiKey.update({
      where: { id: matchedKey.id },
      data: { lastUsedAt: new Date() }
    }).catch(err => {
      logger.error('Failed to update API key last used timestamp:', err);
    });

    // Log usage (async, don't wait)
    prisma.apiKeyUsage.create({
      data: {
        apiKeyId: matchedKey.id,
        endpoint: req.path,
        method: req.method,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null
      }
    }).catch(err => {
      logger.error('Failed to log API key usage:', err);
    });

    // Attach API key data to request
    req.apiKey = {
      id: matchedKey.id,
      userId: matchedKey.userId,
      name: matchedKey.name,
      permissions: matchedKey.permissions
    };

    next();
  } catch (error) {
    if (error instanceof ApiKeyAuthError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message
      });
    } else {
      logger.error('API key authentication error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during authentication'
      });
    }
  }
};

/**
 * Check if API key has specific permission
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const permissions = req.apiKey.permissions || {};
    
    if (!permissions[permission]) {
      res.status(403).json({
        success: false,
        error: `Permission '${permission}' required`
      });
      return;
    }

    next();
  };
};
