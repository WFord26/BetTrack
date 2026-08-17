/**
 * Tests for the Futures page.
 *
 * Real logic worth pinning down: the sport filter drives the `sportKey`
 * query param (and is omitted for "all"), outcomes within a future are
 * sorted best-odds-first, adding an outcome to the bet slip dispatches a
 * real `addFutureLeg` action with the fields the reducer expects, and Sync
 * re-fetches after a delay. apiClient is mocked directly (this page doesn't
 * go through a service module); betSlip uses the real reducer so the
 * dispatched action's effect on state can be asserted.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import betSlipReducer from '../store/betSlipSlice';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import { DarkModeProvider } from '../contexts/DarkModeContext';
import Futures from './Futures';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import apiClient from '../services/api';
const mockApi = apiClient as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

const NBA_TITLE_FUTURE = {
  id: 'fut-1',
  title: 'NBA Championship',
  status: 'active',
  sport: { key: 'basketball_nba', name: 'NBA Basketball' },
  groupedOutcomes: [
    {
      outcome: 'Boston Celtics',
      bookmakers: [{ bookmaker: 'draftkings', price: 450 }],
      bestOdds: 450,
    },
    {
      outcome: 'Denver Nuggets',
      bookmakers: [{ bookmaker: 'fanduel', price: 600 }],
      bestOdds: 600,
    },
  ],
};

function renderPage() {
  const store = configureStore({ reducer: { betSlip: betSlipReducer } });
  return {
    store,
    ...render(
      <Provider store={store}>
        <PreferencesProvider>
          <DarkModeProvider>
            <Futures />
          </DarkModeProvider>
        </PreferencesProvider>
      </Provider>
    ),
  };
}

describe('Futures page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockResolvedValue({ data: [] });
    mockApi.post.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches without a sportKey filter for the default "all" selection', async () => {
    renderPage();

    await waitFor(() => expect(mockApi.get).toHaveBeenCalledWith('/futures?'));
  });

  it('shows the empty state once loading resolves with no futures', async () => {
    renderPage();

    expect(await screen.findByText('NO FUTURES AVAILABLE')).toBeInTheDocument();
  });

  it('surfaces a fetch error', async () => {
    mockApi.get.mockRejectedValue(new Error('Futures service down'));
    renderPage();

    expect(await screen.findByText('Futures service down')).toBeInTheDocument();
  });

  it('re-fetches with the sportKey when a sport filter is selected', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalledWith('/futures?'));

    await user.click(screen.getByRole('button', { name: 'NFL' }));

    await waitFor(() =>
      expect(mockApi.get).toHaveBeenLastCalledWith('/futures?sportKey=americanfootball_nfl')
    );
  });

  it('renders outcomes sorted with the best odds first', async () => {
    mockApi.get.mockResolvedValue({ data: [NBA_TITLE_FUTURE] });
    renderPage();

    const headings = await screen.findAllByRole('heading', { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual(['Denver Nuggets', 'Boston Celtics']);
  });

  it('adds the chosen outcome to the bet slip as a future leg', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({ data: [NBA_TITLE_FUTURE] });
    const { store } = renderPage();
    await screen.findByText('Boston Celtics');

    const addButtons = screen.getAllByRole('button', { name: '+ ADD TO SLIP' });
    // Sorted best-odds-first, so index 0 is Denver Nuggets (+600).
    await user.click(addButtons[0]);

    expect(store.getState().betSlip.futureLegs).toEqual([
      {
        futureId: 'fut-1',
        futureTitle: 'NBA Championship',
        outcome: 'Denver Nuggets',
        odds: 600,
        status: 'pending',
        sportKey: 'basketball_nba',
      },
    ]);
  });

  it('triggers a sync and re-fetches after the delay', async () => {
    renderPage();
    await screen.findByText('NO FUTURES AVAILABLE');
    expect(mockApi.get).toHaveBeenCalledTimes(1);

    // Switch to fake timers only for the setTimeout-driven re-fetch, once
    // the initial (real-timer) load has already settled.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await user.click(screen.getByRole('button', { name: /SYNC ODDS/ }));

    await vi.waitFor(() =>
      expect(mockApi.post).toHaveBeenCalledWith('/admin/sync-futures', { sportKey: null })
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(mockApi.get).toHaveBeenCalledTimes(2);
  });
});
