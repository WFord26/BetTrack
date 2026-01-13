import React, { useState } from 'react';
import { usePreferences, UserPreferences } from '../contexts/PreferencesContext';

export default function Preferences() {
  const { preferences, updatePreference } = usePreferences();
  const [showSavedMessage, setShowSavedMessage] = useState(false);

  // Wrap updatePreference to show saved message
  const handleUpdatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    updatePreference(key, value);
    
    // Show saved message briefly
    setShowSavedMessage(true);
    setTimeout(() => setShowSavedMessage(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Preferences
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Customize your dashboard experience
              </p>
            </div>
            
            {/* Saved Indicator */}
            {showSavedMessage && (
              <div className="flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-4 py-2 rounded-lg border border-green-300 dark:border-green-700 animate-fade-in">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">Saved</span>
              </div>
            )}
          </div>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* Display Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Display
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Odds Format
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Choose how odds are displayed
                  </p>
                </div>
                <select 
                  value={preferences.oddsFormat}
                  onChange={(e) => handleUpdatePreference('oddsFormat', e.target.value as UserPreferences['oddsFormat'])}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Odds format selection"
                >
                  <option value="american">American (-110)</option>
                  <option value="decimal">Decimal (1.91)</option>
                  <option value="fractional">Fractional (10/11)</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Default Sport
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Sport to show on dashboard load
                  </p>
                </div>
                <select 
                  value={preferences.defaultSport}
                  onChange={(e) => handleUpdatePreference('defaultSport', e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Default sport selection"
                >
                  <option value="all">All Sports</option>
                  <option value="basketball_nba">NBA</option>
                  <option value="americanfootball_nfl">NFL</option>
                  <option value="icehockey_nhl">NHL</option>
                  <option value="baseball_mlb">MLB</option>
                  <option value="basketball_ncaab">NCAAB</option>
                </select>
              </div>
            </div>
          </div>

          {/* Betting Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Betting
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Default Stake
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Pre-fill bet slip with this amount
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600 dark:text-gray-400">$</span>
                  <input
                    id="default-stake"
                    type="text"
                    inputMode="decimal"
                    aria-label="Default stake amount"
                    value={preferences.defaultStake}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue) && numValue >= 0) {
                          handleUpdatePreference('defaultStake', numValue);
                        } else if (value === '') {
                          handleUpdatePreference('defaultStake', 0);
                        }
                      }
                    }}
                    className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Preferred Bookmakers
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Show these books first (coming soon)
                  </p>
                </div>
                <button 
                  disabled
                  className="px-4 py-2 text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-not-allowed"
                >
                  Configure
                </button>
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
                  More preferences coming soon!
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Additional customization options will be added in future updates.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
