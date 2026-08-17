/**
 * Tests for the Arbitrage Dashboard.
 *
 * The page owns real presentation logic on top of the store: it splits middles
 * out of the live list, derives the bookmaker and sport option lists from the
 * opportunities on screen, formats profit and stake figures, and switches
 * between four tabs. Each test drives it through a real store with the
 * arbitrage service mocked and asserts on rendered text.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import arbitrageReducer from '../store/arbitrageSlice';
import { DarkModeProvider } from '../contexts/DarkModeContext';
import ArbitrageDashboard from './ArbitrageDashboard';
import { makeArbitrageOpportunity, ARBITRAGE_STATS } from '../test/fixtures';

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

const MIDDLE = makeArbitrageOpportunity({
  id: 'mid-1',
  arbType: 'middle',
  marketType: 'spreads',
  profitPercentage: '1.20',
  riskLevel: 'medium',
  middleProbability: '0.18',
  middleGapLow: '-4.5',
  middleGapHigh: '-2.5',
});

function renderPage() {
  const store = configureStore({ reducer: { arbitrage: arbitrageReducer } });
  return {
    store,
    ...render(
      <Provider store={store}>
        <DarkModeProvider>
          <ArbitrageDashboard />
        </DarkModeProvider>
      </Provider>
    ),
  };
}

/** Resolves the mount fetches with the given live list. */
function withLive(opportunities: ReturnType<typeof makeArbitrageOpportunity>[]) {
  mockService.getLive.mockResolvedValue({
    opportunities,
    count: opportunities.length,
    retrievedAt: null,
  });
}

describe('ArbitrageDashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withLive([]);
    mockService.getStats.mockResolvedValue(ARBITRAGE_STATS);
    mockService.markTaken.mockResolvedValue(makeArbitrageOpportunity({ status: 'taken' }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches live opportunities and stats on mount', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Arbitrage & Middles' })).toBeInTheDocument();
    expect(mockService.getLive).toHaveBeenCalledWith({});
    expect(mockService.getStats).toHaveBeenCalledWith(30, false);
  });

  it('always shows the odds-freshness disclosure', async () => {
    renderPage();

    expect(
      await screen.findByText('Opportunities are only as fresh as the last odds sync')
    ).toBeInTheDocument();
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

  describe('stats strip', () => {
    it('renders the headline counters once stats arrive', async () => {
      renderPage();

      expect(await screen.findByText('Active now')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('4.3')).toBeInTheDocument(); // detectionsPerDay 4.27 → 1dp
      expect(screen.getByText('2.14%')).toBeInTheDocument();
      expect(screen.getByText('7.82%')).toBeInTheDocument();
    });

    it('hides the strip entirely when stats are unavailable', async () => {
      mockService.getStats.mockResolvedValue(null);
      renderPage();

      await screen.findByRole('heading', { name: 'Arbitrage & Middles' });
      expect(screen.queryByText('Active now')).not.toBeInTheDocument();
    });
  });

  describe('live tab', () => {
    it('explains that an empty snapshot is the normal state', async () => {
      renderPage();

      expect(await screen.findByText(/No arbitrage in the current snapshot/)).toBeInTheDocument();
    });

    it('renders an opportunity card with matchup, profit and both legs', async () => {
      withLive([makeArbitrageOpportunity()]);
      renderPage();

      expect(
        await screen.findByText('Los Angeles Lakers @ Boston Celtics')
      ).toBeInTheDocument();
      // profitPercentage arrives as the string '3.60' and is formatted to 2dp
      // with an explicit sign.
      expect(screen.getByText('+3.60%')).toBeInTheDocument();
      expect(screen.getByText('Arbitrage')).toBeInTheDocument();
      expect(screen.getByText('low risk')).toBeInTheDocument();
      expect(screen.getByText('draftkings')).toBeInTheDocument();
      expect(screen.getByText('fanduel')).toBeInTheDocument();
      // The favourite's odds keep their minus sign; the dog's gains a plus.
      expect(screen.getByText(/\+150 · stake \$414\.42 · returns \$621\.63/)).toBeInTheDocument();
      expect(screen.getByText(/-130 · stake \$585\.58 · returns \$450\.45/)).toBeInTheDocument();
      expect(screen.getByText('$1,000.00 staked')).toBeInTheDocument();
      expect(screen.getByText(/Profit \$36\.03/)).toBeInTheDocument();
    });

    it('labels the market in plain language', async () => {
      withLive([makeArbitrageOpportunity({ marketType: 'totals' })]);
      renderPage();

      expect(await screen.findByText(/Total/)).toBeInTheDocument();
    });

    it('lists risk factors when the detector flagged any', async () => {
      withLive([
        makeArbitrageOpportunity({
          riskLevel: 'high',
          riskFactors: ['Snapshot older than 5 minutes', 'One leg at a limit-sensitive book'],
        }),
      ]);
      renderPage();

      expect(await screen.findByText('• Snapshot older than 5 minutes')).toBeInTheDocument();
      expect(screen.getByText('• One leg at a limit-sensitive book')).toBeInTheDocument();
      expect(screen.getByText('high risk')).toBeInTheDocument();
    });

    it('keeps middles out of the live arbitrage list', async () => {
      withLive([makeArbitrageOpportunity({ id: 'arb-1' }), MIDDLE]);
      renderPage();

      await screen.findByText('Los Angeles Lakers @ Boston Celtics');
      // Only the true arbitrage renders a card here; the middle is on its own tab.
      expect(screen.getAllByRole('button', { name: 'Mark as taken' })).toHaveLength(1);
      expect(screen.getByText('+3.60%')).toBeInTheDocument();
      expect(screen.queryByText('+1.20%')).not.toBeInTheDocument();
    });

    it('falls back gracefully when the game relation is missing', async () => {
      withLive([makeArbitrageOpportunity({ game: undefined })]);
      renderPage();

      expect(await screen.findByText('Game unavailable')).toBeInTheDocument();
    });

    it('re-queries with a minimum profit filter and drops it when cleared', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByLabelText('Minimum profit %');
      await user.clear(screen.getByLabelText('Minimum profit %'));
      await user.type(screen.getByLabelText('Minimum profit %'), '2');

      await vi.waitFor(() =>
        expect(mockService.getLive).toHaveBeenLastCalledWith({ minProfit: 2 })
      );

      await user.clear(screen.getByLabelText('Minimum profit %'));
      await vi.waitFor(() => expect(mockService.getLive).toHaveBeenLastCalledWith({}));
    });

    it('removes an opportunity from the board once marked as taken', async () => {
      const user = userEvent.setup();
      withLive([
        makeArbitrageOpportunity({ id: 'arb-1' }),
        makeArbitrageOpportunity({
          id: 'arb-2',
          game: {
            id: 'game-nyj-buf',
            homeTeamName: 'Buffalo Bills',
            awayTeamName: 'New York Jets',
            commenceTime: '2026-01-15T20:00:00.000Z',
            sport: { key: 'americanfootball_nfl', name: 'NFL' },
          },
        }),
      ]);
      mockService.markTaken.mockResolvedValue(
        makeArbitrageOpportunity({ id: 'arb-1', status: 'taken' })
      );
      renderPage();

      const cards = await screen.findAllByRole('button', { name: 'Mark as taken' });
      expect(cards).toHaveLength(2);
      await user.click(cards[0]);

      expect(mockService.markTaken).toHaveBeenCalledWith('arb-1', undefined);
      await vi.waitFor(() =>
        expect(screen.getAllByRole('button', { name: 'Mark as taken' })).toHaveLength(1)
      );
      expect(screen.getByText('New York Jets @ Buffalo Bills')).toBeInTheDocument();
    });

    it('shows the backend error message when the fetch fails', async () => {
      mockService.getLive.mockRejectedValue({
        response: { data: { error: 'Arbitrage detector is offline' } },
      });
      renderPage();

      expect(await screen.findByText('Arbitrage detector is offline')).toBeInTheDocument();
    });
  });

  describe('tabs', () => {
    it('switches to the middles tab, which shows middles rather than arbitrage', async () => {
      const user = userEvent.setup();
      withLive([makeArbitrageOpportunity({ id: 'arb-1' }), MIDDLE]);
      renderPage();

      await screen.findByText('Los Angeles Lakers @ Boston Celtics');
      await user.click(screen.getByRole('button', { name: 'Middles' }));

      expect(screen.queryByLabelText('Minimum profit %')).not.toBeInTheDocument();
      // The middle renders its winning window and hit chance (0.18 → 18.0%),
      // neither of which appears on an arbitrage card.
      expect(
        screen.getByText(/Boston Celtics wins by more than -4\.5 but less than -2\.5/)
      ).toBeInTheDocument();
      expect(screen.getByText('18.0%')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Mark as taken' })).not.toBeInTheDocument();
    });

    it('says so when there are no middles to show', async () => {
      const user = userEvent.setup();
      withLive([makeArbitrageOpportunity({ id: 'arb-1' })]);
      renderPage();

      await screen.findByText('Los Angeles Lakers @ Boston Celtics');
      await user.click(screen.getByRole('button', { name: 'Middles' }));

      expect(
        screen.getByText('No middle opportunities in the current odds snapshot.')
      ).toBeInTheDocument();
    });

    it('shows the stake calculator on its tab', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByRole('button', { name: 'Calculator' });
      await user.click(screen.getByRole('button', { name: 'Calculator' }));

      expect(screen.queryByLabelText('Minimum profit %')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /calculate/i })).toBeInTheDocument();
    });

    it('offers the books and sports seen in the live list as alert filters', async () => {
      const user = userEvent.setup();
      withLive([
        makeArbitrageOpportunity({ id: 'arb-1' }),
        makeArbitrageOpportunity({
          id: 'arb-2',
          legs: [
            { ...makeArbitrageOpportunity().legs[0], bookmaker: 'betmgm' },
            { ...makeArbitrageOpportunity().legs[1], bookmaker: 'caesars' },
          ],
          game: {
            id: 'game-nyj-buf',
            homeTeamName: 'Buffalo Bills',
            awayTeamName: 'New York Jets',
            commenceTime: '2026-01-15T20:00:00.000Z',
            sport: { key: 'americanfootball_nfl', name: 'NFL' },
          },
        }),
      ]);
      renderPage();

      await screen.findByText('Los Angeles Lakers @ Boston Celtics');
      await user.click(screen.getByRole('button', { name: 'Alerts' }));

      // Every distinct bookmaker across both opportunities becomes a toggle,
      // de-duplicated and alphabetically sorted.
      const bookRow = screen
        .getByText('Bookmakers you hold accounts with (empty means all)')
        .nextElementSibling as HTMLElement;
      expect(within(bookRow).getAllByRole('button').map((b) => b.textContent)).toEqual([
        'betmgm',
        'caesars',
        'draftkings',
        'fanduel',
      ]);

      const sportRow = screen.getByText('Sports (empty means all)')
        .nextElementSibling as HTMLElement;
      expect(within(sportRow).getAllByRole('button').map((b) => b.textContent)).toEqual([
        'NBA Basketball',
        'NFL',
      ]);
    });

    it('persists an alert threshold change from the alerts tab', async () => {
      const user = userEvent.setup();
      const { store } = renderPage();

      await screen.findByRole('button', { name: 'Alerts' });
      await user.click(screen.getByRole('button', { name: 'Alerts' }));
      await user.clear(screen.getByLabelText('Minimum profit %'));
      await user.type(screen.getByLabelText('Minimum profit %'), '3');

      expect(store.getState().arbitrage.alertSettings.minProfitPercentage).toBe(3);
      expect(
        JSON.parse(localStorage.getItem('bettrack.arbitrage.alerts')!).minProfitPercentage
      ).toBe(3);
    });
  });
});
