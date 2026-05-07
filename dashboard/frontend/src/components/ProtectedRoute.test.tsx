/**
 * Tests for ProtectedRoute component
 *
 * Note: We mock react-router-dom (Navigate + useLocation) to prevent jsdom's
 * browser-history integration from spinning up an infinite event-listener loop
 * that exhausts V8 heap memory. ProtectedRoute only uses Navigate + useLocation
 * from react-router-dom, so a lightweight mock is sufficient.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProtectedRoute from './ProtectedRoute';

// Stub react-router-dom before importing ProtectedRoute so jsdom never sets
// up popstate / history listeners.
vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => (
    <div data-testid="navigate-redirect" data-to={to} />
  ),
  useLocation: vi.fn(() => ({
    pathname: '/',
    search: '',
    hash: '',
    state: null,
    key: 'default',
  })),
}));

// Mock useAuth hook
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

    render(
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

    render(
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

    render(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('renders a redirect when auth is enabled and user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      ...baseAuth,
      user: null,
      authEnabled: true,
      loading: false,
    });

    render(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>
    );

    // Navigate stub is rendered; protected content is not shown
    expect(screen.getByTestId('navigate-redirect')).toBeInTheDocument();
    expect(screen.getByTestId('navigate-redirect')).toHaveAttribute('data-to', '/login');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
});

