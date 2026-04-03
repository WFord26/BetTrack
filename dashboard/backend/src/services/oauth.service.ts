import axios from 'axios';
import { prisma } from '../config/database';
import { env } from '../config/env';
import type { AuthProvider, AuthenticatedUser } from '../types/auth.types';

class OAuthError extends Error {
  constructor(
    public readonly redirectError: string,
    message: string
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

interface OAuthProfile {
  email: string;
  name?: string;
  avatarUrl?: string;
  providerId: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildCallbackUrl(provider: AuthProvider): string {
  return new URL(`/api/auth/${provider}/callback`, env.BASE_URL).toString();
}

function allowedOrigins(): string[] {
  return (env.CORS_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function firstAllowedOrigin(): string | null {
  return allowedOrigins()[0] || null;
}

function deriveFrontendOriginFromBaseUrl(): string {
  try {
    const baseUrl = new URL(env.BASE_URL);

    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(baseUrl.hostname)) {
      return 'http://localhost:5173';
    }

    if (baseUrl.hostname.startsWith('api.')) {
      return `${baseUrl.protocol}//${baseUrl.hostname.slice(4)}`;
    }

    return `${baseUrl.protocol}//${baseUrl.host}`;
  } catch {
    return 'http://localhost:5173';
  }
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

export class OAuthService {
  isProviderConfigured(provider: AuthProvider): boolean {
    if (provider === 'google') {
      return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
    }

    return Boolean(
      env.MICROSOFT_CLIENT_ID &&
      env.MICROSOFT_CLIENT_SECRET &&
      env.MICROSOFT_TENANT_ID
    );
  }

  getAvailableProviders() {
    return {
      microsoft: this.isProviderConfigured('microsoft'),
      google: this.isProviderConfigured('google'),
    };
  }

  getFrontendOrigin(): string {
    return firstAllowedOrigin() || deriveFrontendOriginFromBaseUrl();
  }

  buildFrontendRedirect(path: string): string {
    return new URL(path, this.getFrontendOrigin()).toString();
  }

  buildAuthorizationUrl(provider: AuthProvider, state: string): string {
    if (provider === 'google') {
      const params = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID || '',
        redirect_uri: buildCallbackUrl(provider),
        response_type: 'code',
        scope: 'openid profile email',
        state,
        access_type: 'online',
        prompt: 'select_account',
      });

      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    const params = new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID || '',
      redirect_uri: buildCallbackUrl(provider),
      response_type: 'code',
      scope: 'openid profile email User.Read',
      state,
      response_mode: 'query',
      prompt: 'select_account',
    });

    return `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async authenticate(provider: AuthProvider, code: string): Promise<AuthenticatedUser> {
    const profile = provider === 'google'
      ? await this.fetchGoogleProfile(code)
      : await this.fetchMicrosoftProfile(code);

    if (!profile.email) {
      throw new OAuthError('no_email', 'OAuth provider did not return an email address');
    }

    const email = normalizeEmail(profile.email);

    const existingUser = await prisma.user.findFirst({
      where: {
        provider,
        providerId: profile.providerId,
      },
    });

    const existingUserByEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (
      existingUserByEmail &&
      existingUserByEmail.provider !== provider &&
      existingUserByEmail.id !== existingUser?.id
    ) {
      throw new OAuthError(
        'duplicate_email',
        `Email ${email} is already registered with ${existingUserByEmail.provider}`
      );
    }

    const userToUpdate = existingUser || existingUserByEmail;

    const user = userToUpdate
      ? await prisma.user.update({
          where: { id: userToUpdate.id },
          data: {
            email,
            name: profile.name || userToUpdate.name,
            avatarUrl: profile.avatarUrl || userToUpdate.avatarUrl,
            provider,
            providerId: profile.providerId,
            lastLoginAt: new Date(),
          },
        })
      : await prisma.user.create({
          data: {
            email,
            name: profile.name || null,
            avatarUrl: profile.avatarUrl || null,
            provider,
            providerId: profile.providerId,
            lastLoginAt: new Date(),
          },
        });

    if (!user.isActive) {
      throw new OAuthError(
        `${provider}_auth_failed`,
        `User account ${email} is inactive`
      );
    }

    return normalizeUser(user);
  }

  private async fetchGoogleProfile(code: string): Promise<OAuthProfile> {
    const tokenParams = new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID || '',
      client_secret: env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: buildCallbackUrl('google'),
      grant_type: 'authorization_code',
    });

    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      tokenParams.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const accessToken = tokenResponse.data.access_token as string | undefined;

    if (!accessToken) {
      throw new OAuthError('google_auth_failed', 'Google did not return an access token');
    }

    const userInfoResponse = await axios.get('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const profile = userInfoResponse.data;

    return {
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture,
      providerId: profile.sub,
    };
  }

  private async fetchMicrosoftProfile(code: string): Promise<OAuthProfile> {
    const tokenParams = new URLSearchParams({
      code,
      client_id: env.MICROSOFT_CLIENT_ID || '',
      client_secret: env.MICROSOFT_CLIENT_SECRET || '',
      redirect_uri: buildCallbackUrl('microsoft'),
      grant_type: 'authorization_code',
      scope: 'openid profile email User.Read',
    });

    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
      tokenParams.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const accessToken = tokenResponse.data.access_token as string | undefined;

    if (!accessToken) {
      throw new OAuthError('microsoft_auth_failed', 'Microsoft did not return an access token');
    }

    const profileResponse = await axios.get(
      'https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const profile = profileResponse.data;
    const email = profile.mail || profile.userPrincipalName;

    return {
      email,
      name: profile.displayName,
      providerId: profile.id,
    };
  }
}

export { OAuthError };
export const oauthService = new OAuthService();
