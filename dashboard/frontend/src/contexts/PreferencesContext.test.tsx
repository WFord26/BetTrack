/**
 * Tests for PreferencesContext
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PreferencesProvider, usePreferences } from './PreferencesContext';

// Test component consuming the context
function PreferencesConsumer() {
  const { preferences, updatePreference, useDecimalOdds } = usePreferences();
  return (
    <div>
      <span data-testid="odds-format">{preferences.oddsFormat}</span>
      <span data-testid="decimal-flag">{useDecimalOdds ? 'decimal' : 'american'}</span>
      <span data-testid="default-sport">{preferences.defaultSport}</span>
      <span data-testid="default-stake">{preferences.defaultStake}</span>
      <button onClick={() => updatePreference('oddsFormat', 'decimal')}>Use Decimal</button>
      <button onClick={() => updatePreference('oddsFormat', 'american')}>Use American</button>
      <button onClick={() => updatePreference('defaultSport', 'basketball_nba')}>Set NBA</button>
      <button onClick={() => updatePreference('defaultStake', 50)}>Set Stake 50</button>
    </div>
  );
}

describe('PreferencesContext', () => {
  let getItemSpy: ReturnType<typeof vi.spyOn>;
  let setItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses default preferences when nothing is saved', () => {
    getItemSpy.mockReturnValue(null);

    render(
      <PreferencesProvider>
        <PreferencesConsumer />
      </PreferencesProvider>
    );

    expect(screen.getByTestId('odds-format')).toHaveTextContent('american');
    expect(screen.getByTestId('default-sport')).toHaveTextContent('all');
    expect(screen.getByTestId('default-stake')).toHaveTextContent('100');
  });

  it('loads preferences from localStorage', () => {
    getItemSpy.mockImplementation((key: string) =>
      key === 'userPreferences'
        ? JSON.stringify({ oddsFormat: 'decimal', defaultSport: 'basketball_nba', defaultStake: 25, preferredBookmakers: [] })
        : null
    );

    render(
      <PreferencesProvider>
        <PreferencesConsumer />
      </PreferencesProvider>
    );

    expect(screen.getByTestId('odds-format')).toHaveTextContent('decimal');
    expect(screen.getByTestId('default-sport')).toHaveTextContent('basketball_nba');
    expect(screen.getByTestId('default-stake')).toHaveTextContent('25');
  });

  it('falls back to defaults when localStorage contains invalid JSON', () => {
    getItemSpy.mockImplementation((key: string) =>
      key === 'userPreferences' ? 'invalid-json' : null
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <PreferencesProvider>
        <PreferencesConsumer />
      </PreferencesProvider>
    );

    expect(screen.getByTestId('odds-format')).toHaveTextContent('american');
    consoleSpy.mockRestore();
  });

  it('updates odds format preference', () => {
    render(
      <PreferencesProvider>
        <PreferencesConsumer />
      </PreferencesProvider>
    );

    act(() => {
      fireEvent.click(screen.getByText('Use Decimal'));
    });

    expect(screen.getByTestId('odds-format')).toHaveTextContent('decimal');
  });

  it('sets useDecimalOdds to true when oddsFormat is decimal', () => {
    render(
      <PreferencesProvider>
        <PreferencesConsumer />
      </PreferencesProvider>
    );

    act(() => {
      fireEvent.click(screen.getByText('Use Decimal'));
    });

    expect(screen.getByTestId('decimal-flag')).toHaveTextContent('decimal');
  });

  it('sets useDecimalOdds to false when oddsFormat is american', () => {
    render(
      <PreferencesProvider>
        <PreferencesConsumer />
      </PreferencesProvider>
    );

    act(() => {
      fireEvent.click(screen.getByText('Use American'));
    });

    expect(screen.getByTestId('decimal-flag')).toHaveTextContent('american');
  });

  it('persists updated preference to localStorage', () => {
    render(
      <PreferencesProvider>
        <PreferencesConsumer />
      </PreferencesProvider>
    );

    act(() => {
      fireEvent.click(screen.getByText('Set NBA'));
    });

    expect(setItemSpy).toHaveBeenCalledWith(
      'userPreferences',
      expect.stringContaining('basketball_nba')
    );
  });

  it('updates default stake preference', () => {
    render(
      <PreferencesProvider>
        <PreferencesConsumer />
      </PreferencesProvider>
    );

    act(() => {
      fireEvent.click(screen.getByText('Set Stake 50'));
    });

    expect(screen.getByTestId('default-stake')).toHaveTextContent('50');
  });

  it('throws when usePreferences is used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<PreferencesConsumer />);
    }).toThrow();

    spy.mockRestore();
  });
});
