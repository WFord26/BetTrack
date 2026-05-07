import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface SiteConfig {
  id: number;
  siteName: string;
  logoUrl: string | null;
  domainUrl: string | null;
}

interface Sport {
  key: string;
  name: string;
  isActive: boolean;
}

type SyncStatus = 'idle' | 'running' | 'success' | 'error';

interface SyncState {
  status: SyncStatus;
  message: string | null;
}

export default function AdminSettings() {
  const { user, authEnabled } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [siteName, setSiteName] = useState('Sports Betting');
  const [logoUrl, setLogoUrl] = useState('');
  const [domainUrl, setDomainUrl] = useState('');

  const [sports, setSports] = useState<Sport[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [initSync, setInitSync] = useState<SyncState>({ status: 'idle', message: null });
  const [oddsSync, setOddsSync] = useState<SyncState>({ status: 'idle', message: null });

  const hasAdminAccess = !authEnabled || (user && (user as any).isAdmin);

  useEffect(() => {
    if (!hasAdminAccess) {
      setError('Access denied. Admin privileges required.');
      setLoading(false);
      return;
    }

    Promise.all([loadConfig(), loadSports()]);
  }, [hasAdminAccess]);

  const loadConfig = async () => {
    try {
      setError(null);
      const response = await api.get('/admin/site-config');
      const config: SiteConfig = response.data.data;
      setSiteName(config.siteName || 'Sports Betting');
      setLogoUrl(config.logoUrl || '');
      setDomainUrl(config.domainUrl || '');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const loadSports = async () => {
    try {
      const response = await api.get('/admin/sports');
      setSports(response.data.data || []);
    } catch {
      // Non-fatal — sport selector will just be empty
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.put('/admin/site-config', {
        siteName: siteName.trim(),
        logoUrl: logoUrl.trim() || null,
        domainUrl: domainUrl.trim() || null,
      });

      setSuccess('Site configuration updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleInitSports = async () => {
    setInitSync({ status: 'running', message: null });
    try {
      const response = await api.post('/admin/init-sports');
      const count = response.data.data?.length ?? 0;
      setInitSync({ status: 'success', message: `${count} sports initialized.` });
      await loadSports();
    } catch (err: any) {
      setInitSync({ status: 'error', message: err.response?.data?.message || 'Failed to initialize sports.' });
    }
  };

  const handleSyncOdds = async () => {
    setOddsSync({ status: 'running', message: null });
    try {
      await api.post('/admin/sync-odds', {
        sportKey: selectedSport === 'all' ? undefined : selectedSport,
      });
      setOddsSync({ status: 'success', message: 'Sync started in background. Games will appear shortly.' });
    } catch (err: any) {
      setOddsSync({ status: 'error', message: err.response?.data?.message || 'Failed to start sync.' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-center">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">Access Denied</h3>
                <p className="text-red-700 dark:text-red-300 mt-1">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-8 transition-colors">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Admin Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">Configure site branding and manage data sync</p>
        </div>

        {/* Global success / error banners */}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-green-800 dark:text-green-200">{success}</p>
          </div>
        )}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Site Config */}
        <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Site Configuration</h2>

          <div>
            <label htmlFor="siteName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Site Name
            </label>
            <input
              type="text"
              id="siteName"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              maxLength={100}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
              placeholder="Sports Betting"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Appears in the header and browser title</p>
          </div>

          <div>
            <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Logo URL
            </label>
            <input
              type="url"
              id="logoUrl"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              maxLength={500}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
              placeholder="https://example.com/logo.png"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Leave empty to use the default gradient logo</p>
            {logoUrl && (
              <div className="mt-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Preview:</p>
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  className="h-10 max-w-[200px] object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="domainUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Domain URL
            </label>
            <input
              type="url"
              id="domainUrl"
              value={domainUrl}
              onChange={(e) => setDomainUrl(e.target.value)}
              maxLength={255}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
              placeholder="https://yourdomain.com"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Optional: your hosted domain for reference</p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-1">Admin Access</p>
                <p>
                  {authEnabled
                    ? 'In multi-user mode, only users with admin privileges can access this page.'
                    : 'In single-user mode (no authentication), admin settings are available to everyone.'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
            <button
              type="button"
              onClick={loadConfig}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              Reset
            </button>
          </div>
        </form>

        {/* Data Sync */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Data Sync</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Initialize sports and pull the latest odds from the external API
            </p>
          </div>

          {/* Initialize Sports */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Initialize Sports</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Seeds the database with the supported sport list. Run this once on first setup or to restore missing sports.
              </p>
            </div>

            <SyncFeedback state={initSync} />

            <button
              type="button"
              onClick={handleInitSports}
              disabled={initSync.status === 'running'}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-700 dark:bg-gray-100 dark:hover:bg-white dark:text-gray-900 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {initSync.status === 'running' ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M9 3h6M9 3a1 1 0 00-1 1v1h8V4a1 1 0 00-1-1M9 3H7" />
                </svg>
              )}
              {initSync.status === 'running' ? 'Initializing…' : 'Initialize Sports'}
            </button>
          </div>

          {/* Sync Odds */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Sync Odds</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Fetches upcoming games and current odds from the API. Runs in the background — the dashboard will update within a few seconds.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="syncSport" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Sport
              </label>
              <select
                id="syncSport"
                value={selectedSport}
                onChange={(e) => setSelectedSport(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              >
                <option value="all">All Sports</option>
                {sports.map((s) => (
                  <option key={s.key} value={s.key}>{s.name}</option>
                ))}
              </select>
            </div>

            <SyncFeedback state={oddsSync} />

            <button
              type="button"
              onClick={handleSyncOdds}
              disabled={oddsSync.status === 'running'}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {oddsSync.status === 'running' ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {oddsSync.status === 'running' ? 'Starting sync…' : 'Sync Odds'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SyncFeedback({ state }: { state: SyncState }) {
  if (state.status === 'idle') return null;

  const styles: Record<SyncStatus, string> = {
    idle: '',
    running: 'text-blue-600 dark:text-blue-400',
    success: 'text-green-600 dark:text-green-400',
    error: 'text-red-600 dark:text-red-400',
  };

  const icons: Record<Exclude<SyncStatus, 'idle'>, React.ReactNode> = {
    running: (
      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    ),
    success: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  };

  return (
    <div className={`flex items-center gap-2 text-sm ${styles[state.status]}`}>
      {icons[state.status as Exclude<SyncStatus, 'idle'>]}
      <span>{state.status === 'running' ? 'Working…' : state.message}</span>
    </div>
  );
}
