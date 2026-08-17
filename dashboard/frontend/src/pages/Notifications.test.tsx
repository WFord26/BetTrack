/**
 * Tests for the Notifications page.
 *
 * The only live wiring here is the arbitrage alert block: it polls
 * `fetchLiveArbitrage` on a cadence and renders whatever
 * `selectAlertingOpportunities` derives from the live list plus the user's
 * alert settings, and the enabled checkbox actually flips real store state
 * (verified by the list disappearing/reappearing, not just a dispatch spy).
 * Everything else on the page is static placeholder UI. arbitrage.service is
 * mocked, matching the ArbitrageDashboard convention.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import arbitrageReducer from '../store/arbitrageSlice';
import Notifications from './Notifications';
import { makeArbitrageOpportunity } from '../test/fixtures';

vi.mock('../services/arbitrage.service', () => ({
  arbitrageService: {
    getLive: vi.fn(),
    getHistory: vi.fn(),
    getStats: vi.fn(),
    getById: vi.fn(),
    markTaken: vi.fn(),
    calculate: vi.fn(),
  },
}));

import { arbitrageService } from '../services/arbitrage.service';
const mockService = arbitrageService as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderPage() {
  const store = configureStore({ reducer: { arbitrage: arbitrageReducer } });
  return {
    store,
    ...render(
      <MemoryRouter>
        <Provider store={store}>
          <Notifications />
        </Provider>
      </MemoryRouter>
    ),
  };
}

function withLive(opportunities: ReturnType<typeof makeArbitrageOpportunity>[]) {
  mockService.getLive.mockResolvedValue({
    opportunities,
    count: opportunities.length,
    retrievedAt: null,
  });
}

describe('Notifications page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    withLive([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches live arbitrage on mount', async () => {
    renderPage();

    expect(await screen.findByText('Notifications')).toBeInTheDocument();
    expect(mockService.getLive).toHaveBeenCalledWith({});
  });

  it('says nothing is above threshold when the alerting list is empty', async () => {
    renderPage();

    expect(
      await screen.findByText('Nothing above your thresholds right now.')
    ).toBeInTheDocument();
  });

  it('lists an opportunity that clears the default threshold', async () => {
    withLive([makeArbitrageOpportunity({ profitPercentage: '3.60' })]);
    renderPage();

    expect(await screen.findByText('Los Angeles Lakers @ Boston Celtics')).toBeInTheDocument();
    expect(screen.getByText('+3.60%')).toBeInTheDocument();
    expect(screen.getByText(/draftkings \/ fanduel/)).toBeInTheDocument();
  });

  it('omits an opportunity below the configured minimum profit', async () => {
    withLive([makeArbitrageOpportunity({ profitPercentage: '0.40' })]);
    renderPage();

    await screen.findByText('Arbitrage Alerts');
    expect(
      screen.getByText('Nothing above your thresholds right now.')
    ).toBeInTheDocument();
  });

  it('hides the list and shows "turned off" once alerts are disabled', async () => {
    const user = userEvent.setup();
    withLive([makeArbitrageOpportunity()]);
    renderPage();
    await screen.findByText('Los Angeles Lakers @ Boston Celtics');

    await user.click(screen.getByLabelText('Enable arbitrage alerts'));

    expect(screen.getByText('Alerts are turned off.')).toBeInTheDocument();
    expect(screen.queryByText('Los Angeles Lakers @ Boston Celtics')).not.toBeInTheDocument();
  });

  it('updates real store state and persists the setting when toggled', async () => {
    const user = userEvent.setup();
    const { store } = renderPage();
    await screen.findByText('Arbitrage Alerts');

    await user.click(screen.getByLabelText('Enable arbitrage alerts'));

    expect(store.getState().arbitrage.alertSettings.enabled).toBe(false);
    expect(JSON.parse(localStorage.getItem('bettrack.arbitrage.alerts')!).enabled).toBe(false);
  });

  it('polls again on the 30-second cadence', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();

    await vi.waitFor(() => expect(mockService.getLive).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(30_000);

    expect(mockService.getLive).toHaveBeenCalledTimes(2);
  });

  it('stops polling once unmounted', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { unmount } = renderPage();

    await vi.waitFor(() => expect(mockService.getLive).toHaveBeenCalledTimes(1));
    unmount();
    await vi.advanceTimersByTimeAsync(90_000);

    expect(mockService.getLive).toHaveBeenCalledTimes(1);
  });

  it('links to the full arbitrage dashboard', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: 'Open the arbitrage dashboard' })).toHaveAttribute(
      'href',
      '/analytics/arbitrage'
    );
  });
});
