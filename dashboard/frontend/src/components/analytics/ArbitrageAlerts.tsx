/**
 * Arbitrage Alert Settings
 *
 * v1 delivery is in-app only: the dashboard polls the live endpoint and the
 * thresholds below decide which opportunities are surfaced as alerts. Push,
 * email, SMS and webhook delivery are a separate follow-up.
 */

import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../store';
import {
  setAlertSettings,
  resetAlertSettings,
  selectAlertSettings,
} from '../../store/arbitrageSlice';

interface Props {
  isDarkMode: boolean;
  availableBookmakers?: string[];
  availableSports?: Array<{ key: string; name: string }>;
}

export default function ArbitrageAlerts({
  isDarkMode,
  availableBookmakers = [],
  availableSports = [],
}: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const settings = useSelector(selectAlertSettings);

  const cardBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const inputClass = `w-full rounded-md border px-3 py-2 text-sm ${
    isDarkMode
      ? 'bg-gray-900 border-gray-700 text-white'
      : 'bg-white border-gray-300 text-gray-900'
  }`;

  const toggleInList = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <div className={`rounded-lg border p-5 ${cardBg}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-lg font-semibold ${textPrimary}`}>Alert Settings</h2>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={settings.enabled}
            onChange={(e) => dispatch(setAlertSettings({ enabled: e.target.checked }))}
            aria-label="Enable arbitrage alerts"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label
            className={`block text-xs font-medium mb-1 ${textSecondary}`}
            htmlFor="arb-min-profit"
          >
            Minimum profit %
          </label>
          <input
            id="arb-min-profit"
            type="number"
            min="0"
            step="0.25"
            value={settings.minProfitPercentage}
            onChange={(e) =>
              dispatch(setAlertSettings({ minProfitPercentage: parseFloat(e.target.value) || 0 }))
            }
            className={inputClass}
          />
        </div>

        <div>
          <label className={`block text-xs font-medium mb-1 ${textSecondary}`} htmlFor="arb-max-stake">
            Max stake per opportunity
          </label>
          <input
            id="arb-max-stake"
            type="number"
            min="0"
            step="50"
            value={settings.maxStake}
            onChange={(e) =>
              dispatch(setAlertSettings({ maxStake: parseFloat(e.target.value) || 0 }))
            }
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={`block text-xs font-medium mb-1 ${textSecondary}`} htmlFor="arb-max-age">
            Maximum odds snapshot age (seconds)
          </label>
          <input
            id="arb-max-age"
            type="number"
            min="30"
            step="30"
            value={settings.maxSnapshotAgeSeconds}
            onChange={(e) =>
              dispatch(
                setAlertSettings({ maxSnapshotAgeSeconds: parseInt(e.target.value, 10) || 600 })
              )
            }
            className={inputClass}
          />
          <p className={`text-xs mt-1 ${textSecondary}`}>
            Odds refresh on the sync cadence, so anything below that interval will filter out most
            opportunities.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <p className={`text-sm font-medium ${textPrimary}`}>Include middles</p>
          <p className={`text-xs ${textSecondary}`}>
            Middles are positive expected value, not guaranteed profit
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={settings.includeMiddles}
            onChange={(e) => dispatch(setAlertSettings({ includeMiddles: e.target.checked }))}
            aria-label="Include middle opportunities in alerts"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {availableBookmakers.length > 0 && (
        <div className="mb-4">
          <p className={`text-xs font-medium mb-2 ${textSecondary}`}>
            Bookmakers you hold accounts with (empty means all)
          </p>
          <div className="flex flex-wrap gap-2">
            {availableBookmakers.map((book) => {
              const active = settings.preferredBookmakers.includes(book);
              return (
                <button
                  key={book}
                  type="button"
                  onClick={() =>
                    dispatch(
                      setAlertSettings({
                        preferredBookmakers: toggleInList(settings.preferredBookmakers, book),
                      })
                    )
                  }
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600'
                      : isDarkMode
                      ? 'border-gray-700 text-gray-300'
                      : 'border-gray-300 text-gray-700'
                  }`}
                >
                  {book}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {availableSports.length > 0 && (
        <div className="mb-4">
          <p className={`text-xs font-medium mb-2 ${textSecondary}`}>Sports (empty means all)</p>
          <div className="flex flex-wrap gap-2">
            {availableSports.map((sport) => {
              const active = settings.sports.includes(sport.key);
              return (
                <button
                  key={sport.key}
                  type="button"
                  onClick={() =>
                    dispatch(setAlertSettings({ sports: toggleInList(settings.sports, sport.key) }))
                  }
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600'
                      : isDarkMode
                      ? 'border-gray-700 text-gray-300'
                      : 'border-gray-300 text-gray-700'
                  }`}
                >
                  {sport.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => dispatch(resetAlertSettings())}
          className={`text-xs ${textSecondary} hover:underline`}
        >
          Reset to defaults
        </button>
        <p className={`text-xs ${textSecondary}`}>
          Delivered in-app. Push, email and SMS are planned.
        </p>
      </div>
    </div>
  );
}
