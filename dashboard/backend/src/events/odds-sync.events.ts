import { EventEmitter } from 'events';

/**
 * Odds sync lifecycle events.
 *
 * Downstream analytics that only produce meaningful output when the odds
 * snapshot changes (arbitrage detection in particular) subscribe here instead
 * of polling on a timer they cannot align with the sync cadence.
 */

export const ODDS_SYNC_COMPLETED = 'odds-sync:completed';

export interface OddsSyncCompletedPayload {
  success: boolean;
  gamesProcessed: number;
  oddsProcessed: number;
  completedAt: Date;
}

class OddsSyncEmitter extends EventEmitter {}

export const oddsSyncEvents = new OddsSyncEmitter();

// Several jobs may subscribe; keep Node from warning about a leak.
oddsSyncEvents.setMaxListeners(20);

export function emitOddsSyncCompleted(payload: OddsSyncCompletedPayload): void {
  oddsSyncEvents.emit(ODDS_SYNC_COMPLETED, payload);
}

export function onOddsSyncCompleted(
  listener: (payload: OddsSyncCompletedPayload) => void
): () => void {
  oddsSyncEvents.on(ODDS_SYNC_COMPLETED, listener);
  return () => oddsSyncEvents.off(ODDS_SYNC_COMPLETED, listener);
}
