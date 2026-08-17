/**
 * Tests for the Bet History page.
 *
 * The page owns real query-building and pagination logic on top of `GET
 * /bets`: each filter change resets to page 1 and refetches, dates are
 * converted to ISO before being sent, `hasMore` is derived from whether a
 * full page came back, and the header stat chips are computed locally from
 * whatever bets are currently loaded (not from the server total). BetCard is
 * mocked so these tests stay about the page's own logic rather than the
 * card's rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DarkModeProvider } from '../contexts/DarkModeContext';
import BetHistory from './BetHistory';
import type { Bet } from '../types/game.types';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../components/bets/BetCard', () => ({
  default: ({ bet }: { bet: Bet }) => <div data-testid="bet-card">{bet.id}</div>,
}));

import api from '../services/api';
const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };

function makeBet(overrides: Partial<Bet> = {}): Bet {
  return {
    id: 'bet-1',
    name: 'Lakers ML',
    betType: 'single',
    status: 'won',
    stake: 100,
    oddsAtPlacement: -110,
    actualPayout: 190.91,
    placedAt: '2026-01-10T00:00:00.000Z',
    legs: [],
    ...overrides,
  };
}

function withBets(bets: Bet[], total = bets.length) {
  mockApi.get.mockResolvedValue({ data: { bets, total } });
}

function renderPage() {
  return render(
    <DarkModeProvider>
      <BetHistory />
    </DarkModeProvider>
  );
}

describe('BetHistory page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withBets([]);
  });

  describe('initial fetch', () => {
    it('requests page 1 with the default limit and no filters', async () => {
      renderPage();

      await waitFor(() =>
        expect(mockApi.get).toHaveBeenCalledWith('/bets', { params: { page: 1, limit: 20 } })
      );
    });

    it('shows loading skeletons before the first response resolves', () => {
      mockApi.get.mockReturnValue(new Promise(() => {}));
      renderPage();

      expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    });

    it('surfaces the backend error message on a failed load', async () => {
      mockApi.get.mockRejectedValue({ response: { data: { message: 'Bets table missing' } } });
      renderPage();

      expect(await screen.findByText('Bets table missing')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'RETRY' })).toBeInTheDocument();
    });

    it('retries the fetch when RETRY is clicked', async () => {
      const user = userEvent.setup();
      mockApi.get.mockRejectedValueOnce({ response: { data: { message: 'timeout' } } });
      renderPage();

      await screen.findByText('timeout');
      withBets([makeBet()]);
      await user.click(screen.getByRole('button', { name: 'RETRY' }));

      expect(await screen.findByTestId('bet-card')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it("explains the ledger is empty when there are no filters", async () => {
      renderPage();

      expect(await screen.findByText('NO BETS FOUND')).toBeInTheDocument();
      expect(
        screen.getByText("The ledger's empty. Add your first bet to get rolling.")
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'CLEAR FILTERS' })).not.toBeInTheDocument();
    });

    it('offers to clear filters when a filtered search comes back empty', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('NO BETS FOUND');

      await user.click(screen.getByRole('button', { name: 'WON' }));

      expect(
        await screen.findByText('Try adjusting your filters to see more results')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'CLEAR FILTERS' })).toBeInTheDocument();
    });
  });

  describe('populated list and header stats', () => {
    it('renders a card per bet and computes record/net P&L/win rate from loaded bets', async () => {
      withBets([
        makeBet({ id: 'bet-1', status: 'won', stake: 100, actualPayout: 150 }),
        makeBet({ id: 'bet-2', status: 'lost', stake: 50, actualPayout: 0 }),
        makeBet({ id: 'bet-3', status: 'pending', stake: 25 }),
      ]);
      renderPage();

      const cards = await screen.findAllByTestId('bet-card');
      expect(cards.map((c) => c.textContent)).toEqual(['bet-1', 'bet-2', 'bet-3']);

      // 1 win, 1 loss (pending is excluded from the decided count).
      expect(screen.getByText('1-1')).toBeInTheDocument();
      // net P&L = (150-100) + (0-50) = 0.
      expect(screen.getByText('+$0.00')).toBeInTheDocument();
      expect(screen.getByText('50.0%')).toBeInTheDocument();
    });
  });

  describe('filters', () => {
    it('refetches with the selected status and resets to page 1', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(1));

      await user.click(screen.getByRole('button', { name: 'LOST' }));

      await waitFor(() =>
        expect(mockApi.get).toHaveBeenLastCalledWith('/bets', {
          params: { page: 1, limit: 20, status: 'lost' },
        })
      );
    });

    it('sends the selected sport', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(1));

      await user.selectOptions(screen.getByLabelText('SPORT'), 'basketball_nba');

      await waitFor(() =>
        expect(mockApi.get).toHaveBeenLastCalledWith('/bets', {
          params: { page: 1, limit: 20, sport: 'basketball_nba' },
        })
      );
    });

    it('converts start and end dates to ISO strings', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(1));

      await user.type(screen.getByLabelText('START DATE'), '2026-01-01');
      await user.type(screen.getByLabelText('END DATE'), '2026-01-31');

      await waitFor(() => {
        const lastCall = mockApi.get.mock.calls[mockApi.get.mock.calls.length - 1];
        expect(lastCall[1].params.startDate).toBe(new Date('2026-01-01').toISOString());
        expect(lastCall[1].params.endDate).toBe(new Date('2026-01-31').toISOString());
      });
    });

    it('resets every filter back to its default', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('NO BETS FOUND');

      await user.click(screen.getByRole('button', { name: 'WON' }));
      await user.selectOptions(screen.getByLabelText('SPORT'), 'basketball_nba');
      await screen.findByRole('button', { name: 'RESET FILTERS' });

      await user.click(screen.getByRole('button', { name: 'RESET FILTERS' }));

      expect(screen.getByLabelText('SPORT')).toHaveValue('all');
      await waitFor(() =>
        expect(mockApi.get).toHaveBeenLastCalledWith('/bets', { params: { page: 1, limit: 20 } })
      );
    });
  });

  describe('pagination', () => {
    it('shows Load More only when a full page came back, and appends results', async () => {
      const user = userEvent.setup();
      const firstPage = Array.from({ length: 20 }, (_, i) => makeBet({ id: `bet-${i}` }));
      withBets(firstPage, 45);
      renderPage();

      expect(await screen.findByRole('button', { name: 'LOAD MORE' })).toBeInTheDocument();

      const secondPage = [makeBet({ id: 'bet-20' }), makeBet({ id: 'bet-21' })];
      mockApi.get.mockResolvedValueOnce({ data: { bets: secondPage, total: 45 } });
      await user.click(screen.getByRole('button', { name: 'LOAD MORE' }));

      await waitFor(() =>
        expect(mockApi.get).toHaveBeenLastCalledWith('/bets', { params: { page: 2, limit: 20 } })
      );
      // The short second page means there's nothing left to load.
      await waitFor(() => expect(screen.getAllByTestId('bet-card')).toHaveLength(22));
      expect(screen.queryByRole('button', { name: 'LOAD MORE' })).not.toBeInTheDocument();
    });
  });
});
