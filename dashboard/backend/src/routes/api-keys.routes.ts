import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { generateApiKey, hashApiKey, getKeyPrefix } from '../utils/api-key-generator';
import {
  AuthenticatedRequest,
  getScopedUserId,
  requireSessionAuth
} from '../middleware/auth-session.middleware';
import { validateBody } from '../middleware/validation.middleware';

const router = Router();

router.use(requireSessionAuth);

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

// SECURITY: An API key's `permissions` blob is consulted by `requirePermission`
// at request time, so we must reject any keys the caller invents (otherwise a
// user could mint a key with `{ admin: true }` etc. and exploit it the moment
// any future code-path checks for that flag). `.strict()` rejects unknown
// keys.
const apiKeyPermissionsSchema = z
  .object({
    read: z.boolean().optional(),
    write: z.boolean().optional(),
    bets: z.boolean().optional(),
    stats: z.boolean().optional(),
  })
  .strict();

const createApiKeyBodySchema = z.object({
  // `required_error` covers the missing-key case so both "no name" and
  // "empty/whitespace name" surface the same message.
  name: z
    .string({ required_error: 'Name is required', invalid_type_error: 'Name must be a string' })
    .trim()
    .min(1, 'Name is required')
    .max(100),
  permissions: apiKeyPermissionsSchema.optional(),
  expiresAt: z.string().datetime({ message: 'Invalid expiration date' }).optional(),
});

const updateApiKeyBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    permissions: apiKeyPermissionsSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.permissions !== undefined, {
    message: 'At least one of name or permissions must be provided',
  });

/**
 * GET /api/keys
 * List all API keys for current user (or all in standalone mode)
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getScopedUserId(req);
    
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
router.post('/', validateBody(createApiKeyBodySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // `validateBody` has parsed and trimmed `name`, validated `permissions`
    // against the strict schema, and confirmed `expiresAt` is ISO-8601.
    const { name, permissions, expiresAt } = req.body as z.infer<typeof createApiKeyBodySchema>;

    const userId = getScopedUserId(req) || null;

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

    // Create API key in database
    const apiKey = await prisma.apiKey.create({
      data: {
        userId,
        name,
        keyHash,
        keyPrefix,
        permissions: keyPermissions,
        expiresAt: expiresAt ? new Date(expiresAt) : null
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
router.put('/:id', validateBody(updateApiKeyBodySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, permissions } = req.body as z.infer<typeof updateApiKeyBodySchema>;

    const userId = getScopedUserId(req) || null;

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

    // Build update data — `name` is already trimmed by Zod, `permissions`
    // already validated against the strict schema.
    const updateData: { name?: string; permissions?: typeof permissions } = {};
    if (name !== undefined) updateData.name = name;
    if (permissions !== undefined) updateData.permissions = permissions;

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
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const userId = getScopedUserId(req) || null;

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
router.get('/:id/usage', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '100' } = req.query;

    // SECURITY: Use the canonical session helper (the legacy
    // `req.session.user.id` was removed in the auth refactor and would
    // always evaluate to null here, bypassing the ownership check below).
    const userId = getScopedUserId(req) || null;

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

    // Clamp limit to a safe range and reject non-numeric input
    const parsedLimit = parseInt(limit as string, 10);
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 500)
      : 100;

    // Get usage logs
    const usage = await prisma.apiKeyUsage.findMany({
      where: { apiKeyId: id },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
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
