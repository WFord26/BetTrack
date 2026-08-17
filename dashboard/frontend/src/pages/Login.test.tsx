/**
 * Tests for the Login page.
 *
 * Login has no local data of its own — everything it renders is driven by
 * `/auth/status`, the `?error=` query param, and the `location.state.from`
 * that ProtectedRoute attaches when it bounces an unauthenticated user. Each
 * test therefore sets up one of those inputs and asserts on what the user
 * actually sees, or on the OAuth URL the page sends them to.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import Login from './Login';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    defaults: { baseURL: 'http://localhost:3001/api' },
  },
}));

import api from '../services/api';
const mockApi = api as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

/** The `/auth/status` payload AuthContext expects, with both providers on. */
function authStatus(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      authEnabled: true,
      authMode: 'oauth2',
      user: null,
      providers: { microsoft: true, google: true },
      ...overrides,
    },
  };
}

/**
 * Renders Login at `entry`. The catch-all route lets a redirect away from
 * /login be observed as rendered text instead of a spy on navigate().
 */
function renderLogin(entry: string | { pathname: string; state?: unknown } = '/login') {
  return render(
    <MemoryRouter initialEntries={[entry as never]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<div>redirected to {location.pathname}</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Login page', () => {
  let assignedHref = '';

  beforeEach(() => {
    vi.clearAllMocks();
    assignedHref = '';
    // login() navigates by assigning window.location.href, which jsdom refuses
    // to implement; capture the URL instead so it can be asserted on.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        set href(value: string) {
          assignedHref = value;
        },
        get href() {
          return assignedHref;
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state until the auth status resolves', async () => {
    let resolveStatus: (value: unknown) => void = () => {};
    mockApi.get.mockReturnValue(
      new Promise((resolve) => {
        resolveStatus = resolve;
      })
    );

    renderLogin();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    resolveStatus(authStatus());
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
  });

  it('renders a sign-in button for each configured provider', async () => {
    mockApi.get.mockResolvedValue(authStatus());

    renderLogin();

    expect(
      await screen.findByRole('button', { name: /sign in with microsoft/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /sign in to continue/i })).toBeInTheDocument();
  });

  it('offers only the providers that are actually enabled', async () => {
    mockApi.get.mockResolvedValue(authStatus({ providers: { microsoft: false, google: true } }));

    renderLogin();

    expect(await screen.findByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in with microsoft/i })).not.toBeInTheDocument();
  });

  it('explains the situation when no provider is configured', async () => {
    mockApi.get.mockResolvedValue(
      authStatus({ providers: { microsoft: false, google: false } })
    );

    renderLogin();

    expect(await screen.findByText('No authentication providers configured')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in with/i })).not.toBeInTheDocument();
  });

  it('sends the user to the provider OAuth URL, defaulting the redirect to /', async () => {
    mockApi.get.mockResolvedValue(authStatus());
    const user = userEvent.setup();

    renderLogin();
    await user.click(await screen.findByRole('button', { name: /sign in with microsoft/i }));

    expect(assignedHref).toBe(
      'http://localhost:3001/api/auth/microsoft?redirectTo=%2F'
    );
  });

  it('preserves the page the user was bounced from as the redirect target', async () => {
    mockApi.get.mockResolvedValue(authStatus());
    const user = userEvent.setup();

    renderLogin({
      pathname: '/login',
      state: { from: { pathname: '/analytics/clv', search: '?period=month' } },
    });
    await user.click(await screen.findByRole('button', { name: /sign in with google/i }));

    expect(assignedHref).toBe(
      'http://localhost:3001/api/auth/google?redirectTo=%2Fanalytics%2Fclv%3Fperiod%3Dmonth'
    );
  });

  it('translates a known OAuth error code into a readable message', async () => {
    mockApi.get.mockResolvedValue(authStatus());

    renderLogin('/login?error=microsoft_auth_failed');

    expect(
      await screen.findByText('Microsoft authentication failed. Please try again.')
    ).toBeInTheDocument();
  });

  it('names the conflict for a duplicate-email failure', async () => {
    mockApi.get.mockResolvedValue(authStatus());

    renderLogin('/login?error=duplicate_email');

    expect(
      await screen.findByText(
        'An account with this email already exists with a different provider.'
      )
    ).toBeInTheDocument();
  });

  it('falls back to a generic message for an unrecognised error code', async () => {
    mockApi.get.mockResolvedValue(authStatus());

    renderLogin('/login?error=something_unexpected');

    expect(
      await screen.findByText('Authentication failed. Please try again.')
    ).toBeInTheDocument();
  });

  it('shows no error banner on a clean load', async () => {
    mockApi.get.mockResolvedValue(authStatus());

    renderLogin();

    await screen.findByRole('button', { name: /sign in with microsoft/i });
    expect(screen.queryByText(/authentication failed/i)).not.toBeInTheDocument();
  });

  it('redirects away instead of prompting when a user is already signed in', async () => {
    mockApi.get.mockResolvedValue(
      authStatus({ user: { id: 'u1', email: 'will@example.com', provider: 'google' } })
    );

    renderLogin();

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /sign in with/i })).not.toBeInTheDocument()
    );
    expect(screen.getByText(/redirected to/)).toBeInTheDocument();
  });

  it('redirects away when authentication is disabled entirely', async () => {
    mockApi.get.mockResolvedValue(authStatus({ authEnabled: false, authMode: 'none' }));

    renderLogin();

    await waitFor(() => expect(screen.getByText(/redirected to/)).toBeInTheDocument());
  });

  it('treats a failed status request as auth-disabled and redirects', async () => {
    // AuthContext logs the failure; keep the expected noise out of the report.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi.get.mockRejectedValue(new Error('Network Error'));

    renderLogin();

    await waitFor(() => expect(screen.getByText(/redirected to/)).toBeInTheDocument());
  });
});
