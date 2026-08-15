/**
 * Parlay Validator
 *
 * Real-time correlation check for the bet slip. Debounces on leg changes,
 * calls POST /analytics/correlation/parlay with a draft slip, and shows a
 * warning badge + correlation-adjusted true odds inline in the slip.
 *
 * Warning levels: 🟢 <30% correlation, 🟡 30-60%, 🔴 >60%, ⛔ inverse (blocked).
 */

import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../store';
import {
  analyzeDraftSlip,
  clearDraftAnalysis,
  selectDraftAnalysis,
  selectCorrelationAnalyzing,
} from '../../store/correlationSlice';
import { BetLeg } from '../../types/game.types';
import { formatOdds } from '../../utils/format';

const DEBOUNCE_MS = 400;

interface Props {
  legs: BetLeg[];
  useDecimalOdds?: boolean;
}

function riskIcon(recommendation: string, riskLevel: string): string {
  if (recommendation === 'reject') return '⛔';
  if (riskLevel === 'high') return '🔴';
  if (riskLevel === 'medium') return '🟡';
  return '🟢';
}

export default function ParlayValidator({ legs, useDecimalOdds = false }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const analysis = useSelector(selectDraftAnalysis);
  const analyzing = useSelector(selectCorrelationAnalyzing);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only game legs carry correlatable selectionType/selection/gameId — futures
  // are always independent and out of scope here.
  const gameLegs = legs.filter((leg) => leg.gameId && leg.selectionType && leg.selection);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (gameLegs.length < 2) {
      dispatch(clearDraftAnalysis());
      return;
    }

    debounceRef.current = setTimeout(() => {
      dispatch(
        analyzeDraftSlip(
          gameLegs.map((leg) => ({
            gameId: leg.gameId,
            selectionType: leg.selectionType,
            selection: leg.selection,
            teamName: leg.teamName,
            line: leg.line,
            odds: leg.userAdjustedOdds ?? leg.odds,
            sgpGroupId: leg.sgpGroupId ?? undefined,
          }))
        )
      );
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [JSON.stringify(gameLegs.map((l) => [l.gameId, l.selectionType, l.selection, l.line, l.userAdjustedOdds ?? l.odds]))]);

  if (gameLegs.length < 2) return null;
  if (analyzing && !analysis) {
    return (
      <div className="bg-dusk-panel2 shadow-[0_0_0_2px_#43306a_inset] p-3 font-body text-xs text-cream-faint">
        Checking for correlation…
      </div>
    );
  }
  if (!analysis) return null;

  const isBlocked = analysis.recommendation === 'reject';
  const isWarning = analysis.recommendation === 'warning';
  const insetColor = isBlocked ? '#ef5350' : isWarning ? '#fcc63a' : '#6cbf67';

  return (
    <div
      className="bg-dusk-panel2 p-3.5 space-y-2"
      style={{ boxShadow: `0 0 0 2px ${insetColor} inset` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{riskIcon(analysis.recommendation, analysis.riskLevel)}</span>
          <span className="font-display text-[7px] text-cream tracking-wide">
            {isBlocked ? 'CANNOT BOTH WIN' : `${analysis.riskLevel.toUpperCase()} CORRELATION`}
          </span>
        </div>
        {analysis.correlationFlags.length > 0 && (
          <span className="font-display text-[6px] text-cream-secondary bg-dusk px-1.5 py-0.5">
            {analysis.correlationFlags.length} flagged pair{analysis.correlationFlags.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <p className="font-body text-xs text-cream-muted">{analysis.reasoning}</p>

      {analysis.oddsDiscrepancy !== 0 && (
        <div className="flex items-center justify-between font-body text-xs">
          <span className="text-cream-faint">Advertised odds</span>
          <span className="text-cream-faint line-through">
            {formatOdds(analysis.nominalOdds, useDecimalOdds)}
          </span>
        </div>
      )}
      {analysis.oddsDiscrepancy !== 0 && (
        <div className="flex items-center justify-between font-body text-xs">
          <span className="text-cream">True odds</span>
          <span className="font-display text-[9px] text-gold">
            {formatOdds(analysis.trueOdds, useDecimalOdds)}
          </span>
        </div>
      )}

      {analysis.suggestedFix && (
        <p className="font-body text-[11px] text-coral">{analysis.suggestedFix}</p>
      )}
    </div>
  );
}
