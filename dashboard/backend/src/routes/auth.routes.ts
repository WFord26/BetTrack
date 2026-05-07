import crypto from 'crypto';
import express, { Request, Response } from 'express';
import { env } from '../config/env';
import { logger } from '../config/logger';
import {
  createAuthenticatedSession,
  destroyAuthSession,
  ensureAuthSession,
  isAuthEnabled,
  saveAuthSession,
} from '../middleware/auth-session.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { OAuthError, oauthService } from '../services/oauth.service';
import type { AuthProvider } from '../types/auth.types';

const router = express.Router();

// SECURITY: rate-limit login + callback endpoints by IP. The numbers are
// generous — real users only hit these a handful of times per session,
// but they cap drive-by enumeration and IdP-quota abuse.
const oauthBeginLimiter = rateLimit({
  windowMs: 60_000, // 1 min
  max: 30,
  label: 'oauth-begin',
});

const oauthCallbackLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  label: 'oauth-callback',
});

const logoutLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  label: 'logout',
});

function sanitizeRedirectPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/';
  }

  return value;
}

function getProviderError(provider: AuthProvider): string {
  return provider === 'google' ? 'google_auth_failed' : 'microsoft_auth_failed';
}

function redirectToFrontend(res: Response, path: string, frontendOrigin?: string) {
  res.redirect(oauthService.buildFrontendRedirect(path, frontendOrigin));
}

function ensureOAuthProvider(req: Request, res: Response, provider: AuthProvider): boolean {
  if (!isAuthEnabled()) {
    res.status(404).json({
      error: 'Authentication is not enabled',
    });
    return false;
  }

  if (!oauthService.isProviderConfigured(provider)) {
    res.status(404).json({
      error: `${provider} authentication is not configured`,
    });
    return false;
  }

  return true;
}

async function beginOAuth(req: Request, res: Response, provider: AuthProvider) {
  if (!ensureOAuthProvider(req, res, provider)) {
    return;
  }

  const session = await ensureAuthSession(req, res);
  const redirectPath = sanitizeRedirectPath(req.query.redirectTo);
  const state = crypto.randomBytes(24).toString('hex');

  // Capture the frontend origin that started the login flow so the callback
  // can redirect back to the correct host in multi-origin deployments.
  // The Origin header is the most reliable signal (present on XHR/fetch and
  // on the navigation request the frontend generates to /api/auth/<provider>).
  // Referer is used as a fallback for browsers that omit Origin on same-site
  // top-level navigations.
  const rawOrigin = req.headers['origin'] as string | undefined
    ?? (req.headers['referer'] ? new URL(req.headers['referer'] as string).origin : undefined);
  const validatedOrigin = oauthService.validateFrontendOrigin(rawOrigin) ?? undefined;

  session.oauthState = state;
  session.oauthProvider = provider;
  session.redirectPath = redirectPath;
  session.frontendOrigin = validatedOrigin;

  // SECURITY: Persist the mutated session BEFORE redirecting to the IdP.
  // RedisSessionStore JSON-serializes on write, so without this save the
  // oauthState/oauthProvider are lost and the callback's CSRF check fails
  // (and OAuth login is broken in any deployment using Redis).
  await saveAuthSession(req, res, session);

  const authorizationUrl = oauthService.buildAuthorizationUrl(provider, state);
  res.redirect(authorizationUrl);
}

async function handleOAuthCallback(req: Request, res: Response, provider: AuthProvider) {
  const providerError = getProviderError(provider);

  if (!ensureOAuthProvider(req, res, provider)) {
    return;
  }

  const session = req.authSession;
  const code = typeof req.query.code === 'string' ? req.query.code : null;
  const state = typeof req.query.state === 'string' ? req.query.state : null;

  const frontendOrigin = session?.frontendOrigin;

  if (typeof req.query.error === 'string') {
    redirectToFrontend(res, `/login?error=${providerError}`, frontendOrigin);
    return;
  }

  if (
    !session ||
    !code ||
    !state ||
    session.oauthState !== state ||
    session.oauthProvider !== provider
  ) {
    await destroyAuthSession(req, res);
    redirectToFrontend(res, `/login?error=${providerError}`, frontendOrigin);
    return;
  }

  try {
    const user = await oauthService.authenticate(provider, code);
    const redirectPath = sanitizeRedirectPath(session.redirectPath);

    await createAuthenticatedSession(req, res, user, redirectPath);
    logger.info(`User logged in via ${provider}: ${user.email}`);

    redirectToFrontend(res, redirectPath, frontendOrigin);
  } catch (error) {
    const redirectError = error instanceof OAuthError
      ? error.redirectError
      : providerError;

    logger.error(`OAuth callback failed for ${provider}:`, error);
    await destroyAuthSession(req, res);
    redirectToFrontend(res, `/login?error=${redirectError}`, frontendOrigin);
  }
}

router.get('/status', (req: Request, res: Response) => {
  res.json({
    authEnabled: isAuthEnabled(),
    authMode: env.AUTH_MODE,
    user: req.user || null,
    providers: oauthService.getAvailableProviders(),
  });
});

router.get('/google', oauthBeginLimiter, async (req: Request, res: Response) => {
  await beginOAuth(req, res, 'google');
});

router.get('/google/callback', oauthCallbackLimiter, async (req: Request, res: Response) => {
  await handleOAuthCallback(req, res, 'google');
});

router.get('/microsoft', oauthBeginLimiter, async (req: Request, res: Response) => {
  await beginOAuth(req, res, 'microsoft');
});

router.get('/microsoft/callback', oauthCallbackLimiter, async (req: Request, res: Response) => {
  await handleOAuthCallback(req, res, 'microsoft');
});

router.post('/logout', logoutLimiter, async (req: Request, res: Response): Promise<void> => {
  if (!isAuthEnabled()) {
    res.json({ success: true, message: 'Auth not enabled' });
    return;
  }

  const userEmail = req.user?.email;

  try {
    // Removed legacy `req.session.destroy` / `req.logout` branches —
    // those came from express-session + passport, both of which were
    // ripped out in the auth refactor. The custom session store is the
    // single source of truth now.
    await destroyAuthSession(req, res);
    logger.info(`User logged out: ${userEmail}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

router.get('/me', (req: Request, res: Response) => {
  if (!isAuthEnabled()) {
    return res.json({ user: null, authEnabled: false });
  }

  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  return res.json({
    user: req.user,
    authEnabled: true,
  });
});

export default router;
