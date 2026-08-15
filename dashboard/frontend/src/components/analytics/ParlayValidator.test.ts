/**
 * Unit tests for buildDraftLegs — the sgpGroupId derivation used before a
 * draft slip is sent to POST /analytics/correlation/parlay.
 *
 * Draft legs (not yet placed) have no sgpGroupId from the backend, so a
 * same-game spread + total built live in the slip must still be recognized
 * as an expected SGP pair rather than scored as unpriced high-risk
 * correlation.
 */

import { describe, it, expect } from 'vitest';
import { buildDraftLegs } from './ParlayValidator';
import { BetLeg } from '../../types/game.types';

const GAME_A = 'game-a';
const GAME_B = 'game-b';

function leg(overrides: Partial<BetLeg> & { gameId: string }): BetLeg {
  return {
    selectionType: 'moneyline',
    selection: 'home',
    odds: -110,
    ...overrides,
  } as BetLeg;
}

describe('buildDraftLegs', () => {
  it('derives a shared sgpGroupId for two legs on the same game', () => {
    const legs = [
      leg({ gameId: GAME_A, selectionType: 'spread', selection: 'home', line: -7 }),
      leg({ gameId: GAME_A, selectionType: 'total', selection: 'over', line: 48.5 }),
    ];

    const draftLegs = buildDraftLegs(legs);

    expect(draftLegs[0].sgpGroupId).toBeDefined();
    expect(draftLegs[0].sgpGroupId).toBe(draftLegs[1].sgpGroupId);
  });

  it('leaves sgpGroupId undefined for a single leg on a game', () => {
    const legs = [
      leg({ gameId: GAME_A, selectionType: 'moneyline', selection: 'home' }),
      leg({ gameId: GAME_B, selectionType: 'moneyline', selection: 'away' }),
    ];

    const draftLegs = buildDraftLegs(legs);

    expect(draftLegs[0].sgpGroupId).toBeUndefined();
    expect(draftLegs[1].sgpGroupId).toBeUndefined();
  });

  it('assigns different group ids to different games', () => {
    const legs = [
      leg({ gameId: GAME_A, selectionType: 'spread', selection: 'home', line: -7 }),
      leg({ gameId: GAME_A, selectionType: 'total', selection: 'over', line: 48.5 }),
      leg({ gameId: GAME_B, selectionType: 'spread', selection: 'away', line: 3.5 }),
      leg({ gameId: GAME_B, selectionType: 'total', selection: 'under', line: 44.5 }),
    ];

    const draftLegs = buildDraftLegs(legs);

    expect(draftLegs[0].sgpGroupId).toBe(draftLegs[1].sgpGroupId);
    expect(draftLegs[2].sgpGroupId).toBe(draftLegs[3].sgpGroupId);
    expect(draftLegs[0].sgpGroupId).not.toBe(draftLegs[2].sgpGroupId);
  });

  it('preserves an existing sgpGroupId rather than overwriting it', () => {
    const legs = [
      leg({ gameId: GAME_A, selectionType: 'spread', selection: 'home', line: -7, sgpGroupId: 'existing-group' }),
      leg({ gameId: GAME_A, selectionType: 'total', selection: 'over', line: 48.5, sgpGroupId: 'existing-group' }),
    ];

    const draftLegs = buildDraftLegs(legs);

    expect(draftLegs[0].sgpGroupId).toBe('existing-group');
    expect(draftLegs[1].sgpGroupId).toBe('existing-group');
  });

  it('maps odds, using userAdjustedOdds when present', () => {
    const legs = [
      leg({ gameId: GAME_A, odds: -110, userAdjustedOdds: -105 }),
      leg({ gameId: GAME_B, odds: 120 }),
    ];

    const draftLegs = buildDraftLegs(legs);

    expect(draftLegs[0].odds).toBe(-105);
    expect(draftLegs[1].odds).toBe(120);
  });
});
