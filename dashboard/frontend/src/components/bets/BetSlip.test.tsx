/**
 * Example component test - BetSlip component
 * Demonstrates Redux integration and user interaction testing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import BetSlip from '@/components/bets/BetSlip';
import { renderWithProviders, mockGame, waitForAsync } from '@/test/test-utils';
import type { RootState } from '@/store';

describe('BetSlip Component', () => {
  const preloadedState: Partial<RootState> = {
    betSlip: {
      legs: [],
      futureLegs: [],
      betType: 'single',
      stake: 0,
      teaserPoints: 6,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty bet slip message', () => {
    renderWithProviders(<BetSlip />, { preloadedState });
    
    expect(screen.getByText(/click on any odds/i)).toBeInTheDocument();
  });

  it('displays bet legs when added', () => {
    const stateWithBets: Partial<RootState> = {
      betSlip: {
        legs: [
          {
            gameId: mockGame.id,
            selectionType: 'moneyline',
            selection: 'home',
            odds: -110,
            line: null,
            game: mockGame,
          },
        ],
        futureLegs: [],
        betType: 'single',
        stake: 100,
        teaserPoints: 6,
      },
    };

    renderWithProviders(<BetSlip />, { preloadedState: stateWithBets });
    
    expect(screen.getByText(/boston celtics/i)).toBeInTheDocument();
    expect(screen.getByText(/ML/i)).toBeInTheDocument();
    const oddsElements = screen.getAllByText(/-110/);
    expect(oddsElements.length).toBeGreaterThan(0);
  });

  it('calculates potential payout correctly', () => {
    const stateWithBets: Partial<RootState> = {
      betSlip: {
        legs: [
          {
            gameId: mockGame.id,
            selectionType: 'moneyline',
            selection: 'home',
            odds: -110,
            line: null,
            game: mockGame,
          },
        ],
        futureLegs: [],
        betType: 'single',
        stake: 100,
        teaserPoints: 6,
      },
    };

    renderWithProviders(<BetSlip />, { preloadedState: stateWithBets });
    
    // Potential payout for $100 at -110 should be $190.91
    expect(screen.getByText(/\$190\.91/)).toBeInTheDocument();
  });

  it('allows removing bet legs', async () => {
    const stateWithBets: Partial<RootState> = {
      betSlip: {
        legs: [
          {
            gameId: mockGame.id,
            selectionType: 'moneyline',
            selection: 'home',
            odds: -110,
            line: null,
            game: mockGame,
          },
        ],
        futureLegs: [],
        betType: 'single',
        stake: 100,
        teaserPoints: 6,
      },
    };

    renderWithProviders(<BetSlip />, { preloadedState: stateWithBets });
    
    const removeButton = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(removeButton);
    
    await waitForAsync();

    expect(screen.getByText(/click on any odds/i)).toBeInTheDocument();
  });

  it('updates stake when input changes', async () => {
    const stateWithBets: Partial<RootState> = {
      betSlip: {
        legs: [
          {
            gameId: mockGame.id,
            selectionType: 'moneyline',
            selection: 'home',
            odds: -110,
            line: null,
            game: mockGame,
          },
        ],
        futureLegs: [],
        betType: 'single',
        stake: 0,
        teaserPoints: 6,
      },
    };

    renderWithProviders(<BetSlip />, { preloadedState: stateWithBets });
    
    const stakeInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(stakeInput, { target: { value: '50' } });
    
    await waitForAsync();

    expect(stakeInput).toHaveValue('50');
  });

  it('disables place bet button when stake is zero', () => {
    const stateWithBets: Partial<RootState> = {
      betSlip: {
        legs: [
          {
            gameId: mockGame.id,
            selectionType: 'moneyline',
            selection: 'home',
            odds: -110,
            line: null,
            game: mockGame,
          },
        ],
        futureLegs: [],
        betType: 'single',
        stake: 0,
        teaserPoints: 6,
      },
    };

    renderWithProviders(<BetSlip />, { preloadedState: stateWithBets });
    
    const placeBetButton = screen.getByRole('button', { name: /place bet/i });
    expect(placeBetButton).toBeDisabled();
  });

  it.skip('enables place bet button when stake is set (requires bet name)', () => {
    const stateWithBets: Partial<RootState> = {
      betSlip: {
        legs: [
          {
            gameId: mockGame.id,
            selectionType: 'moneyline',
            selection: 'home',
            odds: -110,
            line: null,
            game: mockGame,
          },
        ],
        futureLegs: [],
        betType: 'single',
        stake: 100,
        teaserPoints: 6,
      },
    };

    renderWithProviders(<BetSlip />, { preloadedState: stateWithBets });
    
    const placeBetButton = screen.getByRole('button', { name: /place bet/i });
    expect(placeBetButton).not.toBeDisabled();
  });
});
