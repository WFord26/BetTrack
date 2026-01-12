import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  provider: string;
  isAdmin?: boolean;
}

interface AuthStatus {
  authEnabled: boolean;
  authMode: string;
  user: User | null;
  providers: {
    microsoft: boolean;
    google: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  authEnabled: boolean;
  authMode: string;
  providers: {
    microsoft: boolean;
    google: boolean;
  };
  loading: boolean;
  login: (provider: 'microsoft' | 'google') => void;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [authMode, setAuthMode] = useState('none');
  const [providers, setProviders] = useState({ microsoft: false, google: false });
  const [loading, setLoading] = useState(true);

  const fetchAuthStatus = async () => {
    try {
      // Auth disabled in standalone mode
      setAuthEnabled(false);
      setAuthMode('none');
      setUser(null);
      setProviders([]);
    } catch (error) {
      console.error('Failed to fetch auth status:', error);
      // Default to no auth
      setAuthEnabled(false);
      setAuthMode('none');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthStatus();
  }, []);

  const login = (provider: 'microsoft' | 'google') => {
    // Redirect to OAuth provider
    window.location.href = `${api.defaults.baseURL}/auth/${provider}`;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
      setUser(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const refreshAuth = async () => {
    await fetchAuthStatus();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authEnabled,
        authMode,
        providers,
        loading,
        login,
        logout,
        refreshAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
