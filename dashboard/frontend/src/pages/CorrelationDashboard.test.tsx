/**
 * Tests for the Correlation Analysis Dashboard.
 *
 * The page itself is a tab switcher plus the History tab's own fetch/render
 * logic (`fetchCorrelationHistory`, wired to real store state). The other
 * three tabs delegate entirely to child components that manage their own
 * Redux state and API calls (CorrelationHeatmap, HedgeCalculator,
 * CorrelationEducation) — those are mocked here so this file stays about the
 * page's orchestration: which tab renders which child, and the history
 * fetch-on-first-visit / loading / empty / populated states.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import correlationReducer from '../store/correlationSlice';
import { DarkModeProvider } from '../contexts/DarkModeContext';
import CorrelationDashboard from './CorrelationDashboard';
import type { ParlayAnalysis } from '../types/correlation.types';

vi.mock('../services/correlation.service', () => ({
  correlationService: {
    analyzeDraftSlip: vi.fn(),
    getHistory: vi.fn(),
    findHedges: vi.fn(),
    getEducation: vi.fn(),
  },
}));

vi.mock('../components/analytics/CorrelationHeatmap', () => ({
  default: () => <div data-testid="heatmap" />,
}));
vi.mock('../components/analytics/HedgeCalculator', () => ({
  default: () => <div data-testid="hedge-calculator" />,
}));
vi.mock('../components/analytics/CorrelationEducation', () => ({
  default: () => <div data-testid="education" />,
}));

import { correlationService } from '../services/correlation.service';
const mockService = correlationService as unknown as Record<string, ReturnType<typeof vi.fn>>;

function makeAnalysis(overrides: Partial<ParlayAnalysis> = {}): ParlayAnalysis {
  return {
    betLegIds: ['leg-1', 'leg-2'],
    betId: 'bet-1',
    nominalOdds: 250,
    trueOdds: 180,
    oddsDiscrepancy: 70,
    riskLevel: 'medium',
    correlationFlags: [],
    recommendation: 'warning',
    reasoning: 'These legs share a same-game correlation that inflates the parlay price.',
    suggestedFix: null,
    ...overrides,
  };
}

function renderPage() {
  const store = configureStore({ reducer: { correlation: correlationReducer } });
  return {
    store,
    ...render(
      <Provider store={store}>
        <DarkModeProvider>
          <CorrelationDashboard />
        </DarkModeProvider>
      </Provider>
    ),
  };
}

describe('CorrelationDashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the heatmap tab by default without fetching history', () => {
    renderPage();

    expect(screen.getByTestId('heatmap')).toBeInTheDocument();
    expect(mockService.getHistory).not.toHaveBeenCalled();
  });

  it('switches to the hedge calculator tab', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Hedge Calculator' }));

    expect(screen.getByTestId('hedge-calculator')).toBeInTheDocument();
    expect(screen.queryByTestId('heatmap')).not.toBeInTheDocument();
  });

  it('switches to the education tab', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Learn' }));

    expect(screen.getByTestId('education')).toBeInTheDocument();
  });

  describe('history tab', () => {
    it('fetches history only once the tab is visited', async () => {
      const user = userEvent.setup();
      mockService.getHistory.mockResolvedValue({ analyses: [], count: 0 });
      renderPage();
      expect(mockService.getHistory).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'History' }));

      expect(mockService.getHistory).toHaveBeenCalledWith({ limit: 50 });
    });

    it('explains that analyses are saved automatically when there is no history', async () => {
      const user = userEvent.setup();
      mockService.getHistory.mockResolvedValue({ analyses: [], count: 0 });
      renderPage();

      await user.click(screen.getByRole('button', { name: 'History' }));

      expect(
        await screen.findByText(/No parlay analyses yet/)
      ).toBeInTheDocument();
    });

    it('renders a past analysis with its risk badge and odds comparison', async () => {
      const user = userEvent.setup();
      mockService.getHistory.mockResolvedValue({
        analyses: [makeAnalysis()],
        count: 1,
      });
      renderPage();

      await user.click(screen.getByRole('button', { name: 'History' }));

      expect(await screen.findByText(/medium risk · warning/)).toBeInTheDocument();
      expect(screen.getByText('+250 → +180')).toBeInTheDocument();
      expect(
        screen.getByText('These legs share a same-game correlation that inflates the parlay price.')
      ).toBeInTheDocument();
    });

    it('surfaces a history load failure', async () => {
      const user = userEvent.setup();
      mockService.getHistory.mockRejectedValue({
        response: { data: { error: 'History unavailable' } },
      });
      const { store } = renderPage();

      await user.click(screen.getByRole('button', { name: 'History' }));

      // The page has no dedicated error banner for this tab, but the
      // rejection still reaches store state and loading clears correctly.
      await vi.waitFor(() =>
        expect(store.getState().correlation.error).toBe('History unavailable')
      );
      expect(store.getState().correlation.loading).toBe(false);
    });
  });
});
