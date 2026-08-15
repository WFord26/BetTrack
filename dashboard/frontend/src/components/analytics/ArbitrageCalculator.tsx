/**
 * Arbitrage Calculator
 *
 * Total stake plus per-leg American odds in, optimal stake split and
 * guaranteed profit out. Supports 2 to 4 legs (two-way and three-way arbs).
 */

import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../store';
import {
  calculateStakes,
  clearCalculatorResult,
  selectCalculatorResult,
  selectArbitrageCalculating,
} from '../../store/arbitrageSlice';
import { formatCurrency } from '../../utils/format';

interface LegInput {
  bookmaker: string;
  odds: string;
}

const EMPTY_LEG: LegInput = { bookmaker: '', odds: '' };

interface Props {
  isDarkMode: boolean;
  initialOdds?: number[];
  initialBookmakers?: string[];
  initialStake?: number;
}

export default function ArbitrageCalculator({
  isDarkMode,
  initialOdds,
  initialBookmakers,
  initialStake,
}: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const result = useSelector(selectCalculatorResult);
  const calculating = useSelector(selectArbitrageCalculating);

  const [totalStake, setTotalStake] = useState<string>(String(initialStake ?? 1000));
  const [legs, setLegs] = useState<LegInput[]>(
    initialOdds && initialOdds.length >= 2
      ? initialOdds.map((odds, i) => ({
          bookmaker: initialBookmakers?.[i] ?? '',
          odds: String(odds),
        }))
      : [{ ...EMPTY_LEG }, { ...EMPTY_LEG }]
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const cardBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const inputClass = `w-full rounded-md border px-3 py-2 text-sm ${
    isDarkMode
      ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
  }`;

  const updateLeg = (index: number, patch: Partial<LegInput>) => {
    setLegs((prev) => prev.map((leg, i) => (i === index ? { ...leg, ...patch } : leg)));
  };

  const addLeg = () => {
    if (legs.length >= 4) return;
    setLegs((prev) => [...prev, { ...EMPTY_LEG }]);
  };

  const removeLeg = (index: number) => {
    if (legs.length <= 2) return;
    setLegs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCalculate = () => {
    setValidationError(null);

    const stake = parseFloat(totalStake);
    if (!Number.isFinite(stake) || stake <= 0) {
      setValidationError('Enter a positive total stake');
      return;
    }

    const parsed = legs.map((leg) => parseInt(leg.odds, 10));
    if (parsed.some((odds) => !Number.isFinite(odds) || odds === 0)) {
      setValidationError('Every leg needs non zero American odds, for example -110 or +145');
      return;
    }

    dispatch(calculateStakes({ odds: parsed, totalStake: stake }));
  };

  const handleReset = () => {
    setLegs([{ ...EMPTY_LEG }, { ...EMPTY_LEG }]);
    setTotalStake('1000');
    setValidationError(null);
    dispatch(clearCalculatorResult());
  };

  return (
    <div className={`rounded-lg border p-5 ${cardBg}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-lg font-semibold ${textPrimary}`}>Arbitrage Calculator</h2>
        <button
          type="button"
          onClick={handleReset}
          className={`text-xs ${textSecondary} hover:underline`}
        >
          Reset
        </button>
      </div>

      <div className="mb-4">
        <label className={`block text-xs font-medium mb-1 ${textSecondary}`} htmlFor="arb-total-stake">
          Total stake
        </label>
        <input
          id="arb-total-stake"
          type="number"
          min="1"
          step="1"
          value={totalStake}
          onChange={(e) => setTotalStake(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="space-y-3 mb-4">
        {legs.map((leg, index) => (
          <div key={index} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-6">
              <label
                className={`block text-xs font-medium mb-1 ${textSecondary}`}
                htmlFor={`arb-book-${index}`}
              >
                Leg {index + 1} bookmaker
              </label>
              <input
                id={`arb-book-${index}`}
                type="text"
                placeholder="DraftKings"
                value={leg.bookmaker}
                onChange={(e) => updateLeg(index, { bookmaker: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="col-span-4">
              <label
                className={`block text-xs font-medium mb-1 ${textSecondary}`}
                htmlFor={`arb-odds-${index}`}
              >
                American odds
              </label>
              <input
                id={`arb-odds-${index}`}
                type="number"
                placeholder="-110"
                value={leg.odds}
                onChange={(e) => updateLeg(index, { odds: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="col-span-2">
              <button
                type="button"
                onClick={() => removeLeg(index)}
                disabled={legs.length <= 2}
                aria-label={`Remove leg ${index + 1}`}
                className={`w-full rounded-md border px-2 py-2 text-sm ${
                  legs.length <= 2
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-red-50 dark:hover:bg-red-900/30'
                } ${isDarkMode ? 'border-gray-700 text-gray-300' : 'border-gray-300 text-gray-600'}`}
              >
                &minus;
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={addLeg}
          disabled={legs.length >= 4}
          className={`text-xs px-3 py-1.5 rounded-md border ${
            legs.length >= 4 ? 'opacity-40 cursor-not-allowed' : ''
          } ${isDarkMode ? 'border-gray-700 text-gray-300' : 'border-gray-300 text-gray-700'}`}
        >
          Add leg
        </button>
        <button
          type="button"
          onClick={handleCalculate}
          disabled={calculating}
          className="text-sm font-medium px-4 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {calculating ? 'Calculating...' : 'Calculate stakes'}
        </button>
      </div>

      {validationError && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-3">{validationError}</p>
      )}

      {result && (
        <div
          className={`rounded-md p-4 ${
            result.isArbitrage
              ? isDarkMode
                ? 'bg-green-900/30 border border-green-800'
                : 'bg-green-50 border border-green-200'
              : isDarkMode
              ? 'bg-yellow-900/30 border border-yellow-800'
              : 'bg-yellow-50 border border-yellow-200'
          }`}
        >
          <p className={`text-sm font-semibold mb-2 ${textPrimary}`}>
            {result.isArbitrage
              ? `Arbitrage: ${result.profitPercentage.toFixed(2)}% guaranteed`
              : `No arbitrage: implied probability totals ${(result.totalImpliedProbability * 100).toFixed(2)}%`}
          </p>

          <table className="w-full text-sm">
            <thead>
              <tr className={textSecondary}>
                <th className="text-left font-medium pb-1">Leg</th>
                <th className="text-right font-medium pb-1">Odds</th>
                <th className="text-right font-medium pb-1">Stake</th>
                <th className="text-right font-medium pb-1">Returns</th>
              </tr>
            </thead>
            <tbody>
              {result.stakes.map((stake, index) => (
                <tr key={index} className={textPrimary}>
                  <td className="py-0.5">{legs[index]?.bookmaker || `Leg ${index + 1}`}</td>
                  <td className="text-right py-0.5">
                    {result.odds[index] > 0 ? `+${result.odds[index]}` : result.odds[index]}
                  </td>
                  <td className="text-right py-0.5">{formatCurrency(stake)}</td>
                  <td className="text-right py-0.5">{formatCurrency(result.payouts[index])}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={`mt-3 pt-3 border-t flex justify-between text-sm ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <span className={textSecondary}>Worst case profit</span>
            <span className={`font-semibold ${
              result.guaranteedProfit >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formatCurrency(result.guaranteedProfit)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
