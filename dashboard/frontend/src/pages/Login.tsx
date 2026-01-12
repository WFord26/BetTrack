import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { user, authEnabled, providers, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';
  const errorParam = searchParams.get('error');

  useEffect(() => {
    // If auth is disabled, redirect to dashboard
    if (!authEnabled && !loading) {
      navigate(from, { replace: true });
    }

    // If user is already logged in, redirect
    if (user && !loading) {
      navigate(from, { replace: true });
    }

    // Handle OAuth error from URL
    if (errorParam) {
      setError(getErrorMessage(errorParam));
    }
  }, [user, authEnabled, loading, from, navigate, errorParam]);

  const getErrorMessage = (error: string): string => {
    const messages: Record<string, string> = {
      microsoft_auth_failed: 'Microsoft authentication failed. Please try again.',
      google_auth_failed: 'Google authentication failed. Please try again.',
      no_email: 'Unable to retrieve email from provider. Please try a different account.',
      duplicate_email: 'An account with this email already exists with a different provider.'
    };
    return messages[error] || 'Authentication failed. Please try again.';
  };

  const handleLogin = (provider: 'microsoft' | 'google') => {
    // This will redirect to the backend OAuth flow
    window.location.href = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/auth/${provider}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Logo/Title */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            🎲 Sports Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track your sports bets and analyze performance
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-6">
            Sign in to continue
          </h2>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}

          {/* Login Buttons */}
          <div className="space-y-3">
            {providers.microsoft && (
              <button
                onClick={() => handleLogin('microsoft')}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 23 23" fill="none">
                  <path d="M0 0h10.92v10.92H0V0z" fill="#f25022"/>
                  <path d="M12.08 0H23v10.92H12.08V0z" fill="#00a4ef"/>
                  <path d="M0 12.08h10.92V23H0V12.08z" fill="#7fba00"/>
                  <path d="M12.08 12.08H23V23H12.08V12.08z" fill="#ffb900"/>
                </svg>
                Sign in with Microsoft
              </button>
            )}

            {providers.google && (
              <button
                onClick={() => handleLogin('google')}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>
            )}

            {!providers.microsoft && !providers.google && (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No authentication providers configured
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">
                  Contact your administrator to set up OAuth2
                </p>
              </div>
            )}
          </div>

          {/* Help Text */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          <p>Need help? Check the{' '}
            <a href="/docs/auth" className="text-blue-600 dark:text-blue-400 hover:underline">
              authentication setup guide
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
