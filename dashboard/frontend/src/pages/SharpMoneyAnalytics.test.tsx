/**
 * Tests for the Sharp vs Public page.
 *
 * The page's own logic is in the small mapping helpers — resolving a
 * `sharpSide` of 'home'/'away' to the actual team name, turning a market key
 * into a label, picking a movement icon — plus the tab/filter effect that
 * decides which thunk runs. These tests exercise those through rendered text.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import sharpReducer from '../store/sharpSlice';
import { DarkModeProvider } from '../contexts/DarkModeContext';
import SharpMoneyAnalytics from './SharpMoneyAnalytics';
import { makeSharpIndicator, makeContrarianOpportunity, SHARP_STATS } from '../test/fixtures';

vi.mock('../services/sharp.service', () => ({
  sharpService: {
    getLiveIndicators: vi.fn(),
    getGameIndicators: vi.fn(),
    getContrarianOpportunities: vi.fn(),
    getStats: vi.fn(),
  },
}));

import { sharpService } from '../services/sharp.service';
const mockService = sharpService as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderPage() {
  const store = configureStore({ reducer: { sharp: sharpReducer } });
  return {
    store,
    ...render(
      <Provider store={store}>
        <DarkModeProvider>
          <SharpMoneyAnalytics />
        </DarkModeProvider>
      </Provider>
    ),
  };
}

function withIndicators(indicators: ReturnType<typeof makeSharpIndicator>[]) {
  mockService.getLiveIndicators.mockResolvedValue({
    indicators,
    count: indicators.length,
  });
}

describe('SharpMoneyAnalytics page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withIndicators([]);
    mockService.getContrarianOpportunities.mockResolvedValue({ opportunities: [], count: 0 });
    mockService.getStats.mockResolvedValue(SHARP_STATS);
  });

  it('loads 24-hour stats and the live indicators on mount', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'SHARP VS PUBLIC' })).toBeInTheDocument();
    expect(mockService.getStats).toHaveBeenCalledWith(24);
    expect(mockService.getLiveIndicators).toHaveBeenCalledWith(20);
    expect(mockService.getContrarianOpportunities).not.toHaveBeenCalled();
  });

  it('summarises the stats, reading the movement counters by key', async () => {
    renderPage();

    expect(await screen.findByText('41')).toBeInTheDocument(); // totalIndicators
    expect(screen.getByText('6.4/10')).toBeInTheDocument(); // avgConfidence
    expect(screen.getByText('9')).toBeInTheDocument(); // byLineMovement.steam
    expect(screen.getByText('11')).toBeInTheDocument(); // byLineMovement.reverse
  });

  it('falls back to zero for a movement bucket the backend omits', async () => {
    mockService.getStats.mockResolvedValue({
      ...SHARP_STATS,
      byLineMovement: { gradual: 3 },
    });
    renderPage();

    await screen.findByText('STEAM MOVES');
    const steamTile = screen.getByText('STEAM MOVES').parentElement!;
    expect(within(steamTile).getByText('0')).toBeInTheDocument();
  });

  it('hides the stats strip when no stats are available', async () => {
    mockService.getStats.mockResolvedValue(null);
    renderPage();

    await screen.findByRole('heading', { name: 'SHARP VS PUBLIC' });
    expect(screen.queryByText('INDICATORS')).not.toBeInTheDocument();
  });

  describe('live indicators tab', () => {
    it('explains the empty state and the calculation cadence', async () => {
      renderPage();

      expect(await screen.findByText('NO SHARP ACTIVITY')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Sharp indicators are calculated every 15 minutes from line movement data.'
        )
      ).toBeInTheDocument();
    });

    it('resolves the sharp and public sides to real team names', async () => {
      withIndicators([makeSharpIndicator()]);
      renderPage();

      expect(
        await screen.findByText('Los Angeles Lakers @ Boston Celtics')
      ).toBeInTheDocument();
      // sharpSide 'away' and publicSide 'home' must render as the teams, not
      // as the raw enum values.
      const sharpTile = screen.getByText('SHARP $').parentElement!;
      expect(within(sharpTile).getByText('Los Angeles Lakers')).toBeInTheDocument();
      const publicTile = screen.getByText('PUBLIC').parentElement!;
      expect(within(publicTile).getByText('Boston Celtics')).toBeInTheDocument();
    });

    it('capitalises an over/under side that has no team to name', async () => {
      withIndicators([
        makeSharpIndicator({ marketType: 'totals', sharpSide: 'under', publicSide: 'over' }),
      ]);
      renderPage();

      const sharpTile = (await screen.findByText('SHARP $')).parentElement!;
      expect(within(sharpTile).getByText('Under')).toBeInTheDocument();
      const publicTile = screen.getByText('PUBLIC').parentElement!;
      expect(within(publicTile).getByText('Over')).toBeInTheDocument();
    });

    it('labels the market and confidence', async () => {
      withIndicators([makeSharpIndicator({ marketType: 'h2h', sharpConfidence: 9 })]);
      renderPage();

      expect(await screen.findByText('Moneyline')).toBeInTheDocument();
      expect(screen.getByText('9/10 CONF')).toBeInTheDocument();
    });

    it('describes the line movement in words', async () => {
      withIndicators([makeSharpIndicator({ lineMovement: 'steam' })]);
      renderPage();

      expect(await screen.findByText('Steam move')).toBeInTheDocument();
    });

    it('spells out the absence of movement rather than saying "No_movement move"', async () => {
      withIndicators([makeSharpIndicator({ lineMovement: 'no_movement' })]);
      renderPage();

      expect(await screen.findByText('No line movement')).toBeInTheDocument();
    });

    it('renders contraindicators with underscores replaced', async () => {
      withIndicators([
        makeSharpIndicator({ contraindicators: ['low_volume', 'injury_news_pending'] }),
      ]);
      renderPage();

      expect(await screen.findByText(/low volume, injury news pending/)).toBeInTheDocument();
    });

    it('omits the contraindicator line when there are none', async () => {
      withIndicators([makeSharpIndicator({ contraindicators: [] })]);
      renderPage();

      await screen.findByText('Los Angeles Lakers @ Boston Celtics');
      expect(screen.queryByText(/⚠️/)).not.toBeInTheDocument();
    });

    it('re-fetches with a new page size when SHOW changes', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByLabelText('SHOW:');
      await user.selectOptions(screen.getByLabelText('SHOW:'), '50');

      expect(mockService.getLiveIndicators).toHaveBeenLastCalledWith(50);
    });
  });

  describe('contrarian tab', () => {
    it('switches thunks when the tab changes', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByRole('button', { name: 'CONTRARIAN PICKS' });
      await user.click(screen.getByRole('button', { name: 'CONTRARIAN PICKS' }));

      expect(mockService.getContrarianOpportunities).toHaveBeenCalledWith(6, 20);
    });

    it('suggests lowering the threshold when nothing qualifies', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByRole('button', { name: 'CONTRARIAN PICKS' });
      await user.click(screen.getByRole('button', { name: 'CONTRARIAN PICKS' }));

      expect(await screen.findByText('NO CONTRARIAN OPPORTUNITIES')).toBeInTheDocument();
      expect(
        screen.getByText('Try lowering the minimum confidence threshold.')
      ).toBeInTheDocument();
    });

    it('renders an opportunity with its indicator rows', async () => {
      const user = userEvent.setup();
      mockService.getContrarianOpportunities.mockResolvedValue({
        opportunities: [
          makeContrarianOpportunity({
            indicators: [
              makeSharpIndicator({ id: 'i1', marketType: 'spreads', sharpSide: 'away' }),
              makeSharpIndicator({ id: 'i2', marketType: 'h2h', sharpSide: 'home' }),
            ],
            maxConfidence: 9,
          }),
        ],
        count: 1,
      });
      renderPage();

      await screen.findByRole('button', { name: 'CONTRARIAN PICKS' });
      await user.click(screen.getByRole('button', { name: 'CONTRARIAN PICKS' }));

      expect(
        await screen.findByText('Los Angeles Lakers @ Boston Celtics')
      ).toBeInTheDocument();
      expect(screen.getByText('9/10')).toBeInTheDocument();
      expect(screen.getByText('Spread')).toBeInTheDocument();
      expect(screen.getByText('Moneyline')).toBeInTheDocument();
      // Each row names the side the sharp money is on, by team.
      expect(screen.getByText('SHARP → Los Angeles Lakers')).toBeInTheDocument();
      expect(screen.getByText('SHARP → Boston Celtics')).toBeInTheDocument();
    });

    it('re-queries when the minimum confidence filter changes', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByRole('button', { name: 'CONTRARIAN PICKS' });
      await user.click(screen.getByRole('button', { name: 'CONTRARIAN PICKS' }));
      await user.selectOptions(await screen.findByLabelText('MIN CONF:'), '8');

      expect(mockService.getContrarianOpportunities).toHaveBeenLastCalledWith(8, 20);
    });

    it('offers the confidence filter only on the contrarian tab', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByRole('button', { name: 'CONTRARIAN PICKS' });
      expect(screen.queryByLabelText('MIN CONF:')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'CONTRARIAN PICKS' }));
      expect(await screen.findByLabelText('MIN CONF:')).toBeInTheDocument();
    });
  });

  it('shows the backend error message when a fetch fails', async () => {
    mockService.getLiveIndicators.mockRejectedValue({
      response: { data: { error: 'Sharp indicator job has not run' } },
    });
    renderPage();

    expect(await screen.findByText('Sharp indicator job has not run')).toBeInTheDocument();
  });

  it('always documents how to read the signals', async () => {
    renderPage();

    expect(await screen.findByText('READING THE SIGNS')).toBeInTheDocument();
    expect(screen.getByText('Steam Move:')).toBeInTheDocument();
    expect(screen.getByText('Reverse Line:')).toBeInTheDocument();
  });
});
