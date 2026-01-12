/**
 * Test utilities for rendering components with Redux store and providers
 */

import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import type { PreloadedState } from '@reduxjs/toolkit';
import betSlipReducer from '../store/betSlipSlice';
import type { RootState } from '../store';

interface ExtendedRenderOptions extends Omit<RenderOptions, 'queries'> {
  preloadedState?: PreloadedState<RootState>;
  store?: ReturnType<typeof configureStore>;
}

/**
 * Render component with Redux store and Router
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState = {},
    store = configureStore({
      reducer: {
        betSlip: betSlipReducer,
      },
      preloadedState,
    }),
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </Provider>
    );
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

/**
 * Create a mock Redux store for testing
 */
export function createMockStore(preloadedState?: PreloadedState<RootState>) {
  return configureStore({
    reducer: {
      betSlip: betSlipReducer,
    },
    preloadedState,
  });
}

/**
 * Mock game data for testing
 */
export const mockGame = {
  id: 'test-game-1',
  sportKey: 'basketball_nba',
  sportId: 'basketball_nba',
  sportName: 'NBA Basketball',
  externalId: 'ext-123',
  awayTeamName: 'Los Angeles Lakers',
  homeTeamName: 'Boston Celtics',
  commenceTime: new Date('2026-01-15T19:00:00Z'),
  status: 'scheduled' as const,
  awayScore: null,
  homeScore: null,
  completed: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Mock odds snapshot for testing
 */
export const mockOddsSnapshot = {
  id: 'odds-1',
  gameId: 'test-game-1',
  bookmaker: 'draftkings',
  marketType: 'h2h',
  outcomeType: 'home',
  price: -110,
  point: null,
  timestamp: new Date(),
};

/**
 * Mock bet for testing
 */
export const mockBet = {
  id: 'bet-1',
  name: 'Test Bet',
  betType: 'single' as const,
  stake: 100,
  oddsAtPlacement: -110,
  potentialPayout: 190.91,
  status: 'pending' as const,
  placedAt: new Date(),
  settledAt: null,
  actualPayout: null,
  legs: [
    {
      id: 'leg-1',
      betId: 'bet-1',
      gameId: 'test-game-1',
      selectionType: 'moneyline' as const,
      selection: 'home',
      odds: -110,
      line: null,
      status: 'pending' as const,
      result: null,
      game: mockGame,
    },
  ],
};

/**
 * Wait for async updates (useful for testing async actions)
 */
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));
