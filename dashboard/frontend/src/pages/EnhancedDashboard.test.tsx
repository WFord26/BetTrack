/**
 * Tests for the main dashboard page.
 *
 * The page owns the game list end to end: it builds the `/games` query from
 * the selected date, unwraps two different response shapes, derives the sport
 * and bookmaker option lists from whatever came back, filters by sport and
 * status, and re-fetches on a 30-second cadence. Each of those is asserted
 * against real game payloads shaped like `GET /api/games`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import betSlipReducer from '../store/betSlipSlice';
import clvReducer from '../store/clvSlice';
import correlationReducer from '../store/correlationSlice';
import { DarkModeProvider } from '../contexts/DarkModeContext';
import EnhancedDashboard from './EnhancedDashboard';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    defaults: { baseURL: 'http://localhost:3001/api' },
  },
}));

import api from '../services/api';
const mockApi = api as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

/** A game in the shape `GET /api/games` returns after its transform step. */
function makeApiGame(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-lal-bos',
    externalId: 'ext-1',
    sportKey: 'basketball_nba',
    sportName: 'NBA Basketball',
    homeTeamName: 'Boston Celtics',
    awayTeamName: 'Los Angeles Lakers',
    commenceTime: '2026-01-15T20:00:00.000Z',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    bookmakers: [
      {
        key: 'draftkings',
        title: 'DraftKings',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'Los Angeles Lakers', price: 150 },
              { name: 'Boston Celtics', price: -170 },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

const NFL_GAME = makeApiGame({
  id: 'game-nyj-buf',
  sportKey: 'americanfootball_nfl',
  sportName: 'NFL',
  homeTeamName: 'Buffalo Bills',
  awayTeamName: 'New York Jets',
  status: 'in_progress',
  homeScore: 14,
  awayScore: 10,
  bookmakers: [{ key: 'fanduel', title: 'FanDuel', markets: [] }],
});

function renderPage() {
  const store = configureStore({
    reducer: {
      betSlip: betSlipReducer,
      clv: clvReducer,
      correlation: correlationReducer,
    },
  });
  return {
    store,
    ...render(
      // Game cards link to the game detail route, so a router is required.
      <Provider store={store}>
        <DarkModeProvider>
          <MemoryRouter>
            <EnhancedDashboard />
          </MemoryRouter>
        </DarkModeProvider>
      </Provider>
    ),
  };
}

/** Resolves `/games` with the standard `{ status, data: { games } }` envelope. */
function withGames(games: ReturnType<typeof makeApiGame>[]) {
  mockApi.get.mockResolvedValue({
    data: { status: 'success', data: { games, count: games.length } },
  });
}

describe('EnhancedDashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withGames([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('requests games for today with the browser timezone offset', async () => {
    renderPage();

    await screen.findByText('0 Games Found');
    const [path, config] = mockApi.get.mock.calls[0];
    expect(path).toBe('/games');
    expect(config.params.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(config.params.timezoneOffset).toBe(new Date().getTimezoneOffset());
  });

  it('shows a loading state before the games arrive', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText('Loading Games...')).toBeInTheDocument();
    expect(screen.queryByText(/Games Found/)).not.toBeInTheDocument();
  });

  it('renders the games returned by the API', async () => {
    withGames([makeApiGame(), NFL_GAME]);

    renderPage();

    expect(await screen.findByText('2 Games Found')).toBeInTheDocument();
    expect(screen.getByText(/Los Angeles Lakers/)).toBeInTheDocument();
    expect(screen.getByText(/Buffalo Bills/)).toBeInTheDocument();
  });

  it('uses the singular heading for exactly one game', async () => {
    withGames([makeApiGame()]);

    renderPage();

    expect(await screen.findByText('1 Game Found')).toBeInTheDocument();
  });

  it('also accepts the flat { games } response shape', async () => {
    mockApi.get.mockResolvedValue({ data: { games: [makeApiGame()] } });

    renderPage();

    expect(await screen.findByText('1 Game Found')).toBeInTheDocument();
  });

  it('treats a response with neither shape as an empty slate', async () => {
    mockApi.get.mockResolvedValue({ data: {} });

    renderPage();

    expect(await screen.findByText('0 Games Found')).toBeInTheDocument();
    expect(screen.getByText('No Games Found')).toBeInTheDocument();
  });

  it('surfaces the API error message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi.get.mockRejectedValue({
      response: { data: { message: 'Odds provider quota exceeded' } },
    });

    renderPage();

    expect(await screen.findByText('Error Loading Games')).toBeInTheDocument();
    expect(screen.getByText('Odds provider quota exceeded')).toBeInTheDocument();
  });

  it('falls back to a generic error when the response has no message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi.get.mockRejectedValue(new Error('Network Error'));

    renderPage();

    expect(await screen.findByText('Failed to load games')).toBeInTheDocument();
  });

  describe('filtering', () => {
    /** The sidebar renders one tile per sport family, keyed by its title. */
    const sportTile = (family: string) => screen.getByTitle(family);

    it('derives one sport tile per family present in the payload', async () => {
      withGames([makeApiGame(), makeApiGame({ id: 'game-2' }), NFL_GAME]);

      renderPage();

      await screen.findByText('3 Games Found');
      expect(sportTile('basketball')).toBeInTheDocument();
      expect(sportTile('football')).toBeInTheDocument();
      // No hockey game came back, so no hockey tile is offered.
      expect(screen.queryByTitle('hockey')).not.toBeInTheDocument();
    });

    it('narrows the board to one sport and reports the total it filtered from', async () => {
      const user = userEvent.setup();
      withGames([makeApiGame(), NFL_GAME]);

      renderPage();
      await screen.findByText('2 Games Found');
      await user.click(sportTile('football'));

      expect(await screen.findByText('1 Game Found')).toBeInTheDocument();
      expect(screen.getByText('(filtered from 2 total)')).toBeInTheDocument();
      expect(screen.getByText(/Buffalo Bills/)).toBeInTheDocument();
      expect(screen.queryByText(/Los Angeles Lakers/)).not.toBeInTheDocument();
    });

    it('restores the full board when the sport is toggled back off', async () => {
      const user = userEvent.setup();
      withGames([makeApiGame(), NFL_GAME]);

      renderPage();
      await screen.findByText('2 Games Found');
      await user.click(sportTile('football'));
      await screen.findByText('1 Game Found');
      await user.click(sportTile('football'));

      expect(await screen.findByText('2 Games Found')).toBeInTheDocument();
      expect(screen.queryByText(/filtered from/)).not.toBeInTheDocument();
    });

    it('filters by status, keeping only in-progress games', async () => {
      const user = userEvent.setup();
      withGames([makeApiGame(), NFL_GAME]);

      renderPage();
      await screen.findByText('2 Games Found');
      await user.click(screen.getByRole('button', { name: /live/i }));

      // Only the NFL fixture carries status 'in_progress'.
      expect(await screen.findByText('1 Game Found')).toBeInTheDocument();
      expect(screen.getByText(/Buffalo Bills/)).toBeInTheDocument();
    });

    it('offers every bookmaker seen across the games, de-duplicated and sorted', async () => {
      withGames([
        makeApiGame(),
        NFL_GAME,
        makeApiGame({
          id: 'game-3',
          bookmakers: [
            { key: 'draftkings', title: 'DraftKings', markets: [] },
            { key: 'betmgm', title: 'BetMGM', markets: [] },
          ],
        }),
      ]);

      renderPage();

      await screen.findByText('3 Games Found');
      const bookmakerSelect = screen.getByRole('combobox') as HTMLSelectElement;
      // draftkings appears on two games but is listed once, after betmgm.
      expect(Array.from(bookmakerSelect.options).map((o) => o.value)).toEqual([
        'all',
        'betmgm',
        'draftkings',
        'fanduel',
      ]);
    });

    it('offers a way out of an over-filtered board', async () => {
      const user = userEvent.setup();
      withGames([makeApiGame()]);

      renderPage();
      await screen.findByText('1 Game Found');
      await user.click(screen.getByRole('button', { name: /final/i }));

      // The one game is scheduled, not final, so nothing matches.
      expect(await screen.findByText('No Games Found')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Clear Filters' }));
      expect(await screen.findByText('1 Game Found')).toBeInTheDocument();
    });

    it('re-fetches when the date changes', async () => {
      withGames([makeApiGame()]);

      const { container } = renderPage();
      await screen.findByText('1 Game Found');
      mockApi.get.mockClear();

      const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
      // A date input takes a whole value at once rather than keystrokes.
      fireEvent.change(dateInput, { target: { value: '2026-02-01' } });

      await vi.waitFor(() => {
        expect(mockApi.get.mock.calls.at(-1)?.[1].params.date).toBe('2026-02-01');
      });
    });
  });

  it('refreshes the board every 30 seconds and stops on unmount', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    withGames([makeApiGame()]);

    const { unmount } = renderPage();
    await vi.waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(30_000);
    expect(mockApi.get).toHaveBeenCalledTimes(2);

    unmount();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mockApi.get).toHaveBeenCalledTimes(2);
  });
});
