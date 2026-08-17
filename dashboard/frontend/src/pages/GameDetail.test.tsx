/**
 * Tests for the Game Detail page.
 *
 * Real logic worth covering: the invalid-gameId guard (`useParams` with no
 * match), the API-shape transform in `fetchGame` (unwraps `data.data`,
 * derives `completed`/sport key/name from nested fields), and the
 * live/final/scheduled status badges and score visibility rules. Rendered
 * inside a MemoryRouter so `useParams` resolves; GameStatsPanel is mocked
 * since it does its own independent data fetching via `useGameStats`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import GameDetail from './GameDetail';

vi.mock('../services/api', () => ({
  default: { get: vi.fn() },
}));

vi.mock('../components/stats/GameStatsPanel', () => ({
  default: ({ gameId, isLive }: { gameId: string; isLive: boolean }) => (
    <div data-testid="game-stats-panel">{`stats for ${gameId} live=${isLive}`}</div>
  ),
}));

import api from '../services/api';
const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };

const SCHEDULED_GAME = {
  id: 'game-lal-bos',
  sport: { key: 'basketball_nba', name: 'NBA Basketball' },
  awayTeamId: 'team-lal',
  homeTeamId: 'team-bos',
  awayTeamName: 'Los Angeles Lakers',
  homeTeamName: 'Boston Celtics',
  commenceTime: '2026-01-20T20:00:00.000Z',
  status: 'scheduled',
  venue: 'TD Garden',
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/games/:gameId" element={<GameDetail />} />
        <Route path="/no-id" element={<GameDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('GameDetail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an invalid-game message when no gameId param is present', () => {
    renderAt('/no-id');

    expect(screen.getByText('Invalid Game')).toBeInTheDocument();
    expect(screen.getByText('Game ID not provided')).toBeInTheDocument();
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('shows a loading state before the game resolves', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    renderAt('/games/game-lal-bos');

    expect(screen.getByText('Loading game details...')).toBeInTheDocument();
  });

  it('fetches by the id from the route and renders both team names', async () => {
    mockApi.get.mockResolvedValue({ data: { data: SCHEDULED_GAME } });
    renderAt('/games/game-lal-bos');

    expect(await screen.findByText('Los Angeles Lakers')).toBeInTheDocument();
    expect(screen.getByText('Boston Celtics')).toBeInTheDocument();
    expect(mockApi.get).toHaveBeenCalledWith('/games/game-lal-bos');
    expect(screen.getByText('📍 TD Garden')).toBeInTheDocument();
  });

  it('shows the game time rather than scores for a scheduled game', async () => {
    mockApi.get.mockResolvedValue({ data: { data: SCHEDULED_GAME } });
    renderAt('/games/game-lal-bos');

    await screen.findByText('Los Angeles Lakers');
    expect(screen.getByText('Game Time')).toBeInTheDocument();
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
    expect(screen.queryByText('FINAL')).not.toBeInTheDocument();
  });

  it('shows the LIVE badge and both scores for an in-progress game', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        data: { ...SCHEDULED_GAME, status: 'in_progress', homeScore: 58, awayScore: 61 },
      },
    });
    renderAt('/games/game-lal-bos');

    expect(await screen.findByText('LIVE')).toBeInTheDocument();
    expect(screen.getByText('61')).toBeInTheDocument();
    expect(screen.getByText('58')).toBeInTheDocument();
    expect(screen.getByTestId('game-stats-panel')).toHaveTextContent(
      'stats for game-lal-bos live=true'
    );
  });

  it('shows the FINAL badge for a completed game and marks it completed', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        data: { ...SCHEDULED_GAME, status: 'final', homeScore: 110, awayScore: 101 },
      },
    });
    renderAt('/games/game-lal-bos');

    expect(await screen.findByText('FINAL')).toBeInTheDocument();
    expect(screen.getByText('110')).toBeInTheDocument();
    expect(screen.getByText('101')).toBeInTheDocument();
  });

  it('unwraps a response with no data envelope', async () => {
    mockApi.get.mockResolvedValue({ data: SCHEDULED_GAME });
    renderAt('/games/game-lal-bos');

    expect(await screen.findByText('Los Angeles Lakers')).toBeInTheDocument();
  });

  it('shows an error message and a way back when the fetch fails', async () => {
    mockApi.get.mockRejectedValue(new Error('network down'));
    renderAt('/games/game-lal-bos');

    expect(await screen.findByText('Failed to load game details')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument();
  });
});
