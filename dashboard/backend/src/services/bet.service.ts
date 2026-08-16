/**
 * Service for managing bets
 *
 * Handles:
 * - Bet creation with validation
 * - Bet updates and cancellation
 * - Bet settlement
 * - Statistics and reporting
 *
 * This file is the public entry point. The implementation lives in `./bet/`,
 * split by responsibility:
 *
 *   bet-crud.service.ts        create / read / update / cancel / settle
 *   bet-analytics.service.ts   P&L, win rate, ROI, per-sport breakdown
 *   bet-validation.service.ts  pre-placement rules
 *   bet-odds.service.ts        combined odds and payout for a new bet
 *   bet-formatter.ts           Prisma include shapes and response mapping
 */

import {
  BetFilters,
  BetResponse,
  BetStats,
  CreateBetInput,
  PaginatedBets,
  StatsFilters,
  UpdateBetInput
} from '../types/bet.types';
import { betAnalyticsService } from './bet/bet-analytics.service';
import { betCrudService } from './bet/bet-crud.service';

export { BetAnalyticsService } from './bet/bet-analytics.service';
export { BetCrudService } from './bet/bet-crud.service';
export { BetOddsService } from './bet/bet-odds.service';
export { BetValidationService } from './bet/bet-validation.service';

/**
 * Thin facade over the bet modules, kept so routes, controllers and jobs
 * depend on one bet entry point rather than on the internal split.
 */
export class BetService {
  createBet(data: CreateBetInput, userId?: string): Promise<BetResponse> {
    return betCrudService.createBet(data, userId);
  }

  getBets(filters: BetFilters = {}): Promise<PaginatedBets> {
    return betCrudService.getBets(filters);
  }

  getBetById(id: string, userId?: string): Promise<BetResponse | null> {
    return betCrudService.getBetById(id, userId);
  }

  updateBet(id: string, data: UpdateBetInput, userId?: string): Promise<BetResponse> {
    return betCrudService.updateBet(id, data, userId);
  }

  cancelBet(id: string, force: boolean = false, userId?: string): Promise<void> {
    return betCrudService.cancelBet(id, force, userId);
  }

  settleBet(
    id: string,
    status: 'won' | 'lost' | 'push',
    actualPayout?: number,
    userId?: string
  ): Promise<BetResponse> {
    return betCrudService.settleBet(id, status, actualPayout, userId);
  }

  getStats(filters: StatsFilters = {}): Promise<BetStats> {
    return betAnalyticsService.getStats(filters);
  }
}

// Export singleton instance
export const betService = new BetService();
