/**
 * Tests for the Team Detail page.
 *
 * Small page, but it does real work: it decodes a URI-encoded team name from
 * the route before handing it to TeamStatsView, and it guards against a
 * missing param pair. TeamStatsView is mocked (it owns its own large data
 * fetch) so this file can assert on exactly what params reach it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import TeamDetail from './TeamDetail';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../components/stats/TeamStatsView', () => ({
  default: ({ league, teamName }: { league: string; teamName: string }) => (
    <div data-testid="team-stats-view">{`${league}:${teamName}`}</div>
  ),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/teams/:league/:teamName" element={<TeamDetail />} />
        <Route path="/teams" element={<TeamDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TeamDetail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('decodes a URI-encoded team name before passing it down', () => {
    renderAt('/teams/basketball_nba/Los%20Angeles%20Lakers');

    expect(screen.getByTestId('team-stats-view')).toHaveTextContent(
      'basketball_nba:Los Angeles Lakers'
    );
  });

  it('passes the league through unmodified', () => {
    renderAt('/teams/americanfootball_nfl/Buffalo%20Bills');

    expect(screen.getByTestId('team-stats-view')).toHaveTextContent(
      'americanfootball_nfl:Buffalo Bills'
    );
  });

  it('shows an invalid-team message when the route params are missing', () => {
    renderAt('/teams');

    expect(screen.getByText('Invalid Team')).toBeInTheDocument();
    expect(screen.getByText('League and team name are required')).toBeInTheDocument();
    expect(screen.queryByTestId('team-stats-view')).not.toBeInTheDocument();
  });

  it('navigates back one entry when Back is clicked', async () => {
    const user = userEvent.setup();
    renderAt('/teams/basketball_nba/Boston%20Celtics');

    await user.click(screen.getByRole('button', { name: /Back/ }));

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
