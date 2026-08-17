/**
 * Tests for the Line Movement Analytics page.
 *
 * The page owns the filter state and its two-way sync with the URL: each
 * filter change both re-dispatches `fetchLiveMovements` with the new args
 * and updates the search params (non-default values only), and the market
 * filter is applied client-side against whatever the store already holds
 * rather than triggering a new fetch. lineMovementService is mocked;
 * SteamMoveAlert/LineMovementChart/LineMovementPerformance are mocked since
 * they fetch and render their own data independently of this page's filters
 * (chart/timeline internals aren't this page's logic to verify).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import movementReducer from '../store/movementSlice';
import { DarkModeProvider } from '../contexts/DarkModeContext';
import LineMovementAnalytics from './LineMovementAnalytics';
import { makeLineMovement } from '../test/fixtures';

vi.mock('../services/line-movement.service', () => ({
  lineMovementService: {
    getLiveMovements: vi.fn(),
    getGameMovements: vi.fn(),
    getMovementHistory: vi.fn(),
    getBookmakerMovements: vi.fn(),
    getMovementStats: vi.fn(),
    getSteamMoves: vi.fn(),
  },
}));

vi.mock('../components/analytics/SteamMoveAlert', () => ({
  default: () => <div data-testid="steam-move-alert" />,
}));
vi.mock('../components/analytics/LineMovementChart', () => ({
  default: ({ movements }: { movements: unknown[] }) => (
    <div data-testid="line-movement-chart">{movements.length} plotted</div>
  ),
}));
vi.mock('../components/analytics/LineMovementPerformance', () => ({
  default: () => <div data-testid="line-movement-performance" />,
}));

import { lineMovementService } from '../services/line-movement.service';
const mockService = lineMovementService as unknown as Record<string, ReturnType<typeof vi.fn>>;

/** The filter labels aren't wired to their <select> with htmlFor, so scope by the label's parent. */
function selectNear(labelText: string): HTMLElement {
  const label = screen.getByText(labelText);
  return within(label.closest('div') as HTMLElement).getByRole('combobox');
}

function renderPage(initialEntries = ['/analytics/movements']) {
  const store = configureStore({ reducer: { movements: movementReducer } });
  return {
    store,
    ...render(
      <MemoryRouter initialEntries={initialEntries}>
        <Provider store={store}>
          <DarkModeProvider>
            <LineMovementAnalytics />
          </DarkModeProvider>
        </Provider>
      </MemoryRouter>
    ),
  };
}

describe('LineMovementAnalytics page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockService.getLiveMovements.mockResolvedValue({ movements: [], total: 0 });
  });

  it('fetches with the default filters on mount', async () => {
    renderPage();

    expect(mockService.getLiveMovements).toHaveBeenCalledWith(100, 24, 'all');
    expect(await screen.findByText('0 movements')).toBeInTheDocument();
  });

  it('seeds filters from the URL search params', async () => {
    renderPage(['/analytics/movements?type=steam&hours=168&market=spreads']);

    await screen.findByText('0 movements');
    expect(mockService.getLiveMovements).toHaveBeenCalledWith(100, 168, 'steam');
  });

  it('re-fetches when the movement type filter changes', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('0 movements');

    await user.selectOptions(selectNear('MOVEMENT TYPE'), 'reverse');

    expect(mockService.getLiveMovements).toHaveBeenLastCalledWith(100, 24, 'reverse');
  });

  it('re-fetches when the time range changes', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('0 movements');

    await user.selectOptions(selectNear('TIME RANGE'), '168');

    expect(mockService.getLiveMovements).toHaveBeenLastCalledWith(100, 168, 'all');
  });

  it('filters movements by market client-side without an extra fetch', async () => {
    const user = userEvent.setup();
    mockService.getLiveMovements.mockResolvedValue({
      movements: [
        makeLineMovement({ id: 'm-1', marketType: 'spreads' }),
        makeLineMovement({ id: 'm-2', marketType: 'totals' }),
      ],
      total: 2,
    });
    renderPage();
    await screen.findByText('2 movements');
    expect(screen.getByTestId('line-movement-chart')).toHaveTextContent('2 plotted');

    const callsBefore = mockService.getLiveMovements.mock.calls.length;
    await user.selectOptions(selectNear('MARKET TYPE'), 'spreads');

    expect(await screen.findByText('1 movements')).toBeInTheDocument();
    expect(screen.getByTestId('line-movement-chart')).toHaveTextContent('1 plotted');
    expect(mockService.getLiveMovements.mock.calls.length).toBe(callsBefore);
  });

  it('surfaces a load failure', async () => {
    mockService.getLiveMovements.mockRejectedValue({
      response: { data: { error: 'Movement feed unavailable' } },
    });
    renderPage();

    expect(await screen.findByText('Movement feed unavailable')).toBeInTheDocument();
    expect(screen.getByText('ERROR LOADING MOVEMENTS')).toBeInTheDocument();
  });
});
