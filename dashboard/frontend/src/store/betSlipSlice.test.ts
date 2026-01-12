/**
 * Example Redux slice tests - BetSlip slice
 * Demonstrates testing Redux Toolkit slices
 */

import { describe, it, expect } from 'vitest';
import betSlipReducer, {
  addLeg,
  removeLeg,
  clearSlip,
  setStake,
  setBetType,
  setTeaserPoints,
  type BetSlipState,
} from '@/store/betSlipSlice';
import { mockGame } from '@/test/test-utils';

describe('BetSlip Redux Slice', () => {
  const initialState: BetSlipState = {
    legs: [],
    futureLegs: [],
    betType: 'single',
    stake: 0,
    teaserPoints: 6,
  };

  describe('addLeg action', () => {
    it('adds a leg to empty bet slip', () => {
      const leg = {
        gameId: mockGame.id,
        selectionType: 'moneyline' as const,
        selection: 'home',
        odds: -110,
        line: null,
        game: mockGame,
      };

      const newState = betSlipReducer(initialState, addLeg(leg));

      expect(newState.legs).toHaveLength(1);
      expect(newState.legs[0]).toEqual(leg);
    });

    it('adds multiple legs for parlay', () => {
      const leg1 = {
        gameId: 'game-1',
        selectionType: 'moneyline' as const,
        selection: 'home',
        odds: -110,
        line: null,
        game: { ...mockGame, id: 'game-1' },
      };

      const leg2 = {
        gameId: 'game-2',
        selectionType: 'spread' as const,
        selection: 'away',
        odds: -110,
        line: -3.5,
        game: { ...mockGame, id: 'game-2' },
      };

      let state = betSlipReducer(initialState, addLeg(leg1));
      state = betSlipReducer(state, setBetType('parlay'));
      state = betSlipReducer(state, addLeg(leg2));

      expect(state.legs).toHaveLength(2);
      expect(state.betType).toBe('parlay');
    });

    it('allows multiple legs for same game with different selection types', () => {
      const leg1 = {
        gameId: mockGame.id,
        selectionType: 'moneyline' as const,
        selection: 'home',
        odds: -110,
        line: null,
        game: mockGame,
      };

      const leg2 = {
        gameId: mockGame.id,
        selectionType: 'spread' as const,
        selection: 'away',
        odds: -110,
        line: -3.5,
        game: mockGame,
      };

      let state = betSlipReducer(initialState, addLeg(leg1));
      state = betSlipReducer(state, addLeg(leg2));

      expect(state.legs).toHaveLength(2);
      expect(state.legs[0].selectionType).toBe('moneyline');
      expect(state.legs[1].selectionType).toBe('spread');
      expect(state.betType).toBe('parlay'); // Should auto-switch to parlay with 2+ legs
    });
  });

  describe('removeLeg action', () => {
    it('removes a leg from bet slip', () => {
      const stateWithLeg: BetSlipState = {
        ...initialState,
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
      };

      const newState = betSlipReducer(stateWithLeg, removeLeg(mockGame.id));

      expect(newState.legs).toHaveLength(0);
    });

    it('removes correct leg when multiple exist', () => {
      const stateWithLegs: BetSlipState = {
        ...initialState,
        legs: [
          {
            gameId: 'game-1',
            selectionType: 'moneyline',
            selection: 'home',
            odds: -110,
            line: null,
            game: { ...mockGame, id: 'game-1' },
          },
          {
            gameId: 'game-2',
            selectionType: 'spread',
            selection: 'away',
            odds: -110,
            line: -3.5,
            game: { ...mockGame, id: 'game-2' },
          },
        ],
      };

      const newState = betSlipReducer(stateWithLegs, removeLeg('game-1'));

      expect(newState.legs).toHaveLength(1);
      expect(newState.legs[0].gameId).toBe('game-2');
    });
  });

  describe('clearBetSlip action', () => {
    it('clears all legs and resets state', () => {
      const stateWithData: BetSlipState = {
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
        betType: 'parlay',
        stake: 100,
        teaserPoints: 6,
      };

      const newState = betSlipReducer(stateWithData, clearSlip());

      expect(newState).toEqual(initialState);
    });
  });

  describe('setStake action', () => {
    it('sets stake amount', () => {
      const newState = betSlipReducer(initialState, setStake(100));

      expect(newState.stake).toBe(100);
    });

    it('updates existing stake', () => {
      const stateWithStake: BetSlipState = {
        ...initialState,
        stake: 50,
      };

      const newState = betSlipReducer(stateWithStake, setStake(200));

      expect(newState.stake).toBe(200);
    });
  });

  describe('setBetType action', () => {
    it('changes bet type', () => {
      const newState = betSlipReducer(initialState, setBetType('parlay'));

      expect(newState.betType).toBe('parlay');
    });

    it('handles all bet types', () => {
      let state = betSlipReducer(initialState, setBetType('parlay'));
      expect(state.betType).toBe('parlay');

      state = betSlipReducer(state, setBetType('teaser'));
      expect(state.betType).toBe('teaser');

      state = betSlipReducer(state, setBetType('single'));
      expect(state.betType).toBe('single');
    });
  });

  describe('setTeaserPoints action', () => {
    it('sets teaser points', () => {
      const newState = betSlipReducer(initialState, setTeaserPoints(6));

      expect(newState.teaserPoints).toBe(6);
    });

    it('clears teaser points when null', () => {
      const stateWithTeaser: BetSlipState = {
        ...initialState,
        teaserPoints: 6,
      };

      const newState = betSlipReducer(stateWithTeaser, setTeaserPoints(null));

      expect(newState.teaserPoints).toBeNull();
    });
  });
});
