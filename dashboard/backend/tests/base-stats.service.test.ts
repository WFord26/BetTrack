/**
 * Unit tests for the shared API-Sports stats machinery.
 *
 * These cover the behaviour that used to be copy-pasted across the seven
 * sport services (team sync, live-game fetching, team/game/player resolution,
 * status mapping) and now has exactly one implementation.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../src/config/env', () => ({
  env: { API_SPORTS_KEY: 'test-api-sports-key', API_SPORTS_TIER: 'mega' },
}));

jest.mock('../src/config/database', () => ({
  prisma: {
    sport: { findUnique: jest.fn() },
    team: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    game: { findFirst: jest.fn() },
    gameStats: { upsert: jest.fn() },
    teamStats: { upsert: jest.fn() },
    player: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    playerGameStats: { upsert: jest.fn() },
  },
}));

import { BaseStatsService, ApiSportsTeamPayload, TeamRecordUpdate } from '../src/services/api-sports/base-stats.service';
import { ApiSportsClient } from '../src/services/api-sports/client';
import { mapApiStatusToLocal, resolveAmericanFootballSeason } from '../src/services/api-sports/status';
import { prisma } from '../src/config/database';

const mockPrisma = prisma as any;

interface TestGame {
  id: number;
}

class TestStatsService extends BaseStatsService<TestGame> {
  constructor(overrides: { sportKey?: string; leagueId?: number } = {}) {
    super({
      label: 'TEST',
      apiSport: 'basketball',
      sportKey: 'sportKey' in overrides ? overrides.sportKey : 'test_sport',
      leagueId: 'leagueId' in overrides ? overrides.leagueId : 99,
    });
  }

  extractGameId(game: TestGame): string {
    return String(game.id);
  }

  async syncGameStats(): Promise<void> {
    // not exercised here
  }

  // Expose the protected helpers under test.
  publicFindGameByApiId(id: string) {
    return this.findGameByApiId(id);
  }

  publicUpsertPlayer(input: Parameters<BaseStatsService<TestGame>['upsertPlayer']>[0]) {
    return this.upsertPlayer(input);
  }
}

let apiGet: jest.SpiedFunction<typeof ApiSportsClient.prototype.get>;

beforeEach(() => {
  jest.clearAllMocks();
  apiGet = jest.spyOn(ApiSportsClient.prototype, 'get');
});

afterEach(() => {
  apiGet.mockRestore();
});

describe('mapApiStatusToLocal', () => {
  it.each([
    ['FT', 'completed'],
    ['AOT', 'completed'],
    ['NS', 'scheduled'],
    ['TBD', 'scheduled'],
  ])('maps the shared short code %s to %s', (short, expected) => {
    expect(mapApiStatusToLocal({ short, long: '' })).toBe(expected);
  });

  it.each(['Q1', 'Q2', 'Q3', 'Q4', 'HT', 'OT'])(
    'treats american-football short code %s as live',
    short => {
      expect(mapApiStatusToLocal({ short, long: '' })).toBe('live');
    }
  );

  it.each(['1', '5', '9'])('treats baseball inning short code %s as live', short => {
    expect(mapApiStatusToLocal({ short, long: '' })).toBe('live');
  });

  it('treats the generic LIVE short code as live', () => {
    expect(mapApiStatusToLocal({ short: 'LIVE', long: '' })).toBe('live');
  });

  it('falls back to the long description when the short code is unknown', () => {
    expect(mapApiStatusToLocal({ short: '??', long: 'Game Finished' })).toBe('completed');
    expect(mapApiStatusToLocal({ short: '??', long: 'In Play' })).toBe('live');
    expect(mapApiStatusToLocal({ short: '??', long: 'In Progress' })).toBe('live');
    expect(mapApiStatusToLocal({ short: '??', long: 'Postponed' })).toBe('scheduled');
  });

  it('defaults to scheduled rather than guessing a terminal state', () => {
    expect(mapApiStatusToLocal({ short: 'WTF', long: 'unknown' })).toBe('scheduled');
    expect(mapApiStatusToLocal(undefined)).toBe('scheduled');
  });
});

describe('resolveAmericanFootballSeason', () => {
  it('labels Jan/Feb games with the prior season year', () => {
    expect(resolveAmericanFootballSeason(new Date('2025-01-12T18:00:00Z'))).toBe(2024);
    expect(resolveAmericanFootballSeason(new Date('2025-02-09T18:00:00Z'))).toBe(2024);
  });

  it('labels Mar–Dec games with the calendar year', () => {
    expect(resolveAmericanFootballSeason(new Date('2025-03-01T18:00:00Z'))).toBe(2025);
    expect(resolveAmericanFootballSeason(new Date('2025-09-07T18:00:00Z'))).toBe(2025);
    expect(resolveAmericanFootballSeason(new Date('2025-12-28T18:00:00Z'))).toBe(2025);
  });
});

describe('BaseStatsService.getLiveGames', () => {
  it('returns the raw upstream payloads', async () => {
    apiGet.mockResolvedValue({ response: [{ id: 1 }, { id: 2 }] } as any);

    const games = await new TestStatsService().getLiveGames();

    expect(games).toEqual([{ id: 1 }, { id: 2 }]);
    expect(apiGet).toHaveBeenCalledWith('/games', { live: 'all', league: 99 });
  });

  it('swallows upstream failures so one sport cannot abort the rest', async () => {
    apiGet.mockRejectedValue(new Error('upstream down'));

    await expect(new TestStatsService().getLiveGames()).resolves.toEqual([]);
  });

  it('maps payloads to ids via extractGameId', async () => {
    apiGet.mockResolvedValue({ response: [{ id: 7 }, { id: 8 }] } as any);

    await expect(new TestStatsService().getLiveGameIds()).resolves.toEqual(['7', '8']);
  });
});

describe('BaseStatsService.syncTeams', () => {
  it('creates teams that are not yet stored and updates the ones that are', async () => {
    apiGet.mockResolvedValue({
      response: [
        { id: 10, name: 'Alpha', code: 'ALP', logo: 'alpha.png' },
        { id: 11, name: 'Beta', code: 'BET', logo: 'beta.png' },
      ],
    } as any);
    mockPrisma.sport.findUnique.mockResolvedValue({ id: 3, key: 'test_sport' });
    mockPrisma.team.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 55 });

    const count = await new TestStatsService().syncTeams(2024);

    expect(count).toBe(2);
    expect(apiGet).toHaveBeenCalledWith('/teams', { league: 99, season: 2024 });
    expect(mockPrisma.team.create).toHaveBeenCalledWith({
      data: {
        sportId: 3,
        apiSportsTeamId: 10,
        name: 'Alpha',
        abbreviation: 'ALP',
        logoUrl: 'alpha.png',
      },
    });
    expect(mockPrisma.team.update).toHaveBeenCalledWith({
      where: { id: 55 },
      data: { name: 'Beta', abbreviation: 'BET', logoUrl: 'beta.png' },
    });
  });

  it('honours a subclass filter on the /teams payload', async () => {
    class FilteredService extends TestStatsService {
      protected filterApiTeams(teams: ApiSportsTeamPayload[]): ApiSportsTeamPayload[] {
        return teams.filter(team => !team.name.endsWith('League'));
      }
    }

    apiGet.mockResolvedValue({
      response: [
        { id: 1, name: 'American League' },
        { id: 2, name: 'Boston Red Sox' },
      ],
    } as any);
    mockPrisma.sport.findUnique.mockResolvedValue({ id: 3 });
    mockPrisma.team.findFirst.mockResolvedValue(null);

    await expect(new FilteredService().syncTeams(2024)).resolves.toBe(1);
    expect(mockPrisma.team.create).toHaveBeenCalledTimes(1);
  });

  it('lets a subclass leave columns its host does not report untouched', async () => {
    class NoAbbreviationService extends TestStatsService {
      protected mapApiTeam(team: ApiSportsTeamPayload): TeamRecordUpdate {
        return { name: team.name, logoUrl: team.logo || null };
      }
    }

    apiGet.mockResolvedValue({ response: [{ id: 1, name: 'Boston Red Sox', logo: 'bos.png' }] } as any);
    mockPrisma.sport.findUnique.mockResolvedValue({ id: 3 });
    mockPrisma.team.findFirst.mockResolvedValue({ id: 42 });

    await new NoAbbreviationService().syncTeams(2024);

    expect(mockPrisma.team.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { name: 'Boston Red Sox', logoUrl: 'bos.png' },
    });
  });

  it('returns 0 when the sport row has not been seeded', async () => {
    apiGet.mockResolvedValue({ response: [{ id: 1, name: 'Alpha' }] } as any);
    mockPrisma.sport.findUnique.mockResolvedValue(null);

    await expect(new TestStatsService().syncTeams(2024)).resolves.toBe(0);
    expect(mockPrisma.team.create).not.toHaveBeenCalled();
  });

  it('is a no-op for multi-league services with no single sport key', async () => {
    const service = new TestStatsService({ sportKey: undefined, leagueId: undefined });

    await expect(service.syncTeams(2024)).resolves.toBe(0);
    expect(apiGet).not.toHaveBeenCalled();
  });
});

describe('BaseStatsService.syncTeamStats', () => {
  it('resolves the team by its API-Sports id, not the odds-API external id', async () => {
    apiGet.mockResolvedValue({
      response: [{ offense: { yards: 100 }, defense: {}, wins: 5, losses: 2, games_played: 7 }],
    } as any);
    mockPrisma.team.findFirst.mockResolvedValue({ id: 12 });

    await new TestStatsService().syncTeamStats(404, 2024);

    expect(mockPrisma.team.findFirst).toHaveBeenCalledWith({
      where: { apiSportsTeamId: 404, sport: { key: 'test_sport' } },
    });
    expect(mockPrisma.teamStats.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teamId_season_seasonType: { teamId: 12, season: 2024, seasonType: 'regular' } },
      })
    );
  });

  it('skips the write when the team is unknown', async () => {
    apiGet.mockResolvedValue({ response: [{}] } as any);
    mockPrisma.team.findFirst.mockResolvedValue(null);

    await new TestStatsService().syncTeamStats(404, 2024);

    expect(mockPrisma.teamStats.upsert).not.toHaveBeenCalled();
  });
});

describe('BaseStatsService.findGameByApiId', () => {
  it('prefers a row matched on apiSportsGameId', async () => {
    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1' });

    await expect(new TestStatsService().publicFindGameByApiId('555')).resolves.toEqual({ id: 'game-1' });
    expect(mockPrisma.game.findFirst).toHaveBeenCalledTimes(1);
    expect(mockPrisma.game.findFirst).toHaveBeenCalledWith({
      where: { apiSportsGameId: '555', sport: { key: 'test_sport' } },
    });
  });

  it('falls back to externalId for rows created before game reconciliation existed', async () => {
    mockPrisma.game.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'game-2' });

    await expect(new TestStatsService().publicFindGameByApiId('555')).resolves.toEqual({ id: 'game-2' });
    expect(mockPrisma.game.findFirst).toHaveBeenNthCalledWith(2, {
      where: { externalId: '555', sport: { key: 'test_sport' } },
    });
  });

  it('drops the sport filter for multi-league services', async () => {
    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-3' });

    const service = new TestStatsService({ sportKey: undefined, leagueId: undefined });
    await service.publicFindGameByApiId('555');

    expect(mockPrisma.game.findFirst).toHaveBeenCalledWith({ where: { apiSportsGameId: '555' } });
  });
});

describe('BaseStatsService.upsertPlayer', () => {
  it('splits the full name into first and last names on create', async () => {
    mockPrisma.player.findFirst.mockResolvedValue(null);
    mockPrisma.player.create.mockResolvedValue({ id: 1 });

    await new TestStatsService().publicUpsertPlayer({
      externalId: '900',
      fullName: 'Jean Luc Picard',
      teamId: 4,
    });

    expect(mockPrisma.player.create).toHaveBeenCalledWith({
      data: { externalId: '900', firstName: 'Jean', lastName: 'Luc Picard', teamId: 4 },
    });
  });

  it('refreshes name and team on an already-known player', async () => {
    mockPrisma.player.findFirst.mockResolvedValue({ id: 77 });
    mockPrisma.player.update.mockResolvedValue({ id: 77 });

    await new TestStatsService().publicUpsertPlayer({
      externalId: '900',
      fullName: 'Kathryn Janeway',
      teamId: 4,
    });

    expect(mockPrisma.player.update).toHaveBeenCalledWith({
      where: { id: 77 },
      data: { firstName: 'Kathryn', lastName: 'Janeway', teamId: 4 },
    });
  });

  it('does not query on an undefined externalId, which would match an arbitrary player', async () => {
    mockPrisma.player.create.mockResolvedValue({ id: 2 });

    await new TestStatsService().publicUpsertPlayer({ fullName: 'No Id', teamId: 4 });

    expect(mockPrisma.player.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.player.create).toHaveBeenCalledWith({
      data: { externalId: null, firstName: 'No', lastName: 'Id', teamId: 4 },
    });
  });

  it('only writes position when the caller supplies one', async () => {
    mockPrisma.player.findFirst.mockResolvedValue(null);
    mockPrisma.player.create.mockResolvedValue({ id: 3 });

    await new TestStatsService().publicUpsertPlayer({
      externalId: '901',
      fullName: 'Point Guard',
      teamId: 4,
      position: 'G',
    });

    expect(mockPrisma.player.create).toHaveBeenCalledWith({
      data: {
        externalId: '901',
        firstName: 'Point',
        lastName: 'Guard',
        teamId: 4,
        position: 'G',
      },
    });
  });
});
