import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../store';
import {
  fetchLiveArbitrage,
  selectAlertingOpportunities,
  selectAlertSettings,
  setAlertSettings,
} from '../store/arbitrageSlice';
import { formatCurrency, formatRelativeTime } from '../utils/format';

const ARB_POLL_INTERVAL_MS = 30000;

export default function Notifications() {
  const dispatch = useDispatch<AppDispatch>();
  const alerting = useSelector(selectAlertingOpportunities);
  const alertSettings = useSelector(selectAlertSettings);

  // v1 alert delivery is in-app: poll the live endpoint and surface anything
  // clearing the user's thresholds. Push, email and SMS are a follow-up.
  useEffect(() => {
    const load = () => {
      dispatch(fetchLiveArbitrage({}));
    };
    load();
    const timer = window.setInterval(load, ARB_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Notifications
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage how and when you receive notifications
          </p>
        </div>

        {/* Notification Settings */}
        <div className="space-y-6">
          {/* Arbitrage Alerts (live, in-app) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Arbitrage Alerts
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Opportunities above {alertSettings.minProfitPercentage}% profit from the latest
                  odds snapshot
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={alertSettings.enabled}
                  onChange={(e) => dispatch(setAlertSettings({ enabled: e.target.checked }))}
                  aria-label="Enable arbitrage alerts"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {!alertSettings.enabled ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Alerts are turned off.
              </p>
            ) : alerting.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nothing above your thresholds right now.
              </p>
            ) : (
              <ul className="space-y-3">
                {alerting.map((opportunity) => (
                  <li
                    key={opportunity.id}
                    className="flex items-start justify-between gap-3 border border-gray-200 dark:border-gray-700 rounded-md p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {opportunity.game
                          ? `${opportunity.game.awayTeamName} @ ${opportunity.game.homeTeamName}`
                          : 'Game unavailable'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {opportunity.legs.map((leg) => leg.bookmaker).join(' / ')} ·{' '}
                        {formatCurrency(Number(opportunity.expectedProfit))} on{' '}
                        {formatCurrency(Number(opportunity.stake))} · snapshot{' '}
                        {Math.round(opportunity.oddsSnapshotAge / 60)}m old · detected{' '}
                        {formatRelativeTime(opportunity.detectedAt)}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400 whitespace-nowrap">
                      +{Number(opportunity.profitPercentage).toFixed(2)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <Link
              to="/analytics/arbitrage"
              className="inline-block mt-4 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Open the arbitrage dashboard
            </Link>
          </div>

          {/* Bet Status Updates */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Bet Status Updates
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Wins
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Notify when a bet wins
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked aria-label="Enable win notifications" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Losses
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Notify when a bet loses
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" aria-label="Enable loss notifications" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Pushes
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Notify when a bet pushes
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" aria-label="Enable push notifications" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Line Movement Alerts */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Line Movement Alerts
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Favorable Movement
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Alert when odds move in your favor
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" aria-label="Enable favorable movement alerts" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Significant Moves
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Alert on major line movements (5+ points)
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" aria-label="Enable major line movement alerts" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Coming Soon Notice */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  External delivery channels coming soon
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Arbitrage alerts above are live and in-app. Email, browser push and SMS delivery will be added in a future update; the bet and line movement toggles are still placeholders.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
