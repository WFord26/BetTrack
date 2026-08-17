/**
 * Tests for the Stats page.
 *
 * The page owns real transform logic on top of `GET /bets/stats`: the date
 * range selector adds a computed `startDate` (or omits it for "all"), and
 * the sport/bet-type breakdown tables are derived client-side from the raw
 * `bySport`/`byBetType` maps (win rate from won vs. decided, not from
 * `count`). StatsOverview/PnLChart/CLVSummaryCard are mocked since they're
 * chart-heavy children with their own rendering concerns — this file is
 * about Stats.tsx's own fetch/filter/error-handling logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Stats from './Stats';

vi.mock('../services/api', () => ({
  default: { get: vi.fn() },
}));

vi.mock('../components/stats/StatsOverview', () => ({
  default: ({ stats }: { stats: { netProfit: number } }) => (
    <div data-testid="stats-overview">netProfit={stats.netProfit}</div>
  ),
}));
vi.mock('../components/stats/PnLChart', () => ({
  default: ({ data }: { data: unknown[] }) => <div data-testid="pnl-chart">{data.length} points</div>,
}));
vi.mock('../components/stats/CLVSummaryCard', () => ({
  default: () => <div data-testid="clv-summary-card" />,
}));

import api from '../services/api';
const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };

const API_STATS = {
  totalBets: 30,
  wonBets: 18,
  lostBets: 10,
  pushBets: 2,
  winRate: 64.3,
  totalStaked: 3000,
  totalReturn: 3400,
  netProfit: 400,
  roi: 13.3,
  bySport: {
    basketball_nba: { count: 20, won: 12, netProfit: 300 },
    americanfootball_nfl: { count: 10, won: 6, netProfit: 100 },
  },
  byBetType: {
    single: { count: 22, won: 14, netProfit: 250 },
    parlay: { count: 8, won: 4, netProfit: 150 },
  },
};

function withStats(stats: typeof API_STATS = API_STATS) {
  mockApi.get.mockResolvedValue({ data: { data: stats } });
}

describe('Stats page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withStats();
  });

  it('fetches with a computed startDate for the default 30-day range', async () => {
    render(<Stats />);

    expect(await screen.findByTestId('stats-overview')).toBeInTheDocument();
    const [, options] = mockApi.get.mock.calls[0];
    expect(mockApi.get.mock.calls[0][0]).toBe('/bets/stats');
    expect(options.params.startDate).toBeDefined();
  });

  it('omits startDate for the "all" range', async () => {
    const user = userEvent.setup();
    render(<Stats />);
    await screen.findByTestId('stats-overview');

    await user.click(screen.getByRole('button', { name: 'ALL' }));

    expect(mockApi.get).toHaveBeenLastCalledWith('/bets/stats', { params: {} });
  });

  it('re-fetches when a different range is selected', async () => {
    const user = userEvent.setup();
    render(<Stats />);
    await screen.findByTestId('stats-overview');

    await user.click(screen.getByRole('button', { name: '7D' }));

    expect(mockApi.get).toHaveBeenCalledTimes(2);
  });

  it('passes the fetched stats through to StatsOverview', async () => {
    render(<Stats />);

    expect(await screen.findByText('netProfit=400')).toBeInTheDocument();
  });

  it('derives the sport breakdown table with a decided-bets win rate', async () => {
    render(<Stats />);
    await screen.findByTestId('stats-overview');

    // NBA: 12 won out of 20 total (20 decided, no push in this fixture) = 60.0%.
    expect(screen.getByText('NBA')).toBeInTheDocument();
    const nbaRow = screen.getByText('NBA').closest('tr') as HTMLElement;
    expect(nbaRow).toHaveTextContent('20');
    expect(nbaRow).toHaveTextContent('60.0%');
    expect(nbaRow).toHaveTextContent('$300.00');
  });

  it('derives the bet-type breakdown table', async () => {
    render(<Stats />);
    await screen.findByTestId('stats-overview');

    const parlayRow = screen.getByText('parlay').closest('tr') as HTMLElement;
    // parlay: 4 won of 8 = 50.0%
    expect(parlayRow).toHaveTextContent('50.0%');
    expect(parlayRow).toHaveTextContent('$150.00');
  });

  it('shows an empty-state row when a breakdown has no data', async () => {
    withStats({ ...API_STATS, bySport: {} });
    render(<Stats />);

    expect(await screen.findByText('No sport data for this range.')).toBeInTheDocument();
  });

  it('surfaces a load failure with a retry action', async () => {
    const user = userEvent.setup();
    mockApi.get.mockRejectedValue({ response: { data: { message: 'Stats engine offline' } } });
    render(<Stats />);

    expect(await screen.findByText('Stats engine offline')).toBeInTheDocument();

    withStats();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByTestId('stats-overview')).toBeInTheDocument();
  });
});
