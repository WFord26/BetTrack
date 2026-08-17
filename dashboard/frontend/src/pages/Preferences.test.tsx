/**
 * Tests for the Preferences page.
 *
 * Wrapped in a real PreferencesProvider (not mocked) so localStorage
 * persistence is actually exercised end to end. The stake input has a real
 * validation rule worth pinning down — it only accepts `/^\d*\.?\d*$/` and
 * silently ignores negative/NaN input rather than clearing the field — and
 * the "Saved" indicator is a transient bit of local state that appears on
 * any change and clears itself after 2 seconds.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import Preferences from './Preferences';

function renderPage() {
  return render(
    <PreferencesProvider>
      <Preferences />
    </PreferencesProvider>
  );
}

describe('Preferences page', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts from the documented defaults', () => {
    renderPage();

    expect(screen.getByLabelText('Odds format selection')).toHaveValue('american');
    expect(screen.getByLabelText('Default sport selection')).toHaveValue('all');
    expect(screen.getByLabelText('Default stake amount')).toHaveValue('100');
  });

  it('changes and persists the odds format', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByLabelText('Odds format selection'), 'decimal');

    expect(screen.getByLabelText('Odds format selection')).toHaveValue('decimal');
    expect(JSON.parse(localStorage.getItem('userPreferences')!).oddsFormat).toBe('decimal');
  });

  it('changes and persists the default sport', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByLabelText('Default sport selection'), 'americanfootball_nfl');

    expect(JSON.parse(localStorage.getItem('userPreferences')!).defaultSport).toBe(
      'americanfootball_nfl'
    );
  });

  describe('default stake input', () => {
    it('accepts a well-formed decimal amount set in a single change', () => {
      // The input is value-bound to the *numeric* preference, so a decimal
      // survives only when it arrives as one atomic change (paste-like) —
      // Number(250.5) round-trips through the DOM as "250.5".
      renderPage();

      fireEvent.change(screen.getByLabelText('Default stake amount'), {
        target: { value: '250.5' },
      });

      expect(screen.getByLabelText('Default stake amount')).toHaveValue('250.5');
      expect(JSON.parse(localStorage.getItem('userPreferences')!).defaultStake).toBe(250.5);
    });

    it('drops a decimal point typed key-by-key, since the value round-trips through a number', async () => {
      // Typing "." makes the string "250." pass the regex and parse to 250,
      // but re-rendering with value={250} collapses back to "250" — so the
      // next digit lands after the truncated integer, not after a dot.
      const user = userEvent.setup();
      renderPage();

      const input = screen.getByLabelText('Default stake amount');
      await user.clear(input);
      await user.type(input, '250.5');

      expect(input).toHaveValue('2505');
    });

    it('clears to zero when the field is emptied', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.clear(screen.getByLabelText('Default stake amount'));

      expect(JSON.parse(localStorage.getItem('userPreferences')!).defaultStake).toBe(0);
    });

    it('rejects a non-numeric character rather than accepting it', async () => {
      const user = userEvent.setup();
      renderPage();

      const input = screen.getByLabelText('Default stake amount');
      await user.clear(input);
      await user.type(input, '12a3');

      // 'a' fails the /^\d*\.?\d*$/ test, so that keystroke is dropped.
      expect(input).toHaveValue('123');
    });

    it('rejects a leading minus sign', async () => {
      const user = userEvent.setup();
      renderPage();

      const input = screen.getByLabelText('Default stake amount');
      await user.clear(input);
      await user.type(input, '-50');

      expect(input).toHaveValue('50');
    });
  });

  describe('saved indicator', () => {
    it('appears after a change and disappears after two seconds', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPage();

      await user.selectOptions(screen.getByLabelText('Odds format selection'), 'decimal');

      expect(screen.getByText('Saved')).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    });
  });

  it('leaves the preferred-bookmakers control disabled as a coming-soon feature', () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Configure' })).toBeDisabled();
  });
});
