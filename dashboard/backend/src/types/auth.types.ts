export type AuthProvider = 'google' | 'microsoft';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  provider: string;
  isAdmin: boolean;
  isActive: boolean;
}

export interface AuthSession {
  id: string;
  userId?: string;
  oauthState?: string;
  oauthProvider?: AuthProvider;
  redirectPath?: string;
  expiresAt: number;
}
