/**
 * Hedge Calculator
 *
 * Given the ID of an existing moneyline bet leg, finds the opposite side of
 * that game across every bookmaker with current odds and shows the stake
 * that locks in an equal profit either way. Pre-game only — there is no
 * in-play odds feed today, so live/mid-game hedging is out of scope.
 */

import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../store';
import {
  findHedgeOptions,
  clearHedgeOptions,
  selectHedgeOptions,
  selectCorrelationHedging,
} from '../../store/correlationSlice';
import { formatCurrency, formatOdds } from '../../utils/format';

export default function HedgeCalculator({ isDarkMode }: { isDarkMode: boolean }) {
  const dispatch = useDispatch<AppDispatch>();
  const options = useSelector(selectHedgeOptions);
  const hedging = useSelector(selectCorrelationHedging);

  const [betLegId, setBetLegId] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const cardBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const inputClass = `w-full rounded-md border px-3 py-2 text-sm ${
    isDarkMode
      ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
  }`;

  const handleSearch = () => {
    setValidationError(null);
    if (!betLegId.trim()) {
      setValidationError('Enter a bet leg ID (from a moneyline leg on your slip or history)');
      return;
    }
    setSearched(true);
    dispatch(findHedgeOptions(betLegId.trim()));
  };

  const handleReset = () => {
    setBetLegId('');
    setValidationError(null);
    setSearched(false);
    dispatch(clearHedgeOptions());
  };

  return (
    <div className={`rounded-lg border p-5 ${cardBg}`}>
      <div className="flex items-center justify-between mb-1">
        <h2 className={`text-lg font-semibold ${textPrimary}`}>Hedge Calculator</h2>
        <button type="button" onClick={handleReset} className={`text-xs ${textSecondary} hover:underline`}>
          Reset
        </button>
      </div>
      <p className={`text-xs mb-4 ${textSecondary}`}>
        Pre-game moneyline legs only. Stakes are normalized to a $100 original wager — scale
        proportionally to your actual stake.
      </p>

      <div className="flex gap-2 items-end mb-3">
        <div className="flex-1">
          <label className={`block text-xs font-medium mb-1 ${textSecondary}`} htmlFor="hedge-leg-id">
            Bet leg ID
          </label>
          <input
            id="hedge-leg-id"
            type="text"
            placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
            value={betLegId}
            onChange={(e) => setBetLegId(e.target.value)}
            className={inputClass}
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={hedging}
          className="text-sm font-medium px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {hedging ? 'Searching...' : 'Find hedges'}
        </button>
      </div>

      {validationError && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{validationError}</p>}

      {searched && !hedging && options.length === 0 && !validationError && (
        <p className={`text-sm ${textSecondary}`}>
          No hedge options found — either the leg isn't a moneyline, or there are no current odds
          for the opposite side.
        </p>
      )}

      {options.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className={textSecondary}>
              <th className="text-left font-medium pb-1">Bookmaker</th>
              <th className="text-right font-medium pb-1">Side</th>
              <th className="text-right font-medium pb-1">Odds</th>
              <th className="text-right font-medium pb-1">Hedge stake</th>
              <th className="text-right font-medium pb-1">Guaranteed profit</th>
            </tr>
          </thead>
          <tbody>
            {options.map((option, index) => (
              <tr key={`${option.bookmaker}-${index}`} className={textPrimary}>
                <td className="py-1">{option.bookmaker}</td>
                <td className="text-right py-1 capitalize">{option.selection}</td>
                <td className="text-right py-1">{formatOdds(option.odds)}</td>
                <td className="text-right py-1">{formatCurrency(option.hedgeStake)}</td>
                <td
                  className={`text-right py-1 font-semibold ${
                    option.guaranteedProfit >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {formatCurrency(option.guaranteedProfit)} ({option.guaranteedProfitPct.toFixed(1)}%)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
