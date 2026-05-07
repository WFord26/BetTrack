/**
 * Tests for useBetSlip custom hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useBetSlip } from './useBetSlip';
import betSlipReducer from '../store/betSlipSlice';
import clvReducer from '../store/clvSlice';
import { mockGame } from '../test/test-utils';
import type { ReactNode } from 'react';

// Mock API
vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    defaults: { baseURL: 'http://localhost:3001/api' },
  },
}));

import api from '../services/api';
const mockedApi = api as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; defaults: { baseURL: string } };

function createWrapper() {
  const store = configureStore({
    reducer: { betSlip: betSlipReducer, clv: clvReducer },
  });
  return {
    store,
    wrapper: ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    ),
  };
}

describe('useBetSlip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with empty state', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useBetSlip(), { wrapper });

    expect(result.current.legs).toEqual([]);
    expect(result.current.betType).toBe('single');
    expect(result.current.stake).toBe(0);
    expect(result.current.isValid).toBe(false);
  });

  it('adds a leg', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useBetSlip(), { wrapper });

    const leg = {
      gameId: mockGame.id,
      selectionType: 'moneyline' as const,
      selection: 'home' as const,
      odds: -110,
      line: null,
      game: mockGame,
    };

    act(() => {
      result.current.addLeg(leg);
    });

    expect(result.current.legs).toHaveLength(1);
    expect(result.current.legs[0]).toEqual(leg);
  });

  it('removes a leg by index', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useBetSlip(), { wrapper });

    const leg = {
      gameId: mockGame.id,
      selectionType: 'moneyline' as const,
      selection: 'home' as const,
      odds: -110,
      line: null,
      game: mockGame,
    };

    act(() => {
      result.current.addLeg(leg);
    });

    expect(result.current.legs).toHaveLength(1);

    act(() => {
      result.current.removeLeg(0);
    });

    expect(result.current.legs).toHaveLength(0);
  });

  it('updates stake', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useBetSlip(), { wrapper });

    act(() => {
      result.current.setStake(100);
    });

    expect(result.current.stake).toBe(100);
  });

  it('updates bet type', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useBetSlip(), { wrapper });

    act(() => {
      result.current.setBetType('parlay');
    });

    expect(result.current.betType).toBe('parlay');
  });

  it('clears the slip', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useBetSlip(), { wrapper });

    const leg = {
      gameId: mockGame.id,
      selectionType: 'moneyline' as const,
      selection: 'home' as const,
      odds: -110,
      line: null,
      game: mockGame,
    };

    act(() => {
      result.current.addLeg(leg);
      result.current.setStake(100);
    });

    act(() => {
      result.current.clearSlip();
    });

    expect(result.current.legs).toHaveLength(0);
    expect(result.current.stake).toBe(0);
  });

  it('calculates combined odds for parlay', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useBetSlip(), { wrapper });

    const leg1 = {
      gameId: 'game-1',
      selectionType: 'moneyline' as const,
      selection: 'home' as const,
      odds: -110,
      line: null,
      game: { ...mockGame, id: 'game-1' },
    };

    const leg2 = {
      gameId: 'game-2',
      selectionType: 'moneyline' as const,
      selection: 'away' as const,
      odds: -110,
      line: null,
      game: { ...mockGame, id: 'game-2' },
    };

    act(() => {
      result.current.setBetType('parlay');
      result.current.addLeg(leg1);
      result.current.addLeg(leg2);
      result.current.setStake(100);
    });

    // Two -110 legs parlayed: decimal odds ≈ 1.909 * 1.909 ≈ 3.645
    expect(result.current.combinedOdds).toBeDefined();
    expect(result.current.potentialPayout).toBeGreaterThan(0);
  });

  it('submits a bet via API', async () => {
    mockedApi.post.mockResolvedValue({
      data: { success: true, data: { id: 'new-bet-1' } },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useBetSlip(), { wrapper });

    const leg = {
      gameId: mockGame.id,
      selectionType: 'moneyline' as const,
      selection: 'home' as const,
      odds: -110,
      line: null,
      game: mockGame,
    };

    act(() => {
      result.current.addLeg(leg);
      result.current.setStake(100);
    });

    await act(async () => {
      await result.current.submitBet({ name: 'My Test Bet' });
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/bets', expect.objectContaining({
      name: 'My Test Bet',
    }));
  });

  it('sets submit error on API failure', async () => {
    mockedApi.post.mockRejectedValue(new Error('Network error'));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useBetSlip(), { wrapper });

    const leg = {
      gameId: mockGame.id,
      selectionType: 'moneyline' as const,
      selection: 'home' as const,
      odds: -110,
      line: null,
      game: mockGame,
    };

    act(() => {
      result.current.addLeg(leg);
      result.current.setStake(100);
    });

    await act(async () => {
      await result.current.submitBet({ name: 'My Test Bet' });
    });

    expect(result.current.submitError).toBeTruthy();
  });
});
