/**
 * Session auth middleware - consolidated exports for auth helpers.
 * Re-exports from auth-session.middleware for cleaner import paths.
 */
export {
  requireAdminAccess,
  requireSessionAuth,
  optionalAuth,
  getUserId,
  getScopedUserId,
  isAuthEnabled,
  attachAuthSession,
  ensureAuthSession,
  createAuthenticatedSession,
  destroyAuthSession,
  saveAuthSession,
} from './auth-session.middleware';

export type { AuthenticatedRequest } from './auth-session.middleware';
