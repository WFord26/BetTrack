import type { AuthSession, AuthenticatedUser } from './auth.types';

declare global {
  namespace Express {
    interface Request {
      authSession?: AuthSession;
      user?: AuthenticatedUser;
      isAuthenticated?: () => boolean;
    }
  }
}

export {};
