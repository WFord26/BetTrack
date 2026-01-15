import passport from 'passport';
import { Strategy as MicrosoftStrategy } from 'passport-azure-ad-oauth2';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from './database';
import { logger } from './logger';
import { env } from './env';
import jwt from 'jsonwebtoken';

interface OAuthProfile {
  id: string;
  displayName?: string;
  emails?: Array<{ value: string }>;
  photos?: Array<{ value: string }>;
  provider: string;
}

// Serialize user to session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Microsoft/Azure AD OAuth2 Strategy
if (env.AUTH_MODE === 'oauth2' && env.MICROSOFT_CLIENT_ID) {
  passport.use(
    new MicrosoftStrategy(
      {
        clientID: env.MICROSOFT_CLIENT_ID,
        clientSecret: env.MICROSOFT_CLIENT_SECRET!,
        callbackURL: `${env.BASE_URL}/api/auth/microsoft/callback`,
        tenant: env.MICROSOFT_TENANT_ID || 'common',
        resource: 'https://graph.microsoft.com/'
      },
      async (accessToken: string, refresh_token: string, params: any, profile: any, done: any) => {
        try {
          // Decode the id_token to get user info
          const idToken = params.id_token;
          const decodedToken: any = jwt.decode(idToken);

          const email = decodedToken.preferred_username || decodedToken.email || decodedToken.upn;
          const name = decodedToken.name;
          const providerId = decodedToken.oid || decodedToken.sub;

          if (!email) {
            return done(new Error('No email found in Microsoft profile'));
          }

          // Find or create user
          let user = await prisma.user.findUnique({
            where: {
              provider_providerId: {
                provider: 'microsoft',
                providerId
              }
            }
          });

          if (!user) {
            // Check if user exists with this email but different provider
            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
              logger.warn(`User ${email} already exists with provider ${existingUser.provider}`);
              return done(null, false, { message: 'Email already registered with different provider' });
            }

            // Create new user
            user = await prisma.user.create({
              data: {
                email,
                name,
                provider: 'microsoft',
                providerId,
                lastLoginAt: new Date()
              }
            });
            logger.info(`Created new user: ${email} (Microsoft)`);
          } else {
            // Update last login
            await prisma.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() }
            });
          }

          return done(null, user);
        } catch (error) {
          logger.error('Microsoft auth error:', error);
          return done(error);
        }
      }
    )
  );
}

// Google OAuth2 Strategy
if (env.AUTH_MODE === 'oauth2' && env.GOOGLE_CLIENT_ID) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET!,
        callbackURL: `${env.BASE_URL}/api/auth/google/callback`
      },
      async (accessToken: string, refreshToken: string, profile: OAuthProfile, done: any) => {
        try {
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName;
          const avatarUrl = profile.photos?.[0]?.value;
          const providerId = profile.id;

          if (!email) {
            return done(new Error('No email found in Google profile'));
          }

          // Find or create user
          let user = await prisma.user.findUnique({
            where: {
              provider_providerId: {
                provider: 'google',
                providerId
              }
            }
          });

          if (!user) {
            // Check if user exists with this email but different provider
            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
              logger.warn(`User ${email} already exists with provider ${existingUser.provider}`);
              return done(null, false, { message: 'Email already registered with different provider' });
            }

            // Create new user
            user = await prisma.user.create({
              data: {
                email,
                name,
                avatarUrl,
                provider: 'google',
                providerId,
                lastLoginAt: new Date()
              }
            });
            logger.info(`Created new user: ${email} (Google)`);
          } else {
            // Update last login and avatar
            await prisma.user.update({
              where: { id: user.id },
              data: { 
                lastLoginAt: new Date(),
                avatarUrl: avatarUrl || user.avatarUrl
              }
            });
          }

          return done(null, user);
        } catch (error) {
          logger.error('Google auth error:', error);
          return done(error);
        }
      }
    )
  );
}

export default passport;
