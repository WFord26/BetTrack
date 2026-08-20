/**
 * Tests for the Bookmaker Performance page.
 *
 * The page drives three thunks off real user interactions: changing the
 * ranking criteria re-fetches rankings, selecting a bookmaker (from a row or
 * the detail-tab dropdown) fetches both its detail and its outlier stats,
 * and changing the outlier window re-fetches just the outlier stats for the
 * currently selected bookmaker. bookmaker.service is mocked; everything else
 * flows through a real store so the thunks' pending/fulfilled/rejected
 * lifecycle is actually exercised.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import bookmakerReducer from '../store/bookmakerSlice';
import { DarkModeProvider } from '../contexts/DarkModeContext';
import { ToastProvider } from '../components/ToastProvider';
import BookmakerPerformance from './BookmakerPerformance';
import { makeBookmakerAnalytics, BOOKMAKER_OUTLIER_STATS } from '../test/fixtures';

vi.mock('../services/bookmaker.service', () => ({
  bookmakerService: {
    getRankings: vi.fn(),
    getBookmakerDetail: vi.fn(),
    getBookmakerOutlierStats: vi.fn(),
    submitReport: vi.fn(),
  },
}));

import { bookmakerService } from '../services/bookmaker.service';
const mockService = bookmakerService as unknown as Record<string, ReturnType<typeof vi.fn>>;

const PINNACLE = makeBookmakerAnalytics({ bookmaker: 'pinnacle', recommendationScore: 91 });
const DRAFTKINGS = makeBookmakerAnalytics({
  bookmaker: 'draftkings',
  recommendationScore: 68,
  limitProfile: 'medium',
});

function renderPage() {
  const store = configureStore({ reducer: { bookmaker: bookmakerReducer } });
  return {
    store,
    ...render(
      <Provider store={store}>
        <DarkModeProvider>
          <ToastProvider>
            <BookmakerPerformance />
          </ToastProvider>
        </DarkModeProvider>
      </Provider>
    ),
  };
}

function withRankings(rankings: ReturnType<typeof makeBookmakerAnalytics>[]) {
  mockService.getRankings.mockResolvedValue({
    rankings,
    criteria: 'recommendation',
    count: rankings.length,
  });
}

describe('BookmakerPerformance page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withRankings([]);
    mockService.getBookmakerDetail.mockResolvedValue(PINNACLE);
    mockService.getBookmakerOutlierStats.mockResolvedValue(BOOKMAKER_OUTLIER_STATS);
    mockService.submitReport.mockResolvedValue({ success: true, data: { id: 'r1' } });
  });

  it('fetches rankings with the default criteria on mount', async () => {
    renderPage();

    expect(await screen.findByText('BOOKMAKERS')).toBeInTheDocument();
    expect(mockService.getRankings).toHaveBeenCalledWith('recommendation');
  });

  describe('rankings tab', () => {
    it('says so when there is no bookmaker data yet', async () => {
      renderPage();

      expect(await screen.findByText('NO BOOKMAKER DATA YET')).toBeInTheDocument();
    });

    it('lists ranked bookmakers with rank, name and summary stats', async () => {
      withRankings([PINNACLE, DRAFTKINGS]);
      renderPage();

      expect(await screen.findByText('Pinnacle')).toBeInTheDocument();
      expect(screen.getByText('DraftKings')).toBeInTheDocument();
      // Summary strip: 2 books ranked, avg score (91+68)/2 rounded = 80.
      expect(screen.getByText('BOOKS RANKED').nextElementSibling).toHaveTextContent('2');
      expect(screen.getByText('AVG SCORE').nextElementSibling).toHaveTextContent('80/100');
    });

    it('re-fetches rankings when the sort criteria changes', async () => {
      const user = userEvent.setup();
      withRankings([PINNACLE]);
      renderPage();
      await screen.findByText('Pinnacle');

      const sortRow = screen.getByText('SORT BY:').closest('div') as HTMLElement;
      await user.selectOptions(within(sortRow).getByRole('combobox'), 'value');

      expect(mockService.getRankings).toHaveBeenLastCalledWith('value');
    });

    it('surfaces a rankings load failure', async () => {
      mockService.getRankings.mockRejectedValue({
        response: { data: { error: 'Rankings unavailable' } },
      });
      renderPage();

      expect(await screen.findByText('Rankings unavailable')).toBeInTheDocument();
    });
  });

  describe('selecting a bookmaker', () => {
    it('switches to the detail tab and fetches detail plus outliers', async () => {
      const user = userEvent.setup();
      withRankings([PINNACLE]);
      renderPage();

      await user.click(await screen.findByText('Pinnacle'));

      expect(mockService.getBookmakerDetail).toHaveBeenCalledWith('pinnacle');
      expect(mockService.getBookmakerOutlierStats).toHaveBeenCalledWith('pinnacle', 30);
      expect(await screen.findByText('Sharp Book Rating')).toBeInTheDocument();
      expect(screen.getByText('9.4/10')).toBeInTheDocument();
    });

    it('shows the outlier stats for the selected window', async () => {
      const user = userEvent.setup();
      withRankings([PINNACLE]);
      renderPage();
      await user.click(await screen.findByText('Pinnacle'));

      await screen.findByText('OUTLIER ANALYSIS');
      expect(screen.getByText('RECORDS').nextElementSibling).toHaveTextContent('1,236');
      expect(screen.getByText('OUTLIER RATE').nextElementSibling).toHaveTextContent('6.1%');

      const windowRow = screen.getByText('WINDOW:').closest('div') as HTMLElement;
      await user.selectOptions(within(windowRow).getByRole('combobox'), '7');

      expect(mockService.getBookmakerOutlierStats).toHaveBeenLastCalledWith('pinnacle', 7);
    });

    it('shows a formatted uptime with the date the metric was last computed', async () => {
      const user = userEvent.setup();
      withRankings([PINNACLE]);
      mockService.getBookmakerDetail.mockResolvedValue(
        makeBookmakerAnalytics({ bookmaker: 'pinnacle', uptimePercentage: 95 })
      );
      renderPage();

      await user.click(await screen.findByText('Pinnacle'));

      const uptime = await screen.findByText('Uptime');
      expect(uptime.nextElementSibling).toHaveTextContent('95.0%');
      // The derived metric only refreshes on the daily job, so its age is shown
      expect(within(uptime.closest('div') as HTMLElement).getByText(/as of/)).toBeInTheDocument();
    });

    it('says "No reports yet" rather than an em dash when uptime is null', async () => {
      const user = userEvent.setup();
      withRankings([PINNACLE]);
      mockService.getBookmakerDetail.mockResolvedValue(
        makeBookmakerAnalytics({ bookmaker: 'pinnacle', uptimePercentage: null })
      );
      renderPage();

      await user.click(await screen.findByText('Pinnacle'));

      const uptime = await screen.findByText('Uptime');
      expect(uptime.nextElementSibling).toHaveTextContent('No reports yet');
      // "no signal yet" must not read as a staleness timestamp
      expect(
        within(uptime.closest('div') as HTMLElement).queryByText(/as of/)
      ).not.toBeInTheDocument();
    });

    it('submits an outage report and confirms it', async () => {
      const user = userEvent.setup();
      withRankings([PINNACLE]);
      renderPage();
      await user.click(await screen.findByText('Pinnacle'));

      await user.click(await screen.findByRole('button', { name: 'ODDS WERE DOWN' }));

      expect(mockService.submitReport).toHaveBeenCalledWith('pinnacle', 'OUTAGE');
      expect(await screen.findByText(/your report was recorded/i)).toBeInTheDocument();
    });

    it('submits a limit-reduction report', async () => {
      const user = userEvent.setup();
      withRankings([PINNACLE]);
      renderPage();
      await user.click(await screen.findByText('Pinnacle'));

      await user.click(await screen.findByRole('button', { name: 'LIMITS WERE CUT' }));

      expect(mockService.submitReport).toHaveBeenCalledWith('pinnacle', 'LIMIT_REDUCTION');
    });

    it('surfaces the server message when a report is rate-limited', async () => {
      const user = userEvent.setup();
      withRankings([PINNACLE]);
      mockService.submitReport.mockRejectedValue({
        response: { status: 429, data: { error: 'Already reported pinnacle recently.' } },
      });
      renderPage();
      await user.click(await screen.findByText('Pinnacle'));

      await user.click(await screen.findByRole('button', { name: 'ODDS WERE DOWN' }));

      expect(await screen.findByText('Already reported pinnacle recently.')).toBeInTheDocument();
      // The control must recover so the user can retry later
      expect(screen.getByRole('button', { name: 'ODDS WERE DOWN' })).toBeEnabled();
    });

    it('falls back to a generic message when the report fails for another reason', async () => {
      const user = userEvent.setup();
      withRankings([PINNACLE]);
      mockService.submitReport.mockRejectedValue({ response: { status: 500 } });
      renderPage();
      await user.click(await screen.findByText('Pinnacle'));

      await user.click(await screen.findByRole('button', { name: 'ODDS WERE DOWN' }));

      expect(await screen.findByText(/could not submit your report/i)).toBeInTheDocument();
    });

    it('prompts to pick a bookmaker before any selection has been made', async () => {
      const user = userEvent.setup();
      withRankings([PINNACLE]);
      renderPage();
      await screen.findByText('Pinnacle');

      await user.click(screen.getByRole('button', { name: 'DETAIL' }));

      expect(await screen.findByText('SELECT A BOOKMAKER')).toBeInTheDocument();
    });

    it('selects a different bookmaker from the detail-tab dropdown', async () => {
      const user = userEvent.setup();
      withRankings([PINNACLE, DRAFTKINGS]);
      mockService.getBookmakerDetail.mockImplementation((bm: string) =>
        Promise.resolve(bm === 'pinnacle' ? PINNACLE : DRAFTKINGS)
      );
      renderPage();
      await user.click(await screen.findByText('Pinnacle'));
      await screen.findByText('Sharp Book Rating');

      const bookmakerRow = screen.getByText('BOOKMAKER:').closest('div') as HTMLElement;
      await user.selectOptions(within(bookmakerRow).getByRole('combobox'), 'draftkings');

      expect(mockService.getBookmakerDetail).toHaveBeenLastCalledWith('draftkings');
      await screen.findByText('DraftKings', { selector: 'h2' });
    });
  });
});
