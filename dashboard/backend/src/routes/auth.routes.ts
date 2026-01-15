import express, { Request, Response } from 'express';
import passport from '../config/passport';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { isAuthEnabled } from '../middleware/session.auth';

const router = express.Router();

// Auth status endpoint
router.get('/status', (req: Request, res: Response) => {
  res.json({
    authEnabled: isAuthEnabled(),
    authMode: env.AUTH_MODE,
    user: req.user || null,
    providers: {
      microsoft: !!env.MICROSOFT_CLIENT_ID,
      google: !!env.GOOGLE_CLIENT_ID
    }
  });
});

// Microsoft/Azure AD OAuth2 routes
if (env.AUTH_MODE === 'oauth2' && env.MICROSOFT_CLIENT_ID) {
  router.get('/microsoft', passport.authenticate('azure_ad_oauth2', {
    scope: ['openid', 'profile', 'email']
  }));

  router.get('/microsoft/callback',
    passport.authenticate('azure_ad_oauth2', { failureRedirect: '/login?error=microsoft_auth_failed' }),
    (req: Request, res: Response) => {
      logger.info(`User logged in via Microsoft: ${(req.user as any)?.email}`);
      res.redirect('/');
    }
  );
}

// Google OAuth2 routes
if (env.AUTH_MODE === 'oauth2' && env.GOOGLE_CLIENT_ID) {
  router.get('/google', passport.authenticate('google', {
    scope: ['openid', 'profile', 'email']
  }));

  router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login?error=google_auth_failed' }),
    (req: Request, res: Response) => {
      logger.info(`User logged in via Google: ${(req.user as any)?.email}`);
      res.redirect('/');
    }
  );
}

// Logout route
router.post('/logout', (req: Request, res: Response) => {
  if (!isAuthEnabled()) {
    return res.json({ success: true, message: 'Auth not enabled' });
  }

  const userEmail = (req.user as any)?.email;
  
  req.logout((err) => {
    if (err) {
      logger.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    
    req.session.destroy((err) => {
      if (err) {
        logger.error('Session destruction error:', err);
      }
      logger.info(`User logged out: ${userEmail}`);
      res.json({ success: true });
    });
  });
});

// Current user endpoint
router.get('/me', (req: Request, res: Response) => {
  if (!isAuthEnabled()) {
    return res.json({ user: null, authEnabled: false });
  }

  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.json({
    user: req.user,
    authEnabled: true
  });
});

export default router;
