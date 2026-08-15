/**
 * Correlation Analysis Dashboard
 *
 * Reference tools for parlay correlation: a heatmap of correlation strength
 * by selection type, a pre-game hedge calculator, past parlay analyses, and
 * an education module. Real-time parlay warnings live in the bet slip
 * itself (see ParlayValidator.tsx) — this page is the reference/education
 * surface, not where the live check happens.
 */

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../store';
import { useDarkMode } from '../contexts/DarkModeContext';
import {
  fetchCorrelationHistory,
  selectCorrelationHistory,
  selectCorrelationLoading,
} from '../store/correlationSlice';
import { formatOdds } from '../utils/format';
import CorrelationHeatmap from '../components/analytics/CorrelationHeatmap';
import HedgeCalculator from '../components/analytics/HedgeCalculator';
import CorrelationEducation from '../components/analytics/CorrelationEducation';

type TabKey = 'heatmap' | 'hedge' | 'history' | 'education';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'heatmap', label: 'Heatmap' },
  { key: 'hedge', label: 'Hedge Calculator' },
  { key: 'history', label: 'History' },
  { key: 'education', label: 'Learn' },
];

function riskBadgeClass(risk: string, isDarkMode: boolean): string {
  switch (risk) {
    case 'low':
      return isDarkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800';
    case 'medium':
      return isDarkMode ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-800';
    default:
      return isDarkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800';
  }
}

export default function CorrelationDashboard() {
  const { isDarkMode } = useDarkMode();
  const dispatch = useDispatch<AppDispatch>();
  const history = useSelector(selectCorrelationHistory);
  const loading = useSelector(selectCorrelationLoading);
  const [tab, setTab] = useState<TabKey>('heatmap');

  useEffect(() => {
    if (tab === 'history') {
      dispatch(fetchCorrelationHistory({ limit: 50 }));
    }
  }, [tab, dispatch]);

  const pageBg = isDarkMode ? 'bg-gray-900' : 'bg-gray-50';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const cardBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  return (
    <div className={`min-h-screen ${pageBg}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className={`text-3xl font-bold mb-2 ${textPrimary}`}>Correlation Analysis</h1>
          <p className={textSecondary}>
            Understand how your parlay legs relate to each other, find hedges, and see the
            correlation-adjusted true odds behind every parlay. Live warnings appear in the bet
            slip as you build a parlay.
          </p>
        </div>

        <div className="flex gap-2 mb-5 flex-wrap">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`text-sm font-medium px-4 py-2 rounded-md ${
                tab === item.key
                  ? 'bg-blue-600 text-white'
                  : isDarkMode
                  ? 'bg-gray-800 text-gray-300 border border-gray-700'
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'heatmap' && <CorrelationHeatmap isDarkMode={isDarkMode} />}

        {tab === 'hedge' && (
          <div className="max-w-2xl">
            <HedgeCalculator isDarkMode={isDarkMode} />
          </div>
        )}

        {tab === 'education' && <CorrelationEducation isDarkMode={isDarkMode} />}

        {tab === 'history' && (
          <div className={`rounded-lg border p-5 ${cardBg}`}>
            <h2 className={`text-lg font-semibold mb-3 ${textPrimary}`}>Past parlay analyses</h2>
            {loading ? (
              <p className={`text-sm ${textSecondary}`}>Loading...</p>
            ) : history.length === 0 ? (
              <p className={`text-sm ${textSecondary}`}>
                No parlay analyses yet — they're saved automatically whenever a signed-in user
                analyzes a placed parlay.
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((analysis, index) => (
                  <div
                    key={analysis.betId ?? index}
                    className={`border-b pb-3 last:border-0 last:pb-0 ${
                      isDarkMode ? 'border-gray-700' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${riskBadgeClass(
                          analysis.riskLevel,
                          isDarkMode
                        )}`}
                      >
                        {analysis.riskLevel} risk · {analysis.recommendation}
                      </span>
                      <span className={`text-sm ${textSecondary}`}>
                        {formatOdds(analysis.nominalOdds)} → {formatOdds(analysis.trueOdds)}
                      </span>
                    </div>
                    <p className={`text-sm ${textPrimary}`}>{analysis.reasoning}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
