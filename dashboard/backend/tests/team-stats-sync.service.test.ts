/**
 * Team season stats (`/teams/statistics`) sync, end to end from the sport-key
 * dispatch in StatsSyncService down to the TeamStats write.
 *
 * The four sports added here — NBA, NCAAB, NHL and soccer — each sit on a
 * different API-Sports host, and the hosts disagree about the team query
 * param, the season label, and the payload shape. The fixtures below mirror
 * the real responses, so the assertions pin the mapping rather than the code's
 * own idea of it.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

jest.mock('../src/config/env', () => ({
  env: { API_SPORTS_KEY: 'test-api-sports-key', API_SPORTS_TIER: 'mega' },
}));

jest.mock('../src/config/database', () => ({
  prisma: {
    team: { findFirst: jest.fn() },
    teamStats: { upsert: jest.fn() },
  },
}));

import { StatsSyncService } from '../src/services/stats-sync.service';
import { ApiSportsClient } from '../src/services/api-sports/client';
import { prisma } from '../src/config/database';

const mockPrisma = prisma as any;

/** A basketball-host `/teams/statistics` response (NBA league 12). */
const BASKETBALL_STATS = {
  response: {
    league: { id: 12, name: 'NBA', season: '2024-2025' },
    team: { id: 139, name: 'Boston Celtics' },
    games: {
      played: { home: 41, away: 41, all: 82 },
      wins: {
        home: { total: 30, percentage: '0.732' },
        away: { total: 27, percentage: '0.659' },
        all: { total: 57, percentage: '0.695' },
      },
      draws: {
        home: { total: 0, percentage: '0.000' },
        away: { total: 0, percentage: '0.000' },
        all: { total: 0, percentage: '0.000' },
      },
      loses: {
        home: { total: 11, percentage: '0.268' },
        away: { total: 14, percentage: '0.341' },
        all: { total: 25, percentage: '0.305' },
      },
    },
    points: {
      for: {
        total: { home: 4823, away: 4712, all: 9535 },
        average: { home: '117.6', away: '114.9', all: '116.3' },
      },
      against: {
        total: { home: 4392, away: 4501, all: 8893 },
        average: { home: '107.1', away: '109.8', all: '108.5' },
      },
    },
  },
};

/** A hockey-host `/teams/statistics` response (NHL league 57). */
const HOCKEY_STATS = {
  response: {
    league: { id: 57, name: 'NHL', season: 2024 },
    team: { id: 1, name: 'Boston Bruins' },
    games: {
      played: { home: 41, away: 41, all: 82 },
      wins: {
        home: { total: 26, percentage: '0.634' },
        away: { total: 21, percentage: '0.512' },
        all: { total: 47, percentage: '0.573' },
      },
      wins_overtime: {
        home: { total: 3, percentage: '0.073' },
        away: { total: 3, percentage: '0.073' },
        all: { total: 6, percentage: '0.073' },
      },
      loses: {
        home: { total: 10, percentage: '0.244' },
        away: { total: 10, percentage: '0.244' },
        all: { total: 20, percentage: '0.244' },
      },
      loses_overtime: {
        home: { total: 4, percentage: '0.098' },
        away: { total: 5, percentage: '0.122' },
        all: { total: 9, percentage: '0.110' },
      },
      draws: {
        home: { total: 0, percentage: '0.000' },
        away: { total: 0, percentage: '0.000' },
        all: { total: 0, percentage: '0.000' },
      },
    },
    goals: {
      for: {
        total: { home: 143, away: 124, all: 267 },
        average: { home: '3.5', away: '3.0', all: '3.3' },
      },
      against: {
        total: { home: 105, away: 129, all: 234 },
        average: { home: '2.6', away: '3.1', all: '2.9' },
      },
    },
  },
};

/** An API-Football `/teams/statistics` response (EPL league 39). */
const SOCCER_STATS = {
  response: {
    league: { id: 39, name: 'Premier League', season: 2024 },
    team: { id: 33, name: 'Manchester United' },
    form: 'WDLWW',
    fixtures: {
      played: { home: 19, away: 19, total: 38 },
      wins: { home: 14, away: 9, total: 23 },
      draws: { home: 3, away: 4, total: 7 },
      loses: { home: 2, away: 6, total: 8 },
    },
    goals: {
      for: {
        total: { home: 32, away: 25, total: 57 },
        average: { home: '1.7', away: '1.3', total: '1.5' },
      },
      against: {
        total: { home: 18, away: 25, total: 43 },
        average: { home: '0.9', away: '1.3', total: '1.1' },
      },
    },
    clean_sheet: { home: 8, away: 5, total: 13 },
    failed_to_score: { home: 2, away: 5, total: 7 },
    penalty: {
      scored: { total: 5, percentage: '83.33%' },
      missed: { total: 1, percentage: '16.67%' },
      total: 6,
    },
  },
};

let apiGet: jest.SpiedFunction<typeof ApiSportsClient.prototype.get>;
let service: StatsSyncService;

/** The `data` half of the single teamStats.upsert call under test. */
function upsertedStats() {
  expect(mockPrisma.teamStats.upsert).toHaveBeenCalledTimes(1);
  return (mockPrisma.teamStats.upsert.mock.calls[0][0] as any).create;
}

beforeEach(() => {
  jest.clearAllMocks();
  apiGet = jest.spyOn(ApiSportsClient.prototype, 'get');
  service = new StatsSyncService();
});

afterEach(() => {
  apiGet.mockRestore();
});

describe('StatsSyncService.syncTeamSeasonStats — NBA', () => {
  beforeEach(() => {
    apiGet.mockResolvedValue(BASKETBALL_STATS as any);
    mockPrisma.team.findFirst.mockResolvedValue({ id: 7 });
  });

  it('queries the basketball host by `team` with a year-pair season label', async () => {
    await service.syncTeamSeasonStats('basketball_nba', 139, 2024);

    expect(apiGet).toHaveBeenCalledWith('/teams/statistics', {
      team: 139,
      season: '2024-2025',
      league: 12,
    });
  });

  it('resolves the team by its API-Sports id within the NBA', async () => {
    await service.syncTeamSeasonStats('basketball_nba', 139, 2024);

    expect(mockPrisma.team.findFirst).toHaveBeenCalledWith({
      where: { apiSportsTeamId: 139, sport: { key: 'basketball_nba' } },
    });
  });

  it('splits points for and against into the offense and defense columns', async () => {
    await service.syncTeamSeasonStats('basketball_nba', 139, 2024);

    expect(upsertedStats()).toEqual({
      teamId: 7,
      sportKey: 'basketball_nba',
      season: 2024,
      seasonType: 'regular',
      offense: {
        points: 9535,
        pointsPerGame: 116.3,
        pointsHome: 4823,
        pointsAway: 4712,
      },
      defense: {
        pointsAllowed: 8893,
        pointsAllowedPerGame: 108.5,
        pointsAllowedHome: 4392,
        pointsAllowedAway: 4501,
      },
      standings: {
        wins: 57,
        losses: 25,
        ties: 0,
        winPct: 0.695,
        homeWins: 30,
        awayWins: 27,
      },
      gamesPlayed: 82,
    });
  });

  it('writes nothing when the team is not in the database', async () => {
    mockPrisma.team.findFirst.mockResolvedValue(null);

    await service.syncTeamSeasonStats('basketball_nba', 139, 2024);

    expect(mockPrisma.teamStats.upsert).not.toHaveBeenCalled();
  });

  it('writes nothing when the host returns an empty response', async () => {
    apiGet.mockResolvedValue({ response: [] } as any);

    await service.syncTeamSeasonStats('basketball_nba', 139, 2024);

    expect(mockPrisma.teamStats.upsert).not.toHaveBeenCalled();
  });
});

describe('StatsSyncService.syncTeamSeasonStats — NCAAB', () => {
  it('shares the basketball season format but keeps its own league and sport key', async () => {
    apiGet.mockResolvedValue(BASKETBALL_STATS as any);
    mockPrisma.team.findFirst.mockResolvedValue({ id: 9 });

    await service.syncTeamSeasonStats('basketball_ncaab', 152, 2024);

    expect(apiGet).toHaveBeenCalledWith('/teams/statistics', {
      team: 152,
      season: '2024-2025',
      league: 127,
    });
    expect(upsertedStats()).toEqual(
      expect.objectContaining({ teamId: 9, sportKey: 'basketball_ncaab', season: 2024 })
    );
  });
});

describe('StatsSyncService.syncTeamSeasonStats — NHL', () => {
  beforeEach(() => {
    apiGet.mockResolvedValue(HOCKEY_STATS as any);
    mockPrisma.team.findFirst.mockResolvedValue({ id: 3 });
  });

  it('queries the hockey host by `team` with a single-year season', async () => {
    await service.syncTeamSeasonStats('icehockey_nhl', 1, 2024);

    expect(apiGet).toHaveBeenCalledWith('/teams/statistics', {
      team: 1,
      season: '2024',
      league: 57,
    });
  });

  it('maps goals for and against and keeps overtime results out of the regulation record', async () => {
    await service.syncTeamSeasonStats('icehockey_nhl', 1, 2024);

    expect(upsertedStats()).toEqual({
      teamId: 3,
      sportKey: 'icehockey_nhl',
      season: 2024,
      seasonType: 'regular',
      offense: {
        goals: 267,
        goalsPerGame: 3.3,
        goalsHome: 143,
        goalsAway: 124,
      },
      defense: {
        goalsAgainst: 234,
        goalsAgainstPerGame: 2.9,
        goalsAgainstHome: 105,
        goalsAgainstAway: 129,
      },
      standings: {
        wins: 47,
        losses: 20,
        overtimeWins: 6,
        overtimeLosses: 9,
        ties: 0,
        winPct: 0.573,
      },
      gamesPlayed: 82,
    });
  });
});

describe('StatsSyncService.syncTeamSeasonStats — soccer', () => {
  beforeEach(() => {
    apiGet.mockResolvedValue(SOCCER_STATS as any);
    mockPrisma.team.findFirst.mockResolvedValue({ id: 21 });
  });

  it('picks the API-Football league from the internal sport key', async () => {
    await service.syncTeamSeasonStats('soccer_epl', 33, 2024);

    expect(apiGet).toHaveBeenCalledWith('/teams/statistics', {
      team: 33,
      season: '2024',
      league: 39,
    });
  });

  it.each([
    ['soccer_spain_la_liga', 140],
    ['soccer_usa_mls', 253],
    ['soccer_uefa_champs_league', 2],
  ])('maps %s to league %i', async (sportKey, leagueId) => {
    await service.syncTeamSeasonStats(sportKey, 33, 2024);

    expect(apiGet).toHaveBeenCalledWith(
      '/teams/statistics',
      expect.objectContaining({ league: leagueId })
    );
  });

  it('stores the caller-supplied sport key, since the service spans several', async () => {
    await service.syncTeamSeasonStats('soccer_usa_mls', 33, 2024);

    expect(upsertedStats()).toEqual(expect.objectContaining({ sportKey: 'soccer_usa_mls' }));
  });

  it('resolves the team by externalId, because soccer teams have no apiSportsTeamId', async () => {
    await service.syncTeamSeasonStats('soccer_epl', 33, 2024);

    expect(mockPrisma.team.findFirst).toHaveBeenCalledWith({ where: { externalId: '33' } });
  });

  it('records draws as ties and carries the clean-sheet and form extras', async () => {
    await service.syncTeamSeasonStats('soccer_epl', 33, 2024);

    expect(upsertedStats()).toEqual({
      teamId: 21,
      sportKey: 'soccer_epl',
      season: 2024,
      seasonType: 'regular',
      offense: {
        goals: 57,
        goalsPerGame: 1.5,
        goalsHome: 32,
        goalsAway: 25,
        failedToScore: 7,
        penaltiesScored: 5,
        penaltiesMissed: 1,
      },
      defense: {
        goalsAgainst: 43,
        goalsAgainstPerGame: 1.1,
        goalsAgainstHome: 18,
        goalsAgainstAway: 25,
        cleanSheets: 13,
      },
      standings: {
        wins: 23,
        losses: 8,
        ties: 7,
        homeWins: 14,
        awayWins: 9,
        form: 'WDLWW',
      },
      gamesPlayed: 38,
    });
  });
});

describe('StatsSyncService.syncTeamSeasonStats — unchanged sports', () => {
  it('still queries the american-football host by `id`', async () => {
    apiGet.mockResolvedValue({
      response: [{ offense: { yards: 5800 }, defense: { yards: 5100 }, wins: 11, losses: 6, ties: 0, games_played: 17 }],
    } as any);
    mockPrisma.team.findFirst.mockResolvedValue({ id: 4 });

    await service.syncTeamSeasonStats('americanfootball_nfl', 1, 2024);

    expect(apiGet).toHaveBeenCalledWith('/teams/statistics', { id: 1, season: '2024', league: 1 });
    expect(upsertedStats()).toEqual({
      teamId: 4,
      sportKey: 'americanfootball_nfl',
      season: 2024,
      seasonType: 'regular',
      offense: { yards: 5800 },
      defense: { yards: 5100 },
      standings: { wins: 11, losses: 6, ties: 0 },
      gamesPlayed: 17,
    });
  });

  it('leaves sports with no team stats sync alone rather than writing empty rows', async () => {
    await service.syncTeamSeasonStats('baseball_mlb', 5, 2024);

    expect(apiGet).not.toHaveBeenCalled();
    expect(mockPrisma.teamStats.upsert).not.toHaveBeenCalled();
  });
});
