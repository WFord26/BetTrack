/**
 * CLV (Closing Line Value) API service
 */
import apiClient from './api';
import { CLVSummary, CLVBySport, CLVByBookmaker, CLVTrend, CLVReport, CLVFilters } from '../types/clv.types';

export const clvService = {
  /**
   * Get overall CLV summary statistics
   */
  async getSummary(): Promise<CLVSummary> {
    const response = await apiClient.get('/analytics/clv/summary');
    return response.data;
  },

  /**
   * Get CLV breakdown by sport
   */
  async getBySport(): Promise<CLVBySport[]> {
    const response = await apiClient.get('/analytics/clv/by-sport');
    return response.data;
  },

  /**
   * Get CLV breakdown by bookmaker
   */
  async getByBookmaker(): Promise<CLVByBookmaker[]> {
    const response = await apiClient.get('/analytics/clv/by-bookmaker');
    return response.data;
  },

  /**
   * Get CLV trends over time with optional filters
   */
  async getTrends(filters?: CLVFilters): Promise<CLVTrend[]> {
    const response = await apiClient.get('/analytics/clv/trends', {
      params: filters
    });
    return response.data;
  },

  /**
   * Get comprehensive CLV report with all analytics
   */
  async getReport(filters?: CLVFilters): Promise<CLVReport> {
    const response = await apiClient.get('/analytics/clv/report', {
      params: filters
    });
    return response.data;
  },

  /**
   * Calculate CLV for a specific bet
   */
  async calculateForBet(betId: string): Promise<{ clv: number; category: string }> {
    const response = await apiClient.post(`/analytics/clv/calculate/${betId}`);
    return response.data;
  },

  /**
   * Update aggregated CLV statistics
   */
  async updateStats(): Promise<{ message: string }> {
    const response = await apiClient.post('/analytics/clv/update-stats');
    return response.data;
  }
};
