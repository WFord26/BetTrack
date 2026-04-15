import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { getSessionStore } from '../services/session-store.service';
import type { AuthSession, AuthenticatedUser } from '../types/auth.types';

const SESSION_COOKIE_NAME = 'bettrack.sid';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function signSessionId(sessionId: string): string {
  return crypto
    .createHmac('sha256', env.SESSION_SECRET!)
    .update(sessionId)
    .digest('hex');
}

function encodeSessionCookie(sessionId: string): string {
  return `${sessionId}.${signSessionId(sessionId)}`;
}

function decodeSessionCookie(value: string): string | null {
  const separatorIndex = value.lastIndexOf('.');

  if (separatorIndex <= 0) {
    return null;
  }

  const sessionId = value.slice(0, separatorIndex);
  const signature = value.slice(separatorIndex + 1);
  const expectedSignature = signSessionId(sessionId);

  if (signature.length !== expectedSignature.length) {
    return null;
  }

  const signatureBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  return sessionId;
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(';')
    .map((cookiePart) => cookiePart.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((cookies, cookiePart) => {
      const separatorIndex = cookiePart.indexOf('=');

      if (separatorIndex === -1) {
        return cookies;
      }

      const key = cookiePart.slice(0, separatorIndex).trim();
      const value = cookiePart.slice(separatorIndex + 1).trim();

      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function createSession(): AuthSession {
  return {
    id: crypto.randomBytes(24).toString('hex'),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
}

function touchSession(session: AuthSession) {
  session.expiresAt = Date.now() + SESSION_TTL_MS;
}

function sessionCookieValue(sessionId: string, expiresAt: number): string {
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(encodeSessionCookie(sessionId))}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(Math.floor((expiresAt - Date.now()) / 1000), 0)}`,
  ];

  if (env.NODE_ENV === 'production') {
    cookieParts.push('Secure');
  }

  return cookieParts.join('; ');
}

function expiredSessionCookieValue(): string {
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];

  if (env.NODE_ENV === 'production') {
    cookieParts.push('Secure');
  }

  return cookieParts.join('; ');
}

function writeSessionCookie(res: Response, session: AuthSession) {
  res.setHeader('Set-Cookie', sessionCookieValue(session.id, session.expiresAt));
}

function clearSessionCookie(res: Response) {
  res.setHeader('Set-Cookie', expiredSessionCookieValue());
}

function normalizeUser(user: {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  provider: string;
  isAdmin: boolean;
  isActive: boolean;
}): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    provider: user.provider,
    isAdmin: user.isAdmin,
    isActive: user.isActive,
  };
}

/**
 * Attach auth session to request
 * Loads session from Redis (or in-memory fallback)
 */
export async function attachAuthSession(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionStore = getSessionStore();
    const cookies = parseCookies(req.headers.cookie);
    const rawSessionCookie = cookies[SESSION_COOKIE_NAME];

    req.isAuthenticated = () => Boolean(req.user);

    if (!rawSessionCookie) {
      return next();
    }

    const sessionId = decodeSessionCookie(rawSessionCookie);

    if (!sessionId) {
      clearSessionCookie(res);
      return next();
    }

    const session = await sessionStore.get(sessionId);

    if (!session || session.expiresAt <= Date.now()) {
      await sessionStore.delete(sessionId);
      clearSessionCookie(res);
      return next();
    }

    touchSession(session);
    req.authSession = session;
    writeSessionCookie(res, session);
    
    // Update session in store with new expiration
    await sessionStore.set(sessionId, session);

    if (!session.userId) {
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        provider: true,
        isAdmin: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      if (user && !user.isActive) {
        logger.warn(`Inactive user attempted to use session: ${user.email}`);
      }

      await sessionStore.delete(session.id);
      clearSessionCookie(res);
      req.authSession = undefined;
      return next();
    }

    req.user = normalizeUser(user);
    return next();
  } catch (error) {
    logger.error('Failed to attach auth session:', error);
    return next(error);
  }
}

/**
 * Ensure session exists or create new one
 * Saves session to Redis (or in-memory fallback)
 */
export async function ensureAuthSession(req: Request, res: Response): Promise<AuthSession> {
  const sessionStore = getSessionStore();
  
  if (req.authSession) {
    touchSession(req.authSession);
    await sessionStore.set(req.authSession.id, req.authSession);
    writeSessionCookie(res, req.authSession);
    return req.authSession;
  }

  const session = createSession();
  await sessionStore.set(session.id, session);
  req.authSession = session;
  writeSessionCookie(res, session);
  return session;
}

/**
 * Save session to store
 */
export async function saveAuthSession(req: Request, res: Response, session: AuthSession) {
  const sessionStore = getSessionStore();
  touchSession(session);
  await sessionStore.set(session.id, session);
  req.authSession = session;
  writeSessionCookie(res, session);
}

/**
 * Create authenticated session for user
 */
export async function createAuthenticatedSession(
  req: Request,
  res: Response,
  user: AuthenticatedUser,
  redirectPath?: string
) {
  const session = await ensureAuthSession(req, res);
  session.userId = user.id;
  session.oauthState = undefined;
  session.oauthProvider = undefined;
  session.redirectPath = redirectPath;
  await saveAuthSession(req, res, session);
  req.user = user;
}

/**
 * Destroy session
 */
export async function destroyAuthSession(req: Request, res: Response) {
  const sessionStore = getSessionStore();
  if (req.authSession) {
    await sessionStore.delete(req.authSession.id);
  }

  req.authSession = undefined;
  req.user = undefined;
  req.isAuthenticated = () => false;
  clearSessionCookie(res);
}
