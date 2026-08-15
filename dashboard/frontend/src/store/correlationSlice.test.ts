/**
 * Redux slice tests — correlation slice
 *
 * Focus: the stale-response guard on analyzeDraftSlip. When the user edits
 * the bet slip while an earlier debounced /parlay request is still in
 * flight, a slow fulfillment for that superseded request must not clobber
 * the current slip's warning/true-odds with outdated data.
 */

import { describe, it, expect } from 'vitest';
import correlationReducer, {
  analyzeDraftSlip,
  clearDraftAnalysis,
  type CorrelationState,
} from '@/store/correlationSlice';
import type { ParlayAnalysis } from '@/types/correlation.types';

const initialState: CorrelationState = {
  draftAnalysis: null,
  history: [],
  hedgeOptions: [],
  education: null,
  analyzing: false,
  hedging: false,
  loading: false,
  error: null,
  latestDraftRequestId: null,
};

function analysis(overrides: Partial<ParlayAnalysis> = {}): ParlayAnalysis {
  return {
    betLegIds: ['draft-0', 'draft-1'],
    betId: null,
    nominalOdds: 265,
    trueOdds: 265,
    oddsDiscrepancy: 0,
    riskLevel: 'low',
    correlationFlags: [],
    recommendation: 'approve',
    reasoning: 'independent',
    suggestedFix: null,
    ...overrides,
  };
}

function pendingAction(requestId: string) {
  return { type: analyzeDraftSlip.pending.type, meta: { requestId } };
}

function fulfilledAction(requestId: string, payload: ParlayAnalysis) {
  return { type: analyzeDraftSlip.fulfilled.type, meta: { requestId }, payload };
}

function rejectedAction(requestId: string, payload: string) {
  return { type: analyzeDraftSlip.rejected.type, meta: { requestId }, payload };
}

describe('correlationSlice — analyzeDraftSlip staleness guard', () => {
  it('applies a fulfillment that matches the latest request', () => {
    let state = correlationReducer(initialState, pendingAction('req-1'));
    const result = analysis({ recommendation: 'warning' });

    state = correlationReducer(state, fulfilledAction('req-1', result));

    expect(state.draftAnalysis).toEqual(result);
    expect(state.analyzing).toBe(false);
  });

  it('ignores a fulfillment for a request superseded by a newer one', () => {
    let state = correlationReducer(initialState, pendingAction('req-1'));
    state = correlationReducer(state, pendingAction('req-2'));

    // The slow response for the first (now stale) request lands late.
    const staleResult = analysis({ recommendation: 'reject', reasoning: 'stale' });
    state = correlationReducer(state, fulfilledAction('req-1', staleResult));

    expect(state.draftAnalysis).toBeNull();
    expect(state.analyzing).toBe(true); // still waiting on req-2

    const freshResult = analysis({ recommendation: 'approve', reasoning: 'fresh' });
    state = correlationReducer(state, fulfilledAction('req-2', freshResult));

    expect(state.draftAnalysis).toEqual(freshResult);
    expect(state.analyzing).toBe(false);
  });

  it('ignores a rejection for a superseded request', () => {
    let state = correlationReducer(initialState, pendingAction('req-1'));
    state = correlationReducer(state, pendingAction('req-2'));

    state = correlationReducer(state, rejectedAction('req-1', 'stale error'));

    expect(state.error).toBeNull();
    expect(state.analyzing).toBe(true);
  });

  it('invalidates the in-flight request on clearDraftAnalysis so a later fulfillment cannot repopulate it', () => {
    let state = correlationReducer(initialState, pendingAction('req-1'));
    state = correlationReducer(state, clearDraftAnalysis());

    expect(state.latestDraftRequestId).toBeNull();

    const lateResult = analysis({ recommendation: 'reject' });
    state = correlationReducer(state, fulfilledAction('req-1', lateResult));

    expect(state.draftAnalysis).toBeNull();
  });
});
