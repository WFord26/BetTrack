/**
 * Tests for ProtectedRoute component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/test-utils';
import ProtectedRoute from './ProtectedRoute';

// Mock the useAuth hook
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../contexts/AuthContext';

const mockUseAuth = vi.mocked(useAuth);

const baseAuth = {
  providers: { microsoft: false, google: false },
  authMode: 'oauth2',
  login: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
  refreshAuth: vi.fn().mockResolvedValue(undefined),
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner while auth is loading', () => {
    mockUseAuth.mockReturnValue({
      ...baseAuth,
      user: null,
      authEnabled: true,
      loading: true,
    });

    renderWithProviders(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders children when auth is disabled', () => {
    mockUseAuth.mockReturnValue({
      ...baseAuth,
      user: null,
      authEnabled: false,
      authMode: 'none',
      loading: false,
    });

    renderWithProviders(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      ...baseAuth,
      user: { id: '1', email: 'user@test.com', provider: 'google' },
      authEnabled: true,
      loading: false,
    });

    renderWithProviders(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('redirects to login when auth is enabled and user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      ...baseAuth,
      user: null,
      authEnabled: true,
      loading: false,
    });

    renderWithProviders(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>
    );

    // Content should not be rendered - user is redirected to /login
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
});

