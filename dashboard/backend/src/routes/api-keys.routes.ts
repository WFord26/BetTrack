import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { generateApiKey, hashApiKey, getKeyPrefix } from '../utils/api-key-generator';

const router = Router();

/**
 * GET /api/keys
 * List all API keys for current user (or all in standalone mode)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // In standalone mode (no auth), show all keys
    // In auth mode, filter by userId from session
    const userId = (req as any).session?.user?.id || null;
    
    const apiKeys = await prisma.apiKey.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        revoked: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      data: {
        keys: apiKeys
      }
    });
  } catch (error) {
    logger.error('Error fetching API keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch API keys'
    });
  }
});

/**
 * POST /api/keys
 * Create a new API key
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, permissions, expiresAt } = req.body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    // Get userId from session if in auth mode
    const userId = (req as any).session?.user?.id || null;

    // Generate API key
    const plainKey = generateApiKey();
    const keyHash = await hashApiKey(plainKey);
    const keyPrefix = getKeyPrefix(plainKey);

    // Default permissions if not provided
    const defaultPermissions = {
      read: true,
      write: true,
      bets: true,
      stats: true
    };

    const keyPermissions = permissions || defaultPermissions;

    // Parse expiration date if provided
    let expirationDate: Date | null = null;
    if (expiresAt) {
      const parsedDate = new Date(expiresAt);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid expiration date'
        });
      }
      expirationDate = parsedDate;
    }

    // Create API key in database
    const apiKey = await prisma.apiKey.create({
      data: {
        userId,
        name: name.trim(),
        keyHash,
        keyPrefix,
        permissions: keyPermissions,
        expiresAt: expirationDate
      }
    });

    logger.info('API key created:', {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      userId
    });

    // Return the full key ONCE (client must save it)
    res.status(201).json({
      success: true,
      data: {
        key: plainKey, // Full key - only shown once!
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        permissions: apiKey.permissions,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt
      },
      message: 'API key created successfully. Save this key - it will not be shown again.'
    });
  } catch (error) {
    logger.error('Error creating API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create API key'
    });
  }
});

/**
 * PUT /api/keys/:id
 * Update an API key's name or permissions
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, permissions } = req.body;

    // Get userId from session if in auth mode
    const userId = (req as any).session?.user?.id || null;

    // Find existing key
    const existingKey = await prisma.apiKey.findUnique({
      where: { id }
    });

    if (!existingKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    // In auth mode, verify ownership
    if (userId && existingKey.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Build update data
    const updateData: any = {};
    if (name && typeof name === 'string' && name.trim().length > 0) {
      updateData.name = name.trim();
    }
    if (permissions && typeof permissions === 'object') {
      updateData.permissions = permissions;
    }

    // Update key
    const updatedKey = await prisma.apiKey.update({
      where: { id },
      data: updateData
    });

    logger.info('API key updated:', {
      id: updatedKey.id,
      name: updatedKey.name,
      keyPrefix: updatedKey.keyPrefix
    });

    res.json({
      success: true,
      data: {
        id: updatedKey.id,
        name: updatedKey.name,
        keyPrefix: updatedKey.keyPrefix,
        permissions: updatedKey.permissions,
        expiresAt: updatedKey.expiresAt,
        revoked: updatedKey.revoked,
        lastUsedAt: updatedKey.lastUsedAt,
        createdAt: updatedKey.createdAt,
        updatedAt: updatedKey.updatedAt
      }
    });
  } catch (error) {
    logger.error('Error updating API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update API key'
    });
  }
});

/**
 * DELETE /api/keys/:id
 * Revoke (soft delete) an API key
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get userId from session if in auth mode
    const userId = (req as any).session?.user?.id || null;

    // Find existing key
    const existingKey = await prisma.apiKey.findUnique({
      where: { id }
    });

    if (!existingKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    // In auth mode, verify ownership
    if (userId && existingKey.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Revoke key (soft delete)
    await prisma.apiKey.update({
      where: { id },
      data: { revoked: true }
    });

    logger.info('API key revoked:', {
      id,
      name: existingKey.name,
      keyPrefix: existingKey.keyPrefix
    });

    res.json({
      success: true,
      message: 'API key revoked successfully'
    });
  } catch (error) {
    logger.error('Error revoking API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke API key'
    });
  }
});

/**
 * GET /api/keys/:id/usage
 * Get usage statistics for an API key
 */
router.get('/:id/usage', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '100' } = req.query;

    // Get userId from session if in auth mode
    const userId = (req as any).session?.user?.id || null;

    // Find existing key
    const existingKey = await prisma.apiKey.findUnique({
      where: { id }
    });

    if (!existingKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    // In auth mode, verify ownership
    if (userId && existingKey.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get usage logs
    const usage = await prisma.apiKeyUsage.findMany({
      where: { apiKeyId: id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      select: {
        id: true,
        endpoint: true,
        method: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true
      }
    });

    res.json({
      success: true,
      data: {
        usage,
        total: usage.length
      }
    });
  } catch (error) {
    logger.error('Error fetching API key usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage statistics'
    });
  }
});

export default router;
