import crypto from 'crypto';
import express, { Request, Response } from 'express';
import { env } from '../config/env';
import { logger } from '../config/logger';
import {
  createAuthenticatedSession,
  destroyAuthSession,
  ensureAuthSession,
} from '../middleware/auth-session.middleware';
import { isAuthEnabled } from '../middleware/session.auth';
import { OAuthError, oauthService } from '../services/oauth.service';
import type { AuthProvider } from '../types/auth.types';

const router = express.Router();

function sanitizeRedirectPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/';
  }

  return value;
}

function getProviderError(provider: AuthProvider): string {
  return provider === 'google' ? 'google_auth_failed' : 'microsoft_auth_failed';
}

function redirectToFrontend(res: Response, path: string) {
  res.redirect(oauthService.buildFrontendRedirect(path));
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

  session.oauthState = state;
  session.oauthProvider = provider;
  session.redirectPath = redirectPath;

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

  if (typeof req.query.error === 'string') {
    redirectToFrontend(res, `/login?error=${providerError}`);
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
    redirectToFrontend(res, `/login?error=${providerError}`);
    return;
  }

  try {
    const user = await oauthService.authenticate(provider, code);
    const redirectPath = sanitizeRedirectPath(session.redirectPath);

    await createAuthenticatedSession(req, res, user, redirectPath);
    logger.info(`User logged in via ${provider}: ${user.email}`);

    redirectToFrontend(res, redirectPath);
  } catch (error) {
    const redirectError = error instanceof OAuthError
      ? error.redirectError
      : providerError;

    logger.error(`OAuth callback failed for ${provider}:`, error);
    await destroyAuthSession(req, res);
    redirectToFrontend(res, `/login?error=${redirectError}`);
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

router.get('/google', async (req: Request, res: Response) => {
  await beginOAuth(req, res, 'google');
});

router.get('/google/callback', async (req: Request, res: Response) => {
  await handleOAuthCallback(req, res, 'google');
});

router.get('/microsoft', async (req: Request, res: Response) => {
  await beginOAuth(req, res, 'microsoft');
});

router.get('/microsoft/callback', async (req: Request, res: Response) => {
  await handleOAuthCallback(req, res, 'microsoft');
});

router.post('/logout', async (req: Request, res: Response) => {
  if (!isAuthEnabled()) {
    return res.json({ success: true, message: 'Auth not enabled' });
  }

  const userEmail = req.user?.email;
  await destroyAuthSession(req, res);
  logger.info(`User logged out: ${userEmail || 'unknown user'}`);

  return res.json({ success: true });
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
