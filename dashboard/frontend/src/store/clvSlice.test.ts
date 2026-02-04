/**
 * Tests for CLV Redux slice
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import clvReducer, {
  setFilters,
  clearFilters,
  clearError,
  fetchCLVSummary,
  fetchCLVBySport,
  fetchCLVByBookmaker,
  fetchCLVTrends,
  fetchCLVReport
} from './clvSlice';
import { clvService } from '../services/clv.service';

// Mock the clvService
vi.mock('../services/clv.service', () => ({
  clvService: {
    getSummary: vi.fn(),
    getBySport: vi.fn(),
    getByBookmaker: vi.fn(),
    getTrends: vi.fn(),
    getReport: vi.fn(),
    calculateForBet: vi.fn(),
    updateStats: vi.fn()
  }
}));

describe('clvSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        clv: clvReducer
      }
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().clv;
      expect(state.summary).toBeNull();
      expect(state.bySport).toEqual([]);
      expect(state.byBookmaker).toEqual([]);
      expect(state.trends).toEqual([]);
      expect(state.report).toBeNull();
      expect(state.filters).toEqual({ period: 'all-time' });
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('setFilters', () => {
    it('should update filters', () => {
      store.dispatch(setFilters({ sportKey: 'basketball_nba', period: 'month' }));
      const state = store.getState().clv;
      expect(state.filters).toEqual({ sportKey: 'basketball_nba', period: 'month' });
    });

    it('should merge filters with existing ones', () => {
      store.dispatch(setFilters({ period: 'week' }));
      store.dispatch(setFilters({ sportKey: 'americanfootball_nfl' }));
      const state = store.getState().clv;
      expect(state.filters).toEqual({ period: 'week', sportKey: 'americanfootball_nfl' });
    });
  });

  describe('clearFilters', () => {
    it('should reset filters to default', () => {
      store.dispatch(setFilters({ sportKey: 'basketball_nba', betType: 'spread' }));
      store.dispatch(clearFilters());
      const state = store.getState().clv;
      expect(state.filters).toEqual({ period: 'all-time' });
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      // Manually set error state for testing
      store.dispatch({ type: 'clv/fetchSummary/rejected', payload: 'Test error' });
      expect(store.getState().clv.error).toBe('Test error');
      
      store.dispatch(clearError());
      expect(store.getState().clv.error).toBeNull();
    });
  });

  describe('fetchCLVSummary', () => {
    it('should set loading state when pending', async () => {
      const promise = store.dispatch(fetchCLVSummary());
      expect(store.getState().clv.loading).toBe(true);
      promise.abort(); // Cancel the async action
    });

    it('should set summary data when fulfilled', async () => {
      const mockSummary = {
        totalBets: 100,
        averageCLV: 3.5,
        positiveCLVCount: 60,
        negativeCLVCount: 30,
        neutralCLVCount: 10,
        clvWinRate: 0.55,
        expectedROI: 4.2,
        actualROI: 5.1
      };

      vi.mocked(clvService.getSummary).mockResolvedValue(mockSummary);

      await store.dispatch(fetchCLVSummary());
      const state = store.getState().clv;
      
      expect(state.loading).toBe(false);
      expect(state.summary).toEqual(mockSummary);
      expect(state.error).toBeNull();
    });

    it('should set error when rejected', async () => {
      vi.mocked(clvService.getSummary).mockRejectedValue({
        response: { data: { message: 'API Error' } }
      });

      await store.dispatch(fetchCLVSummary());
      const state = store.getState().clv;
      
      expect(state.loading).toBe(false);
      expect(state.error).toBe('API Error');
      expect(state.summary).toBeNull();
    });
  });

  describe('fetchCLVBySport', () => {
    it('should set bySport data when fulfilled', async () => {
      const mockBySport = [
        { sport: 'basketball_nba', sportName: 'NBA', totalBets: 50, averageCLV: 2.5, positiveCLVCount: 30, negativeCLVCount: 20, clvWinRate: 0.6 },
        { sport: 'americanfootball_nfl', sportName: 'NFL', totalBets: 50, averageCLV: 4.5, positiveCLVCount: 35, negativeCLVCount: 15, clvWinRate: 0.7 }
      ];

      vi.mocked(clvService.getBySport).mockResolvedValue(mockBySport);

      await store.dispatch(fetchCLVBySport());
      const state = store.getState().clv;
      
      expect(state.loading).toBe(false);
      expect(state.bySport).toEqual(mockBySport);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchCLVByBookmaker', () => {
    it('should set byBookmaker data when fulfilled', async () => {
      const mockByBookmaker = [
        { bookmaker: 'draftkings', totalBets: 40, averageCLV: 3.0, positiveCLVCount: 25, negativeCLVCount: 15, clvWinRate: 0.625 },
        { bookmaker: 'fanduel', totalBets: 60, averageCLV: 3.8, positiveCLVCount: 40, negativeCLVCount: 20, clvWinRate: 0.667 }
      ];

      vi.mocked(clvService.getByBookmaker).mockResolvedValue(mockByBookmaker);

      await store.dispatch(fetchCLVByBookmaker());
      const state = store.getState().clv;
      
      expect(state.loading).toBe(false);
      expect(state.byBookmaker).toEqual(mockByBookmaker);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchCLVTrends', () => {
    it('should set trends data when fulfilled', async () => {
      const mockTrends = [
        { date: '2026-02-01', averageCLV: 2.5, betCount: 10, winRate: 0.6 },
        { date: '2026-02-02', averageCLV: 3.0, betCount: 15, winRate: 0.65 },
        { date: '2026-02-03', averageCLV: 3.5, betCount: 12, winRate: 0.7 }
      ];

      vi.mocked(clvService.getTrends).mockResolvedValue(mockTrends);

      await store.dispatch(fetchCLVTrends({ period: 'week' }));
      const state = store.getState().clv;
      
      expect(state.loading).toBe(false);
      expect(state.trends).toEqual(mockTrends);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchCLVReport', () => {
    it('should set report data when fulfilled', async () => {
      const mockReport = {
        summary: {
          totalBets: 100,
          averageCLV: 3.5,
          positiveCLVCount: 60,
          negativeCLVCount: 30,
          neutralCLVCount: 10,
          clvWinRate: 0.55,
          expectedROI: 4.2,
          actualROI: 5.1
        },
        bySport: [],
        byBookmaker: [],
        trends: [],
        topBets: [],
        worstBets: []
      };

      vi.mocked(clvService.getReport).mockResolvedValue(mockReport);

      await store.dispatch(fetchCLVReport());
      const state = store.getState().clv;
      
      expect(state.loading).toBe(false);
      expect(state.report).toEqual(mockReport);
      expect(state.error).toBeNull();
    });

    it('should pass filters to service', async () => {
      const filters = { sportKey: 'basketball_nba', period: 'month' as const };
      vi.mocked(clvService.getReport).mockResolvedValue({} as any);

      await store.dispatch(fetchCLVReport(filters));
      
      expect(clvService.getReport).toHaveBeenCalledWith(filters);
    });
  });
});
