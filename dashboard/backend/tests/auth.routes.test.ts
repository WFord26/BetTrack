import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import express from 'express';
import request from 'supertest';

// Create mock functions that will be used in the mock module
const mockAuthenticateImpl = jest.fn((strategy: string, options?: any) => {
  return (req: Request, res: Response, next: Function) => {
    if (strategy === 'azure_ad_oauth2' || strategy === 'google') {
      // Simulate successful authentication
      if (req.path.includes('/callback')) {
        (req as any).user = {
          id: 'test-user-id',
          email: 'test@example.com',
          displayName: 'Test User',
          provider: strategy === 'azure_ad_oauth2' ? 'microsoft' : 'google'
        };
        next();
      } else {
        // Initial auth redirect
        res.redirect(`/auth/${strategy}/callback`);
      }
    } else {
      next();
    }
  };
});

const mockPassport = {
  authenticate: mockAuthenticateImpl
};

// Mock dependencies before importing routes
jest.mock('../src/config/passport', () => mockPassport, { virtual: true });

jest.mock('../src/config/env', () => ({
  env: {
    AUTH_MODE: 'oauth2',
    MICROSOFT_CLIENT_ID: 'test-microsoft-client-id',
    MICROSOFT_CLIENT_SECRET: 'test-microsoft-secret',
    MICROSOFT_TENANT_ID: 'test-tenant-id',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-secret',
    BASE_URL: 'http://localhost:3001',
    CORS_ORIGIN: 'http://localhost:5173',
  }
}));

jest.mock('../src/services/oauth.service', () => {
  class OAuthError extends Error {
    redirectError: string;
    constructor(redirectError: string, message: string) {
      super(message);
      this.name = 'OAuthError';
      this.redirectError = redirectError;
    }
  }
  return {
    oauthService: {
      isProviderConfigured: jest.fn(() => true),
      getAvailableProviders: jest.fn(() => ({ microsoft: true, google: true })),
      buildAuthorizationUrl: jest.fn((provider: string, state: string) =>
        `http://localhost/api/auth/${provider}/callback?state=${state}`
      ),
      buildFrontendRedirect: jest.fn((path: string) => path),
      authenticate: jest.fn().mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: null,
        provider: 'microsoft',
        isAdmin: false,
        isActive: true,
      }),
    },
    OAuthError,
  };
});

jest.mock('../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../src/middleware/auth-session.middleware', () => ({
  isAuthEnabled: jest.fn(() => true),
  attachAuthSession: jest.fn((_req: any, _res: any, next: any) => next()),
  ensureAuthSession: jest.fn(async (_req: any, _res: any) => ({ id: 'mock-session-id', expiresAt: Date.now() + 86400000 })),
  createAuthenticatedSession: jest.fn(async () => {}),
  destroyAuthSession: jest.fn(async () => {}),
  saveAuthSession: jest.fn(async () => {}),
}));

// Import after mocks
import authRoutes from '../src/routes/auth.routes';
import { logger } from '../src/config/logger';
import { isAuthEnabled } from '../src/middleware/auth-session.middleware';

describe('Auth Routes', () => {
  let app: express.Application;
  let mockIsAuthEnabled: jest.MockedFunction<typeof isAuthEnabled>;
  let mockLoggerInfo: jest.MockedFunction<typeof logger.info>;
  let mockLoggerError: jest.MockedFunction<typeof logger.error>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create fresh Express app for each test
    app = express();
    app.use(express.json());
    
    // Setup session mock middleware
    app.use((req: any, res, next) => {
      req.session = {
        destroy: (callback: (err?: any) => void) => {
          callback();
        }
      };
      req.logout = (callback: (err?: any) => void) => {
        req.user = undefined;
        callback();
      };
      next();
    });

    app.use('/auth', authRoutes);

    // Setup mock functions
    mockIsAuthEnabled = isAuthEnabled as jest.MockedFunction<typeof isAuthEnabled>;
    mockLoggerInfo = logger.info as jest.MockedFunction<typeof logger.info>;
    mockLoggerError = logger.error as jest.MockedFunction<typeof logger.error>;

    // Default: auth enabled
    mockIsAuthEnabled.mockReturnValue(true);
  });

  describe('GET /auth/status', () => {
    it('should return auth status with enabled auth', async () => {
      mockIsAuthEnabled.mockReturnValue(true);

      const response = await request(app).get('/auth/status');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        authEnabled: true,
        authMode: 'oauth2',
        user: null,
        providers: {
          microsoft: true,
          google: true
        }
      });
    });

    it('should return auth status with disabled auth', async () => {
      mockIsAuthEnabled.mockReturnValue(false);

      const response = await request(app).get('/auth/status');

      expect(response.status).toBe(200);
      expect(response.body.authEnabled).toBe(false);
    });

    it('should include user info when authenticated', async () => {
      const mockUser = {
        id: 'user123',
        email: 'user@example.com',
        displayName: 'Test User'
      };

      // Create app with authenticated user
      app = express();
      app.use((req: any, res, next) => {
        req.user = mockUser;
        next();
      });
      app.use('/auth', authRoutes);

      const response = await request(app).get('/auth/status');

      expect(response.status).toBe(200);
      expect(response.body.user).toEqual(mockUser);
    });

    it('should show provider availability based on env vars', async () => {
      const response = await request(app).get('/auth/status');

      expect(response.body.providers).toEqual({
        microsoft: true,
        google: true
      });
    });

    it('should show providers as false when client IDs missing', async () => {
      const { oauthService } = jest.requireMock('../src/services/oauth.service');
      oauthService.getAvailableProviders.mockReturnValueOnce({ microsoft: false, google: false });

      const response = await request(app).get('/auth/status');

      expect(response.body.providers).toEqual({
        microsoft: false,
        google: false
      });
    });
  });

  describe('GET /auth/microsoft', () => {
    it('should initiate Microsoft OAuth flow', async () => {
      const response = await request(app).get('/auth/microsoft');

      expect(response.status).toBe(302); // Redirect
      expect(response.header.location).toContain('/callback');
    });
  });

  describe('GET /auth/microsoft/callback', () => {
    it('should handle successful Microsoft authentication', async () => {
      // Create app with req.authSession pre-populated to match the state
      const callbackApp = express();
      callbackApp.use(express.json());
      callbackApp.use((req: any, _res, next) => {
        req.authSession = {
          id: 'mock-session-id',
          oauthState: 'test-state-123',
          oauthProvider: 'microsoft',
          redirectPath: '/'
        };
        next();
      });
      callbackApp.use('/auth', authRoutes);

      const response = await request(callbackApp)
        .get('/auth/microsoft/callback?code=test-auth-code&state=test-state-123');

      expect(response.status).toBe(302);
      expect(response.header.location).toBe('/');
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.stringContaining('User logged in via microsoft: test@example.com')
      );
    });

    it('should redirect to login with error on auth failure', async () => {
      const response = await request(app)
        .get('/auth/microsoft/callback?error=access_denied');

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('microsoft_auth_failed');
    });
  });

  describe('GET /auth/google', () => {
    it('should initiate Google OAuth flow', async () => {
      // Mock authenticate for google
      const { oauthService } = jest.requireMock('../src/services/oauth.service');
      oauthService.authenticate.mockResolvedValueOnce({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: null,
        provider: 'google',
        isAdmin: false,
        isActive: true,
      });

      const response = await request(app).get('/auth/google');

      expect(response.status).toBe(302); // Redirect
      expect(response.header.location).toContain('/callback');
    });
  });

  describe('GET /auth/google/callback', () => {
    it('should handle successful Google authentication', async () => {
      const { oauthService } = jest.requireMock('../src/services/oauth.service');
      oauthService.authenticate.mockResolvedValueOnce({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: null,
        provider: 'google',
        isAdmin: false,
        isActive: true,
      });

      // Create app with req.authSession pre-populated
      const callbackApp = express();
      callbackApp.use(express.json());
      callbackApp.use((req: any, _res, next) => {
        req.authSession = {
          id: 'mock-session-id',
          oauthState: 'test-state-456',
          oauthProvider: 'google',
          redirectPath: '/'
        };
        next();
      });
      callbackApp.use('/auth', authRoutes);

      const response = await request(callbackApp)
        .get('/auth/google/callback?code=test-auth-code&state=test-state-456');

      expect(response.status).toBe(302);
      expect(response.header.location).toBe('/');
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.stringContaining('User logged in via google: test@example.com')
      );
    });

    it('should redirect to login with error on auth failure', async () => {
      const response = await request(app)
        .get('/auth/google/callback?error=access_denied');

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('google_auth_failed');
    });
  });

  describe('POST /auth/logout', () => {
    it('should successfully logout authenticated user', async () => {
      // Setup authenticated user
      app = express();
      app.use(express.json());
      app.use((req: any, res, next) => {
        req.user = { id: 'user123', email: 'test@example.com' };
        req.session = {
          destroy: (callback: (err?: any) => void) => {
            callback();
          }
        };
        req.logout = (callback: (err?: any) => void) => {
          req.user = undefined;
          callback();
        };
        next();
      });
      app.use('/auth', authRoutes);

      const response = await request(app).post('/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(mockLoggerInfo).toHaveBeenCalledWith('User logged out: test@example.com');
    });

    it('should return success when auth is disabled', async () => {
      mockIsAuthEnabled.mockReturnValue(false);

      const response = await request(app).post('/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, message: 'Auth not enabled' });
    });

    it('should handle logout errors gracefully', async () => {
      // Setup user with failing logout
      app = express();
      app.use(express.json());
      app.use((req: any, res, next) => {
        req.user = { id: 'user123', email: 'test@example.com' };
        req.logout = (callback: (err?: any) => void) => {
          callback(new Error('Logout failed'));
        };
        next();
      });
      app.use('/auth', authRoutes);

      const response = await request(app).post('/auth/logout');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Logout failed' });
      expect(mockLoggerError).toHaveBeenCalledWith('Logout error:', expect.any(Error));
    });

    it('should handle session destruction errors gracefully', async () => {
      // Setup user with failing session destroy
      app = express();
      app.use(express.json());
      app.use((req: any, res, next) => {
        req.user = { id: 'user123', email: 'test@example.com' };
        req.session = {
          destroy: (callback: (err?: any) => void) => {
            callback(new Error('Session destroy failed'));
          }
        };
        req.logout = (callback: (err?: any) => void) => {
          req.user = undefined;
          callback();
        };
        next();
      });
      app.use('/auth', authRoutes);

      const response = await request(app).post('/auth/logout');

      expect(response.status).toBe(200); // Still returns success
      expect(response.body).toEqual({ success: true });
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Session destruction error:',
        expect.any(Error)
      );
      expect(mockLoggerInfo).toHaveBeenCalledWith('User logged out: test@example.com');
    });

    it('should logout user without email', async () => {
      // Setup user without email
      app = express();
      app.use(express.json());
      app.use((req: any, res, next) => {
        req.user = { id: 'user123' };
        req.session = {
          destroy: (callback: (err?: any) => void) => {
            callback();
          }
        };
        req.logout = (callback: (err?: any) => void) => {
          req.user = undefined;
          callback();
        };
        next();
      });
      app.use('/auth', authRoutes);

      const response = await request(app).post('/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(mockLoggerInfo).toHaveBeenCalledWith('User logged out: undefined');
    });
  });

  describe('GET /auth/me', () => {
    it('should return null user when auth is disabled', async () => {
      mockIsAuthEnabled.mockReturnValue(false);

      const response = await request(app).get('/auth/me');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        user: null,
        authEnabled: false
      });
    });

    it('should return 401 when user not authenticated', async () => {
      mockIsAuthEnabled.mockReturnValue(true);

      const response = await request(app).get('/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Not authenticated' });
    });

    it('should return user data when authenticated', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        displayName: 'Test User',
        provider: 'microsoft'
      };

      // Setup authenticated user
      app = express();
      app.use((req: any, res, next) => {
        req.user = mockUser;
        next();
      });
      app.use('/auth', authRoutes);

      const response = await request(app).get('/auth/me');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        user: mockUser,
        authEnabled: true
      });
    });

    it('should return user with minimal fields', async () => {
      const mockUser = {
        id: 'user456'
      };

      // Setup authenticated user with minimal data
      app = express();
      app.use((req: any, res, next) => {
        req.user = mockUser;
        next();
      });
      app.use('/auth', authRoutes);

      const response = await request(app).get('/auth/me');

      expect(response.status).toBe(200);
      expect(response.body.user).toEqual(mockUser);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing session object in logout', async () => {
      // Setup user without session
      app = express();
      app.use(express.json());
      app.use((req: any, res, next) => {
        req.user = { id: 'user123', email: 'test@example.com' };
        req.logout = (callback: (err?: any) => void) => {
          req.user = undefined;
          callback();
        };
        // No req.session - falls back to destroyAuthSession
        next();
      });
      app.use('/auth', authRoutes);

      const response = await request(app).post('/auth/logout');

      // Falls back to destroyAuthSession when req.session is unavailable
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    it('should handle undefined user in logout', async () => {
      // Setup without user
      app = express();
      app.use(express.json());
      app.use((req: any, res, next) => {
        req.session = {
          destroy: (callback: (err?: any) => void) => {
            callback();
          }
        };
        req.logout = (callback: (err?: any) => void) => {
          callback();
        };
        next();
      });
      app.use('/auth', authRoutes);

      const response = await request(app).post('/auth/logout');

      expect(response.status).toBe(200);
      expect(mockLoggerInfo).toHaveBeenCalledWith('User logged out: undefined');
    });
  });
});
