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
  /** The validated frontend origin that initiated the OAuth flow.
   *  Stored during beginOAuth so the callback can redirect back to the
   *  correct host in multi-origin / preview-environment deployments. */
  frontendOrigin?: string;
  expiresAt: number;
}
