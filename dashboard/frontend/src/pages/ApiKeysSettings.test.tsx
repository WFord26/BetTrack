/**
 * Tests for the API Keys settings page.
 *
 * Real behaviour worth locking down: the one-time key reveal (the plaintext
 * key only ever appears in the create-modal response, never in the list),
 * the confirm()-gated revoke flow, and the error surfaced from
 * `err.response?.data?.error` on each of the three endpoints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApiKeysSettings from './ApiKeysSettings';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    defaults: { baseURL: 'http://localhost:3001/api' },
  },
}));

import api from '../services/api';
const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const KEY_A = {
  id: 'key-1',
  name: 'Claude Bot',
  keyPrefix: 'btk_live_ab12',
  permissions: { read: true, write: false, bets: true, stats: true },
  lastUsedAt: '2026-01-10T12:00:00.000Z',
  expiresAt: null,
  revoked: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const KEY_B = {
  ...KEY_A,
  id: 'key-2',
  name: 'Old integration',
  revoked: true,
  lastUsedAt: null,
};

function withKeys(keys: typeof KEY_A[]) {
  mockApi.get.mockResolvedValue({ data: { data: { keys } } });
}

describe('ApiKeysSettings page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withKeys([]);
    vi.stubGlobal('confirm', vi.fn());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn() },
      configurable: true,
    });
  });

  describe('list states', () => {
    it('shows the empty state once loading resolves with no keys', async () => {
      render(<ApiKeysSettings />);

      expect(
        await screen.findByText('No API keys yet. Create one to get started.')
      ).toBeInTheDocument();
    });

    it('renders a row per key with prefix, dates and status badge', async () => {
      withKeys([KEY_A, KEY_B]);
      render(<ApiKeysSettings />);

      expect(await screen.findByText('Claude Bot')).toBeInTheDocument();
      expect(screen.getAllByText('btk_live_ab12')).toHaveLength(2);
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Revoked')).toBeInTheDocument();
      // Only the active key exposes a revoke action.
      expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(1);
      // A key that was never used renders 'Never' rather than a date.
      expect(screen.getByText('Never')).toBeInTheDocument();
    });

    it('surfaces the backend error message on a failed load', async () => {
      mockApi.get.mockRejectedValue({ response: { data: { error: 'Database unreachable' } } });
      render(<ApiKeysSettings />);

      expect(await screen.findByText('Database unreachable')).toBeInTheDocument();
    });
  });

  describe('creating a key', () => {
    it('requires a name before submitting', async () => {
      const user = userEvent.setup();
      render(<ApiKeysSettings />);

      await user.click(await screen.findByRole('button', { name: '+ Create New API Key' }));
      await user.click(screen.getByRole('button', { name: 'Create Key' }));

      expect(await screen.findByText('Key name is required')).toBeInTheDocument();
      expect(mockApi.post).not.toHaveBeenCalled();
    });

    it('trims the name, reveals the key once, and refreshes the list', async () => {
      const user = userEvent.setup();
      mockApi.post.mockResolvedValue({ data: { data: { key: 'btk_live_secret123' } } });
      render(<ApiKeysSettings />);

      await user.click(await screen.findByRole('button', { name: '+ Create New API Key' }));
      await user.type(screen.getByPlaceholderText('My Claude Bot'), '  Reporting Bot  ');
      await user.click(screen.getByRole('button', { name: 'Create Key' }));

      await waitFor(() =>
        expect(mockApi.post).toHaveBeenCalledWith('/keys', { name: 'Reporting Bot' })
      );
      expect(await screen.findByText('Save this key now! It will only be shown once.')).toBeInTheDocument();
      expect(screen.getByDisplayValue('btk_live_secret123')).toBeInTheDocument();
      // The list refetch that follows creation.
      expect(mockApi.get).toHaveBeenCalledTimes(2);
    });

    it('copies the revealed key to the clipboard', async () => {
      const user = userEvent.setup();
      mockApi.post.mockResolvedValue({ data: { data: { key: 'btk_live_secret123' } } });
      render(<ApiKeysSettings />);

      await user.click(await screen.findByRole('button', { name: '+ Create New API Key' }));
      await user.type(screen.getByPlaceholderText('My Claude Bot'), 'Bot');
      await user.click(screen.getByRole('button', { name: 'Create Key' }));
      await screen.findByDisplayValue('btk_live_secret123');

      // userEvent.setup() installs its own clipboard stub, so the write spy
      // has to be attached after setup rather than in beforeEach.
      const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
      await user.click(screen.getByRole('button', { name: 'Copy' }));

      expect(writeText).toHaveBeenCalledWith('btk_live_secret123');

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('btk_live_secret123');
      expect(await screen.findByRole('button', { name: '✓ Copied' })).toBeInTheDocument();
    });

    it('reports a create failure and keeps the form open', async () => {
      const user = userEvent.setup();
      mockApi.post.mockRejectedValue({ response: { data: { error: 'Key limit reached' } } });
      render(<ApiKeysSettings />);

      await user.click(await screen.findByRole('button', { name: '+ Create New API Key' }));
      await user.type(screen.getByPlaceholderText('My Claude Bot'), 'Bot');
      await user.click(screen.getByRole('button', { name: 'Create Key' }));

      expect(await screen.findByText('Key limit reached')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('My Claude Bot')).toBeInTheDocument();
    });

    it('resets the name and any error when the modal is cancelled', async () => {
      const user = userEvent.setup();
      render(<ApiKeysSettings />);

      await user.click(await screen.findByRole('button', { name: '+ Create New API Key' }));
      await user.click(screen.getByRole('button', { name: 'Create Key' }));
      await screen.findByText('Key name is required');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByText('Key name is required')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '+ Create New API Key' }));
      expect(screen.getByPlaceholderText('My Claude Bot')).toHaveValue('');
    });
  });

  describe('revoking a key', () => {
    it('does nothing when the confirmation dialog is declined', async () => {
      const user = userEvent.setup();
      withKeys([KEY_A]);
      vi.mocked(window.confirm).mockReturnValue(false);
      render(<ApiKeysSettings />);

      await user.click(await screen.findByRole('button', { name: 'Revoke' }));

      expect(mockApi.delete).not.toHaveBeenCalled();
    });

    it('revokes the key and refreshes the list on confirmation', async () => {
      const user = userEvent.setup();
      withKeys([KEY_A]);
      vi.mocked(window.confirm).mockReturnValue(true);
      mockApi.delete.mockResolvedValue({ data: {} });
      render(<ApiKeysSettings />);

      await user.click(await screen.findByRole('button', { name: 'Revoke' }));

      expect(mockApi.delete).toHaveBeenCalledWith('/keys/key-1');
      await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(2));
    });

    it('reports a revoke failure', async () => {
      const user = userEvent.setup();
      withKeys([KEY_A]);
      vi.mocked(window.confirm).mockReturnValue(true);
      mockApi.delete.mockRejectedValue({ response: { data: { error: 'Cannot revoke last key' } } });
      render(<ApiKeysSettings />);

      await user.click(await screen.findByRole('button', { name: 'Revoke' }));

      expect(await screen.findByText('Cannot revoke last key')).toBeInTheDocument();
    });
  });
});
