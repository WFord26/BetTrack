/**
 * Tests for useGameStats custom hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGameStats } from './useGameStats';

// Mock the API service
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    defaults: { baseURL: 'http://localhost:3001/api' },
  },
}));

import api from '../services/api';
const mockedApi = vi.mocked(api);

const mockStatsData = {
  teamStats: [
    {
      id: 'ts-1',
      teamId: 1,
      isHome: true,
      quarterScores: [21, 14, 7, 10],
      stats: { totalYards: 350 },
      team: { id: 1, name: 'Home Team', abbreviation: 'HT', logoUrl: null },
    },
    {
      id: 'ts-2',
      teamId: 2,
      isHome: false,
      quarterScores: [14, 7, 21, 7],
      stats: { totalYards: 290 },
      team: { id: 2, name: 'Away Team', abbreviation: 'AT', logoUrl: null },
    },
  ],
  playerStats: [],
};

describe('useGameStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in loading state', () => {
    mockedApi.get.mockReturnValue(new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useGameStats('game-1'));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('fetches game stats successfully', async () => {
    mockedApi.get.mockResolvedValue({
      data: { success: true, data: mockStatsData },
    });

    const { result } = renderHook(() => useGameStats('game-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockStatsData);
    expect(result.current.error).toBeNull();
    expect(mockedApi.get).toHaveBeenCalledWith('/stats/game/game-1');
  });

  it('sets error when API returns success=false', async () => {
    mockedApi.get.mockResolvedValue({
      data: { success: false, error: 'Game stats not found' },
    });

    const { result } = renderHook(() => useGameStats('game-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Game stats not found');
  });

  it('sets error when API throws', async () => {
    mockedApi.get.mockRejectedValue({ message: 'Network error' });

    const { result } = renderHook(() => useGameStats('game-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeTruthy();
  });

  it('does not fetch when gameId is empty', async () => {
    const { result } = renderHook(() => useGameStats(''));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockedApi.get).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it('provides a refetch function', async () => {
    mockedApi.get.mockResolvedValue({
      data: { success: true, data: mockStatsData },
    });

    const { result } = renderHook(() => useGameStats('game-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Reset mock and call refetch
    mockedApi.get.mockResolvedValue({
      data: { success: true, data: { ...mockStatsData, playerStats: [] } },
    });

    await result.current.refetch();

    expect(mockedApi.get).toHaveBeenCalledTimes(2);
  });
});
