/**
 * Bookmaker Performance Analytics — Frontend API Service
 */

import api from './api';
import {
  BookmakerAnalytics,
  BookmakerOutlierStats,
  BookmakerRankingCriteria,
  BookmakerRankingsResponse,
  BookmakerDetailResponse,
  BookmakerOutlierResponse,
} from '../types/bookmaker.types';

class BookmakerService {
  /**
   * Get all bookmakers ranked by the given criteria.
   */
  async getRankings(
    criteria: BookmakerRankingCriteria = 'recommendation'
  ): Promise<{ rankings: BookmakerAnalytics[]; criteria: BookmakerRankingCriteria; count: number }> {
    const response = await api.get<BookmakerRankingsResponse>('/analytics/bookmakers/rankings', {
      params: { criteria },
    });
    return {
      rankings: response.data.data?.rankings || [],
      criteria: response.data.data?.criteria || criteria,
      count: response.data.data?.count || 0,
    };
  }

  /**
   * Get full performance metrics for a single bookmaker.
   */
  async getBookmakerDetail(bookmaker: string): Promise<BookmakerAnalytics | null> {
    const response = await api.get<BookmakerDetailResponse>(
      `/analytics/bookmakers/${encodeURIComponent(bookmaker)}`
    );
    return response.data.data || null;
  }

  /**
   * Get outlier frequency and deviation stats for a bookmaker.
   */
  async getBookmakerOutlierStats(
    bookmaker: string,
    days: number = 30
  ): Promise<BookmakerOutlierStats | null> {
    const response = await api.get<BookmakerOutlierResponse>(
      `/analytics/bookmakers/${encodeURIComponent(bookmaker)}/outliers`,
      { params: { days } }
    );
    return response.data.data || null;
  }
}

export const bookmakerService = new BookmakerService();
