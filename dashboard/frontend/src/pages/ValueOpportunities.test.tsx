/**
 * Tests for the Value Opportunities page.
 *
 * Real logic to lock down: `minScore` is the only filter sent to the
 * backend (as `threshold`) — sport and time-to-game are applied client-side
 * against whatever came back — and the sort key changes the ordering of the
 * already-fetched list without a re-fetch. DisagreementBreakdown is mocked
 * since it does its own API call for the expanded consensus detail; this
 * file only checks that clicking a game passes the right one to it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DarkModeProvider } from '../contexts/DarkModeContext';
import ValueOpportunities from './ValueOpportunities';
import type { HighDisagreementGame } from '../types/disagreement.types';

vi.mock('../services/api', () => ({
  default: { get: vi.fn() },
}));

vi.mock('../components/odds/DisagreementBreakdown', () => ({
  default: ({ game, onClose }: { game: HighDisagreementGame; onClose: () => void }) => (
    <div data-testid="breakdown-modal">
      {game.awayTeamName} @ {game.homeTeamName}
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

import api from '../services/api';
const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };

/** The filter labels aren't wired to their <select> with htmlFor, so scope by the label's parent. */
function selectNear(labelText: string): HTMLElement {
  const label = screen.getByText(labelText);
  return within(label.closest('div') as HTMLElement).getByRole('combobox');
}

function makeGame(overrides: Partial<HighDisagreementGame> = {}): HighDisagreementGame {
  return {
    gameId: 'game-1',
    homeTeamName: 'Boston Celtics',
    awayTeamName: 'Los Angeles Lakers',
    commenceTime: new Date(Date.now() + 3 * 3_600_000).toISOString(),
    sportKey: 'basketball_nba',
    consensus: [
      {
        gameId: 'game-1',
        marketType: 'spreads',
        consensusLine: -3.5,
        standardDeviation: 1.2,
        outlierBookmakers: [],
        bookmakerCount: 6,
        disagreementScore: 72,
        bestValue: { side: 'home', bookmaker: 'draftkings', line: -3, impliedProb: 0.55 },
      },
    ],
    maxDisagreementScore: 72,
    ...overrides,
  };
}

function withGames(games: HighDisagreementGame[]) {
  mockApi.get.mockResolvedValue({ data: { data: { games } } });
}

function renderPage() {
  return render(
    <DarkModeProvider>
      <ValueOpportunities />
    </DarkModeProvider>
  );
}

describe('ValueOpportunities page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withGames([]);
  });

  it('fetches with the default score threshold', async () => {
    renderPage();

    expect(await screen.findByText('NO DISAGREEMENTS FOUND')).toBeInTheDocument();
    expect(mockApi.get).toHaveBeenCalledWith('/analytics/disagreement/live', {
      params: { threshold: 60, limit: 100 },
    });
  });

  it('re-fetches with the new threshold when min score changes', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('NO DISAGREEMENTS FOUND');

    await user.selectOptions(selectNear('MIN SCORE'), '81');

    expect(mockApi.get).toHaveBeenLastCalledWith('/analytics/disagreement/live', {
      params: { threshold: 81, limit: 100 },
    });
  });

  it('renders a fetched game with its sport, score badge and market chips', async () => {
    withGames([makeGame()]);
    renderPage();

    const gameRow = (await screen.findByText(/Los Angeles Lakers/)).closest('button') as HTMLElement;
    expect(within(gameRow).getByText('NBA')).toBeInTheDocument();
    expect(within(gameRow).getByText('72')).toBeInTheDocument();
    expect(within(gameRow).getByText('SPD 72')).toBeInTheDocument();
  });

  it('filters client-side by sport without an extra fetch', async () => {
    const user = userEvent.setup();
    withGames([
      makeGame({ gameId: 'g-1', sportKey: 'basketball_nba' }),
      makeGame({
        gameId: 'g-2',
        sportKey: 'americanfootball_nfl',
        homeTeamName: 'Buffalo Bills',
        awayTeamName: 'New York Jets',
      }),
    ]);
    renderPage();
    await screen.findByText('2 games matching filters');
    const callsBefore = mockApi.get.mock.calls.length;

    await user.selectOptions(selectNear('SPORT'), 'americanfootball_nfl');

    expect(await screen.findByText('1 game matching filters')).toBeInTheDocument();
    expect(screen.getByText(/New York Jets/)).toBeInTheDocument();
    expect(screen.queryByText(/Los Angeles Lakers/)).not.toBeInTheDocument();
    expect(mockApi.get.mock.calls.length).toBe(callsBefore);
  });

  it('filters client-side by time-to-game', async () => {
    const user = userEvent.setup();
    withGames([
      makeGame({ gameId: 'g-soon', commenceTime: new Date(Date.now() + 2 * 3_600_000).toISOString() }),
      makeGame({
        gameId: 'g-later',
        commenceTime: new Date(Date.now() + 40 * 3_600_000).toISOString(),
        homeTeamName: 'Golden State Warriors',
        awayTeamName: 'Miami Heat',
      }),
    ]);
    renderPage();
    await screen.findByText('2 games matching filters');

    await user.selectOptions(selectNear('TIME TO GAME'), '3');

    expect(await screen.findByText('1 game matching filters')).toBeInTheDocument();
    expect(screen.queryByText(/Miami Heat/)).not.toBeInTheDocument();
  });

  it('re-sorts the already-fetched list by time without an extra fetch', async () => {
    const user = userEvent.setup();
    withGames([
      makeGame({
        gameId: 'g-late',
        maxDisagreementScore: 90,
        commenceTime: new Date(Date.now() + 30 * 3_600_000).toISOString(),
        homeTeamName: 'Golden State Warriors',
        awayTeamName: 'Miami Heat',
      }),
      makeGame({
        gameId: 'g-early',
        maxDisagreementScore: 62,
        commenceTime: new Date(Date.now() + 2 * 3_600_000).toISOString(),
      }),
    ]);
    renderPage();
    await screen.findByText('2 games matching filters');
    // Default sort is by score: the 90-score game leads.
    let rows = screen.getAllByRole('button', { name: /@/ });
    expect(rows[0]).toHaveTextContent('Miami Heat');
    const callsBefore = mockApi.get.mock.calls.length;

    await user.selectOptions(selectNear('SORT BY'), 'time');

    rows = screen.getAllByRole('button', { name: /@/ });
    expect(rows[0]).toHaveTextContent('Los Angeles Lakers');
    expect(mockApi.get.mock.calls.length).toBe(callsBefore);
  });

  it('opens the breakdown modal for the clicked game and closes it', async () => {
    const user = userEvent.setup();
    withGames([makeGame()]);
    renderPage();
    await user.click(await screen.findByText(/Los Angeles Lakers/));

    expect(screen.getByTestId('breakdown-modal')).toHaveTextContent(
      'Los Angeles Lakers @ Boston Celtics'
    );

    await user.click(screen.getByText('close'));

    expect(screen.queryByTestId('breakdown-modal')).not.toBeInTheDocument();
  });

  it('refetches the current threshold when Refresh is clicked', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('NO DISAGREEMENTS FOUND');
    const callsBefore = mockApi.get.mock.calls.length;

    await user.click(screen.getByRole('button', { name: /REFRESH/ }));

    expect(mockApi.get.mock.calls.length).toBe(callsBefore + 1);
  });

  it('surfaces the backend error message', async () => {
    mockApi.get.mockRejectedValue({ response: { data: { error: 'Disagreement engine down' } } });
    renderPage();

    expect(await screen.findByText('Disagreement engine down')).toBeInTheDocument();
  });
});
