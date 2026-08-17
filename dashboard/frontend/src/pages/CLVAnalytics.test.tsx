/**
 * Tests for the CLV Analytics page.
 *
 * The page picks one of four renders — skeleton, error, empty, report — from
 * Redux state, then formats the summary numbers itself (sign prefixes, two
 * decimals, colour thresholds). These tests drive it through a real store with
 * the clv service mocked, and assert on the text a user would read.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import clvReducer, { type CLVState } from '../store/clvSlice';
import CLVAnalytics from './CLVAnalytics';
import { CLV_SUMMARY, CLV_BY_SPORT, CLV_BY_BOOKMAKER, CLV_TRENDS } from '../test/fixtures';
import type { CLVBetDetail, CLVReport } from '../types/clv.types';

vi.mock('../services/clv.service', () => ({
  clvService: {
    getSummary: vi.fn(),
    getBySport: vi.fn(),
    getByBookmaker: vi.fn(),
    getTrends: vi.fn(),
    getReport: vi.fn(),
    calculateForBet: vi.fn(),
    updateStats: vi.fn(),
  },
}));

import { clvService } from '../services/clv.service';
const mockService = clvService as unknown as Record<string, ReturnType<typeof vi.fn>>;

const BEST_BET: CLVBetDetail = {
  betId: 'bet-best',
  gameId: 'game-lal-bos',
  sportKey: 'basketball_nba',
  sportName: 'NBA Basketball',
  matchup: 'Lakers @ Celtics',
  selectionType: 'spread',
  odds: -110,
  closingOdds: -135,
  clv: 6.42,
  clvCategory: 'positive',
  outcome: 'won',
  createdAt: '2026-01-14T18:00:00.000Z',
};

const WORST_BET: CLVBetDetail = {
  betId: 'bet-worst',
  gameId: 'game-nyj-buf',
  sportKey: 'americanfootball_nfl',
  sportName: 'NFL',
  matchup: 'Jets @ Bills',
  selectionType: 'total',
  odds: -110,
  closingOdds: 105,
  clv: -8.13,
  clvCategory: 'negative',
  outcome: 'lost',
  createdAt: '2026-01-13T21:00:00.000Z',
};

function makeReport(overrides: Partial<CLVReport> = {}): CLVReport {
  return {
    summary: CLV_SUMMARY,
    bySport: CLV_BY_SPORT,
    byBookmaker: CLV_BY_BOOKMAKER,
    trends: CLV_TRENDS,
    topBets: [BEST_BET],
    worstBets: [WORST_BET],
    ...overrides,
  };
}

function renderPage(preloaded: Partial<CLVState> = {}) {
  const store = configureStore({
    reducer: { clv: clvReducer },
    preloadedState: {
      clv: {
        summary: null,
        bySport: [],
        byBookmaker: [],
        trends: [],
        report: null,
        filters: { period: 'all-time' },
        loading: false,
        error: null,
        ...preloaded,
      } as CLVState,
    },
  });

  return {
    store,
    ...render(
      <Provider store={store}>
        <CLVAnalytics />
      </Provider>
    ),
  };
}

describe('CLVAnalytics page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The page fetches on mount. Leaving those requests in flight keeps the
    // preloaded state — which is what each test is actually asserting on —
    // from being overwritten by a late fulfilled action.
    mockService.getReport.mockReturnValue(new Promise(() => {}));
    mockService.getTrends.mockReturnValue(new Promise(() => {}));
  });

  it('fetches the report and trends on mount using the active filters', () => {
    renderPage({ filters: { period: 'month', sportKey: 'basketball_nba' } });

    expect(mockService.getReport).toHaveBeenCalledWith({
      period: 'month',
      sportKey: 'basketball_nba',
    });
    expect(mockService.getTrends).toHaveBeenCalledWith({
      period: 'month',
      sportKey: 'basketball_nba',
    });
  });

  it('shows the loading skeleton before any report has arrived', () => {
    const { container } = renderPage({ loading: true, report: null });

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'CLV ANALYTICS' })).not.toBeInTheDocument();
  });

  it('keeps showing the report while a refresh is in flight', () => {
    renderPage({ loading: true, report: makeReport() });

    expect(screen.getByRole('heading', { name: 'CLV ANALYTICS' })).toBeInTheDocument();
  });

  it('surfaces the error message when the report request fails', async () => {
    // The mount fetch clears any preloaded error in its pending reducer, so the
    // error has to arrive the way it does in production: from a failed request.
    mockService.getReport.mockRejectedValue({
      response: { data: { message: 'CLV job has not run yet' } },
    });

    renderPage();

    expect(await screen.findByText('ERROR LOADING CLV ANALYTICS')).toBeInTheDocument();
    expect(screen.getByText('CLV job has not run yet')).toBeInTheDocument();
  });

  it('shows the error state rather than the empty state when a fetch fails', async () => {
    mockService.getReport.mockRejectedValue(new Error('Network Error'));

    renderPage();

    // No response body, so the slice falls back to its own message.
    expect(await screen.findByText('Failed to fetch CLV report')).toBeInTheDocument();
    expect(screen.queryByText('NO CLV DATA AVAILABLE')).not.toBeInTheDocument();
  });

  it('explains the empty state when no bets have settled', () => {
    renderPage({ report: makeReport({ summary: { ...CLV_SUMMARY, totalBets: 0 } }) });

    expect(screen.getByText('NO CLV DATA AVAILABLE')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export csv/i })).not.toBeInTheDocument();
  });

  describe('with a populated report', () => {
    it('reports the bet count the analysis covers', () => {
      renderPage({ report: makeReport() });

      expect(
        screen.getByText('Closing Line Value analysis across 140 bets')
      ).toBeInTheDocument();
    });

    it('formats the four summary tiles to two decimals with an explicit sign', () => {
      renderPage({ report: makeReport() });

      // averageCLV 1.85 and both ROIs are positive, so each gains a '+'.
      expect(screen.getByText('+1.85%')).toBeInTheDocument();
      expect(screen.getByText('+4.20%')).toBeInTheDocument();
      expect(screen.getByText('+3.10%')).toBeInTheDocument();
      // clvWinRate goes through formatPercentage: one decimal, no sign.
      expect(screen.getByText('58.6%')).toBeInTheDocument();
    });

    it('omits the plus sign for negative summary values', () => {
      renderPage({
        report: makeReport({
          summary: { ...CLV_SUMMARY, averageCLV: -1.25, expectedROI: -3.5, actualROI: -4 },
        }),
      });

      expect(screen.getByText('-1.25%')).toBeInTheDocument();
      expect(screen.getByText('-3.50%')).toBeInTheDocument();
      expect(screen.getByText('-4.00%')).toBeInTheDocument();
      expect(screen.queryByText('+-1.25%')).not.toBeInTheDocument();
    });

    it('lists the best bet with its CLV, line move and outcome', () => {
      renderPage({ report: makeReport() });

      const panel = screen.getByText('TOP 3 CLV BETS').closest('div')!;
      expect(within(panel).getByText('Lakers @ Celtics')).toBeInTheDocument();
      expect(within(panel).getByText('+6.42%')).toBeInTheDocument();
      expect(within(panel).getByText('-110 → -135')).toBeInTheDocument();
      expect(within(panel).getByText('WON')).toBeInTheDocument();
    });

    it('lists the worst bet with its negative CLV left unprefixed', () => {
      renderPage({ report: makeReport() });

      const panel = screen.getByText('WORST 3 CLV BETS').closest('div')!;
      expect(within(panel).getByText('Jets @ Bills')).toBeInTheDocument();
      expect(within(panel).getByText('-8.13%')).toBeInTheDocument();
      expect(within(panel).getByText('LOST')).toBeInTheDocument();
    });

    it('caps each bet list at five rows', () => {
      const many = Array.from({ length: 9 }, (_, i) => ({
        ...BEST_BET,
        betId: `bet-${i}`,
        matchup: `Matchup ${i}`,
      }));
      renderPage({ report: makeReport({ topBets: many }) });

      const panel = screen.getByText('TOP 3 CLV BETS').closest('div')!;
      expect(within(panel).getByText('Matchup 4')).toBeInTheDocument();
      expect(within(panel).queryByText('Matchup 5')).not.toBeInTheDocument();
    });

    it('re-fetches with the chosen filters when Apply is pressed', async () => {
      const user = userEvent.setup();
      renderPage({ report: makeReport() });
      mockService.getReport.mockClear();

      await user.selectOptions(screen.getByLabelText('PERIOD'), 'month');
      await user.selectOptions(screen.getByLabelText('SPORT'), 'basketball_nba');
      await user.click(screen.getByRole('button', { name: 'APPLY' }));

      expect(mockService.getReport).toHaveBeenCalledWith(
        expect.objectContaining({ period: 'month', sportKey: 'basketball_nba' })
      );
    });

    it('drops the sport filter entirely when All Sports is selected', async () => {
      const user = userEvent.setup();
      renderPage({ report: makeReport(), filters: { period: 'all-time' } });
      mockService.getReport.mockClear();

      await user.selectOptions(screen.getByLabelText('SPORT'), 'basketball_nba');
      await user.selectOptions(screen.getByLabelText('SPORT'), '');
      await user.click(screen.getByRole('button', { name: 'APPLY' }));

      const [filters] = mockService.getReport.mock.calls.at(-1)!;
      expect(filters.sportKey).toBeUndefined();
    });

    it('resets to the all-time period when Clear is pressed', async () => {
      const user = userEvent.setup();
      const { store } = renderPage({
        report: makeReport(),
        filters: { period: 'week', sportKey: 'basketball_nba', betType: 'spread' },
      });

      await user.click(screen.getByRole('button', { name: 'CLEAR' }));

      expect(store.getState().clv.filters).toEqual({ period: 'all-time' });
      expect(screen.getByLabelText('PERIOD')).toHaveValue('all-time');
      expect(screen.getByLabelText('SPORT')).toHaveValue('');
    });

    it('exports every top and worst bet as CSV with a dated filename', async () => {
      const user = userEvent.setup();
      const createObjectURL = vi.fn(() => 'blob:clv-report');
      const revokeObjectURL = vi.fn();
      Object.defineProperty(window, 'URL', {
        configurable: true,
        value: { ...window.URL, createObjectURL, revokeObjectURL },
      });
      const clicked: HTMLAnchorElement[] = [];
      const anchorClick = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(function (this: HTMLAnchorElement) {
          clicked.push(this);
        });
      // jsdom's Blob has no async reader, so capture the CSV as it is written.
      const blobParts: string[] = [];
      const RealBlob = global.Blob;
      const blobSpy = vi
        .spyOn(global, 'Blob')
        .mockImplementation((parts: BlobPart[] = [], options?: BlobPropertyBag) => {
          blobParts.push(parts.map(String).join(''));
          return new RealBlob(parts, options);
        });

      renderPage({ report: makeReport() });
      await user.click(screen.getByRole('button', { name: /export csv/i }));

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(blobSpy.mock.calls[0][1]).toEqual({ type: 'text/csv' });
      const rows = blobParts[0].trim().split('\n');
      expect(rows[0]).toBe(
        'Bet ID,Sport,Matchup,Selection,Odds,Closing Odds,CLV %,Category,Outcome,Date'
      );
      // One row per bet across both lists, quoted matchups intact.
      expect(rows).toHaveLength(3);
      expect(rows[1]).toContain('"Lakers @ Celtics"');
      expect(rows[2]).toContain('"Jets @ Bills"');
      expect(clicked[0].download).toMatch(/^clv-report-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:clv-report');

      anchorClick.mockRestore();
      blobSpy.mockRestore();
    });
  });
});
