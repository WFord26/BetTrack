/**
 * Session auth middleware - consolidated exports for auth helpers.
 * Re-exports from auth-session.middleware for cleaner import paths.
 */
// NOTE: `optionalAuth` was removed — it was a no-op (`attachAuthSession`
// already optionally populates `req.user`) and had no real call sites.
export {
  requireAdminAccess,
  requireSessionAuth,
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
