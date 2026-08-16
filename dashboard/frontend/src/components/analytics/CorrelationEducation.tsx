/**
 * Correlation Education
 *
 * Fetches the static educational content from
 * GET /analytics/correlation/education and renders correlation types, a
 * glossary, and the warning-level legend used by the ParlayValidator.
 */

import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../store';
import {
  fetchCorrelationEducation,
  selectCorrelationEducation,
} from '../../store/correlationSlice';

export default function CorrelationEducation({ isDarkMode }: { isDarkMode: boolean }) {
  const dispatch = useDispatch<AppDispatch>();
  const content = useSelector(selectCorrelationEducation);

  useEffect(() => {
    if (!content) {
      dispatch(fetchCorrelationEducation());
    }
  }, [content, dispatch]);

  const cardBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const itemBorder = isDarkMode ? 'border-gray-700' : 'border-gray-200';

  if (!content) {
    return (
      <div className={`rounded-lg border p-5 ${cardBg}`}>
        <p className={`text-sm ${textSecondary}`}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border p-5 ${cardBg}`}>
        <h2 className={`text-lg font-semibold mb-3 ${textPrimary}`}>What is correlation?</h2>
        <div className="space-y-3">
          {content.correlationTypes.map((type) => (
            <div key={type.type} className={`border-b pb-3 last:border-0 last:pb-0 ${itemBorder}`}>
              <p className={`font-medium capitalize ${textPrimary}`}>{type.label}</p>
              <p className={`text-sm mt-0.5 ${textSecondary}`}>{type.summary}</p>
              <p className={`text-xs mt-1 italic ${textSecondary}`}>Example: {type.example}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={`rounded-lg border p-5 ${cardBg}`}>
        <h2 className={`text-lg font-semibold mb-3 ${textPrimary}`}>Warning levels</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {content.warningLevels.map((level) => (
            <div key={level.level} className={`rounded-md border p-3 text-center ${itemBorder}`}>
              <div className="text-2xl mb-1">{level.icon}</div>
              <p className={`text-xs font-medium capitalize ${textPrimary}`}>{level.level}</p>
              <p className={`text-[11px] mt-0.5 ${textSecondary}`}>{level.threshold}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={`rounded-lg border p-5 ${cardBg}`}>
        <h2 className={`text-lg font-semibold mb-3 ${textPrimary}`}>Glossary</h2>
        <dl className="space-y-2">
          {content.glossary.map((entry) => (
            <div key={entry.term}>
              <dt className={`text-sm font-medium ${textPrimary}`}>{entry.term}</dt>
              <dd className={`text-sm ${textSecondary}`}>{entry.definition}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
