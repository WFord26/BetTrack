/**
 * Tests for the Admin Settings page.
 *
 * Two things here have real consequences and so get real assertions: the
 * admin gate (single-user mode grants access; an authenticated non-admin does
 * not), and the save/sync handlers, which trim their inputs, collapse empties
 * to null, and translate an 'all' sport selection into an omitted filter.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../contexts/AuthContext';
import AdminSettings from './AdminSettings';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    defaults: { baseURL: 'http://localhost:3001/api' },
  },
}));

import api from '../services/api';
const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
};

const SITE_CONFIG = {
  id: 1,
  siteName: 'BetTrack',
  logoUrl: 'https://cdn.example.com/logo.png',
  domainUrl: 'https://bets.example.com',
};

const SPORTS = [
  { key: 'basketball_nba', name: 'NBA Basketball', isActive: true },
  { key: 'americanfootball_nfl', name: 'NFL', isActive: true },
];

/**
 * Routes each GET the page makes on mount: `/auth/status` for the admin gate,
 * then the two admin endpoints.
 */
function routeGets({
  authEnabled = false,
  user = null as Record<string, unknown> | null,
  siteConfig = SITE_CONFIG as unknown,
  sports = SPORTS as unknown,
  siteConfigError = null as unknown,
} = {}) {
  mockApi.get.mockImplementation((path: string) => {
    if (path === '/auth/status') {
      return Promise.resolve({
        data: {
          authEnabled,
          authMode: authEnabled ? 'oauth2' : 'none',
          user,
          providers: { microsoft: authEnabled, google: authEnabled },
        },
      });
    }
    if (path === '/admin/site-config') {
      return siteConfigError
        ? Promise.reject(siteConfigError)
        : Promise.resolve({ data: { data: siteConfig } });
    }
    if (path === '/admin/sports') {
      return Promise.resolve({ data: { data: sports } });
    }
    return Promise.reject(new Error(`Unexpected GET ${path}`));
  });
}

function renderPage() {
  return render(
    <AuthProvider>
      <AdminSettings />
    </AuthProvider>
  );
}

describe('AdminSettings page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeGets();
    mockApi.put.mockResolvedValue({ data: { data: SITE_CONFIG } });
    mockApi.post.mockResolvedValue({ data: { data: [] } });
  });

  describe('access control', () => {
    it('grants access in single-user mode, where auth is disabled', async () => {
      routeGets({ authEnabled: false, user: null });

      renderPage();

      expect(await screen.findByLabelText('Site Name')).toBeInTheDocument();
      expect(screen.queryByText(/Access denied/)).not.toBeInTheDocument();
    });

    it('grants access to an authenticated admin', async () => {
      routeGets({
        authEnabled: true,
        user: { id: 'u1', email: 'will@example.com', provider: 'google', isAdmin: true },
      });

      renderPage();

      expect(await screen.findByLabelText('Site Name')).toBeInTheDocument();
    });

    it('denies a signed-in user without the admin flag', async () => {
      routeGets({
        authEnabled: true,
        user: { id: 'u2', email: 'guest@example.com', provider: 'google', isAdmin: false },
      });

      renderPage();

      expect(await screen.findByText('Access denied. Admin privileges required.')).toBeInTheDocument();
      expect(screen.queryByLabelText('Site Name')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Sync Odds' })).not.toBeInTheDocument();
    });

    it('does not leak config into the denied view even though it was fetched', async () => {
      // `hasAdminAccess` reads authEnabled, which is false for the first render
      // while /auth/status is still in flight, so the config request goes out
      // before the gate closes. The backend authorises it independently; what
      // matters here is that nothing fetched reaches the screen.
      routeGets({
        authEnabled: true,
        user: { id: 'u2', email: 'guest@example.com', provider: 'google', isAdmin: false },
      });

      renderPage();

      await screen.findByText('Access denied. Admin privileges required.');
      expect(screen.queryByDisplayValue('BetTrack')).not.toBeInTheDocument();
      expect(screen.queryByText('https://bets.example.com')).not.toBeInTheDocument();
    });
  });

  describe('site configuration', () => {
    it('populates the form from the saved config', async () => {
      renderPage();

      expect(await screen.findByLabelText('Site Name')).toHaveValue('BetTrack');
      expect(screen.getByLabelText('Logo URL')).toHaveValue('https://cdn.example.com/logo.png');
      expect(screen.getByLabelText('Domain URL')).toHaveValue('https://bets.example.com');
    });

    it('falls back to the default site name and blank URLs when unset', async () => {
      routeGets({ siteConfig: { id: 1, siteName: '', logoUrl: null, domainUrl: null } });

      renderPage();

      expect(await screen.findByLabelText('Site Name')).toHaveValue('Sports Betting');
      expect(screen.getByLabelText('Logo URL')).toHaveValue('');
      expect(screen.getByLabelText('Domain URL')).toHaveValue('');
    });

    it('reports a load failure', async () => {
      routeGets({
        siteConfigError: { response: { data: { message: 'Database unreachable' } } },
      });

      renderPage();

      expect(await screen.findByText('Database unreachable')).toBeInTheDocument();
    });

    it('trims whitespace and confirms the save', async () => {
      const user = userEvent.setup();
      renderPage();

      const siteName = await screen.findByLabelText('Site Name');
      await user.clear(siteName);
      await user.type(siteName, '  Sharp Tracker  ');
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() =>
        expect(mockApi.put).toHaveBeenCalledWith('/admin/site-config', {
          siteName: 'Sharp Tracker',
          logoUrl: 'https://cdn.example.com/logo.png',
          domainUrl: 'https://bets.example.com',
        })
      );
      expect(
        await screen.findByText('Site configuration updated successfully!')
      ).toBeInTheDocument();
    });

    it('sends null rather than an empty string for a cleared URL', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.clear(await screen.findByLabelText('Logo URL'));
      await user.clear(screen.getByLabelText('Domain URL'));
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() =>
        expect(mockApi.put).toHaveBeenCalledWith(
          '/admin/site-config',
          expect.objectContaining({ logoUrl: null, domainUrl: null })
        )
      );
    });

    it('reports a save failure and leaves the form as typed', async () => {
      const user = userEvent.setup();
      mockApi.put.mockRejectedValue({
        response: { data: { message: 'Site name already in use' } },
      });
      renderPage();

      const siteName = await screen.findByLabelText('Site Name');
      await user.clear(siteName);
      await user.type(siteName, 'Duplicate');
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      expect(await screen.findByText('Site name already in use')).toBeInTheDocument();
      expect(screen.getByLabelText('Site Name')).toHaveValue('Duplicate');
    });

    it('restores the saved values when Reset is pressed', async () => {
      const user = userEvent.setup();
      renderPage();

      const siteName = await screen.findByLabelText('Site Name');
      await user.clear(siteName);
      await user.type(siteName, 'Scratch');
      await user.click(screen.getByRole('button', { name: 'Reset' }));

      await waitFor(() => expect(screen.getByLabelText('Site Name')).toHaveValue('BetTrack'));
    });
  });

  describe('data sync', () => {
    it('offers every sport the backend reported, plus an all-sports option', async () => {
      renderPage();

      const select = (await screen.findByLabelText('Sport')) as HTMLSelectElement;
      expect(Array.from(select.options).map((o) => o.value)).toEqual([
        'all',
        'basketball_nba',
        'americanfootball_nfl',
      ]);
      expect(select).toHaveValue('all');
    });

    it('leaves the selector usable when the sports request fails', async () => {
      mockApi.get.mockImplementation((path: string) => {
        if (path === '/auth/status') {
          return Promise.resolve({
            data: {
              authEnabled: false,
              authMode: 'none',
              user: null,
              providers: { microsoft: false, google: false },
            },
          });
        }
        if (path === '/admin/site-config') return Promise.resolve({ data: { data: SITE_CONFIG } });
        return Promise.reject(new Error('sports table missing'));
      });

      renderPage();

      // A failed sports load is non-fatal: the page still renders with only
      // the all-sports option.
      const select = (await screen.findByLabelText('Sport')) as HTMLSelectElement;
      expect(Array.from(select.options).map((o) => o.value)).toEqual(['all']);
      expect(screen.queryByText(/Failed to load configuration/)).not.toBeInTheDocument();
    });

    it('initializes sports and reports how many were created', async () => {
      const user = userEvent.setup();
      mockApi.post.mockResolvedValue({ data: { data: [{ key: 'a' }, { key: 'b' }, { key: 'c' }] } });
      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Initialize Sports' }));

      expect(mockApi.post).toHaveBeenCalledWith('/admin/init-sports');
      expect(await screen.findByText('3 sports initialized.')).toBeInTheDocument();
    });

    it('counts zero when the init response carries no list', async () => {
      const user = userEvent.setup();
      mockApi.post.mockResolvedValue({ data: {} });
      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Initialize Sports' }));

      expect(await screen.findByText('0 sports initialized.')).toBeInTheDocument();
    });

    it('reports an init failure', async () => {
      const user = userEvent.setup();
      mockApi.post.mockRejectedValue({
        response: { data: { message: 'Odds API key is missing' } },
      });
      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Initialize Sports' }));

      expect(await screen.findByText('Odds API key is missing')).toBeInTheDocument();
    });

    it('omits the sport filter when syncing all sports', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Sync Odds' }));

      expect(mockApi.post).toHaveBeenCalledWith('/admin/sync-odds', { sportKey: undefined });
      expect(
        await screen.findByText('Sync started in background. Games will appear shortly.')
      ).toBeInTheDocument();
    });

    it('sends the chosen sport key when one is selected', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.selectOptions(await screen.findByLabelText('Sport'), 'basketball_nba');
      await user.click(screen.getByRole('button', { name: 'Sync Odds' }));

      expect(mockApi.post).toHaveBeenCalledWith('/admin/sync-odds', {
        sportKey: 'basketball_nba',
      });
    });

    it('reports a sync failure', async () => {
      const user = userEvent.setup();
      mockApi.post.mockRejectedValue({
        response: { data: { message: 'Sync already running' } },
      });
      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Sync Odds' }));

      expect(await screen.findByText('Sync already running')).toBeInTheDocument();
    });
  });
});
