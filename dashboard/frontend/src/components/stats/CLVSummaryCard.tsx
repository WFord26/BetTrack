/**
 * CLV Summary Card - Dashboard widget displaying key CLV metrics
 * Closing Line Value (CLV) is the #1 indicator of long-term betting profitability
 */
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../store';
import { fetchCLVSummary, selectCLVSummary, selectCLVLoading, selectCLVError } from '../../store/clvSlice';
import { formatPercentage } from '../../utils/format';

const EMPTY_BLOCK = '#e4d2ae';

function Meter({ ratio, color }: { ratio: number; color: string }) {
  const filled = Math.round(Math.min(Math.max(ratio, 0), 1) * 10);
  return (
    <div className="flex gap-[3px] mt-1.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="w-[10px] h-[10px]"
          style={{ backgroundColor: i < filled ? color : EMPTY_BLOCK }}
        />
      ))}
    </div>
  );
}

export default function CLVSummaryCard() {
  const dispatch = useDispatch<AppDispatch>();
  const summary = useSelector(selectCLVSummary);
  const loading = useSelector(selectCLVLoading);
  const error = useSelector(selectCLVError);

  useEffect(() => {
    dispatch(fetchCLVSummary());
  }, [dispatch]);

  if (loading && !summary) {
    return (
      <div className="ds-card-ink px-5 py-[18px]">
        <div className="animate-pulse">
          <div className="h-3 bg-sand-divider w-1/3 mb-4"></div>
          <div className="h-6 bg-sand-divider w-1/2 mb-2"></div>
          <div className="h-3 bg-sand-divider w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ds-card-ink px-5 py-[18px] border-sunloss-light">
        <div className="flex items-center gap-2 text-sunloss-light">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="font-body text-sm font-medium">Failed to load CLV data</span>
        </div>
      </div>
    );
  }

  if (!summary || summary.totalBets === 0) {
    return (
      <div className="ds-card-ink px-5 py-[18px]">
        <h3 className="font-display text-[9px] text-ink mb-2">CLOSING LINE VALUE</h3>
        <p className="font-body text-sm text-ink-muted">
          No bet data available. Place bets with closing odds to see CLV analytics.
        </p>
      </div>
    );
  }

  // Calculate CLV category ratios (0-1, natural fit for the block meter)
  const totalBets = summary.totalBets;
  const positiveRatio = summary.positiveCLVCount / totalBets;
  const negativeRatio = summary.negativeCLVCount / totalBets;
  const neutralRatio = summary.neutralCLVCount / totalBets;

  // Determine overall CLV color — thresholds preserved from original logic
  const clvValueClass = summary.averageCLV >= 2
    ? 'text-sunwin-light'
    : summary.averageCLV <= -2
    ? 'text-sunloss-light'
    : 'text-gold-headline';

  const roiDelta = summary.actualROI - summary.expectedROI;

  return (
    <div className="ds-card-ink overflow-hidden">
      {/* Header */}
      <div className="px-5 py-[18px] border-b-[3px] border-ink flex items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-[9px] text-ink">CLOSING LINE VALUE</h3>
          <p className="font-body text-[12px] text-ink-muted mt-1">Avg CLV across {totalBets} bets</p>
        </div>
        <div className={`font-display text-[16px] ${clvValueClass}`}>
          {summary.averageCLV > 0 ? '+' : ''}{summary.averageCLV.toFixed(2)}%
        </div>
      </div>

      <div className="px-5 py-[18px] space-y-4">
        {/* CLV Distribution */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-display text-[7px] text-ink-muted tracking-[.1em] uppercase">CLV Distribution</span>
            <span className="font-body text-[12px] text-ink-muted">{totalBets} total</span>
          </div>

          <div className="space-y-2.5">
            <div>
              <div className="flex items-center justify-between font-body text-[12px] mb-1">
                <span className="text-sunwin-light font-medium">Positive CLV</span>
                <span className="text-ink-muted">{summary.positiveCLVCount} ({(positiveRatio * 100).toFixed(0)}%)</span>
              </div>
              <Meter ratio={positiveRatio} color="#4f8f3f" />
            </div>

            <div>
              <div className="flex items-center justify-between font-body text-[12px] mb-1">
                <span className="text-gold-headline font-medium">Neutral CLV</span>
                <span className="text-ink-muted">{summary.neutralCLVCount} ({(neutralRatio * 100).toFixed(0)}%)</span>
              </div>
              <Meter ratio={neutralRatio} color="#e0a512" />
            </div>

            <div>
              <div className="flex items-center justify-between font-body text-[12px] mb-1">
                <span className="text-sunloss-light font-medium">Negative CLV</span>
                <span className="text-ink-muted">{summary.negativeCLVCount} ({(negativeRatio * 100).toFixed(0)}%)</span>
              </div>
              <Meter ratio={negativeRatio} color="#c0392b" />
            </div>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t-2 border-sand-divider">
          <div>
            <p className="font-display text-[7px] text-ink-muted tracking-[.1em] uppercase mb-1.5">CLV Win Rate</p>
            <p className="font-display text-[14px] text-ink">
              {formatPercentage(summary.clvWinRate)}
            </p>
          </div>

          <div>
            <p className="font-display text-[7px] text-ink-muted tracking-[.1em] uppercase mb-1.5">Expected ROI</p>
            <p className={`font-display text-[14px] ${summary.expectedROI >= 0 ? 'text-sunwin-light' : 'text-sunloss-light'}`}>
              {summary.expectedROI > 0 ? '+' : ''}{summary.expectedROI.toFixed(2)}%
            </p>
          </div>

          <div>
            <p className="font-display text-[7px] text-ink-muted tracking-[.1em] uppercase mb-1.5">Actual ROI</p>
            <p className={`font-display text-[14px] ${summary.actualROI >= 0 ? 'text-sunwin-light' : 'text-sunloss-light'}`}>
              {summary.actualROI > 0 ? '+' : ''}{summary.actualROI.toFixed(2)}%
            </p>
          </div>

          <div>
            <p className="font-display text-[7px] text-ink-muted tracking-[.1em] uppercase mb-1.5">ROI Delta</p>
            <p className={`font-display text-[14px] ${roiDelta >= 0 ? 'text-sunwin-light' : 'text-sunloss-light'}`}>
              {roiDelta > 0 ? '+' : ''}{roiDelta.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Info blurb */}
        <div className="pt-4 border-t-2 border-sand-divider">
          <div className="flex items-start gap-2 font-body text-[12px] text-ink-muted">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p>
              <strong className="text-ink">CLV</strong> measures how your betting odds compare to closing market lines.
              Positive CLV indicates value betting and correlates with long-term profitability.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
