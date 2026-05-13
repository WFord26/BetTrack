import React, { useEffect, useState } from 'react';
import api from '../services/api';
// Build-time: Vite bundles the version from the frontend package.json
import { version as FRONTEND_VERSION } from '../../package.json';

export default function Footer() {
  const [apiRequestsRemaining, setApiRequestsRemaining] = useState<number | null>(null);
  const [backendVersion, setBackendVersion] = useState<string | null>(null);
  const isDevelopment = import.meta.env.DEV;

  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        const response = await api.get('/admin/health');
        const data = response.data?.data;
        if (data?.apiRequestsRemaining !== undefined) {
          setApiRequestsRemaining(data.apiRequestsRemaining);
        }
        if (data?.version) {
          setBackendVersion(data.version);
        }
      } catch (error) {
        console.error('Failed to fetch health data:', error);
      }
    };

    // Fetch on mount always (for BE version), then poll in dev for API quota
    fetchHealthData();
    if (isDevelopment) {
      const interval = setInterval(fetchHealthData, 30000);
      return () => clearInterval(interval);
    }
  }, [isDevelopment]);

  const currentYear = new Date().getFullYear();

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white py-2 px-4 text-xs z-40"
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
      <div className="max-w-7xl mx-auto">
        {/* Main Footer Row */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: Copyright & Versions */}
          <div className="flex items-center gap-3">
            <span>© {currentYear} BetTrack</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-400" title="Frontend Version">FE v{FRONTEND_VERSION}</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-400" title="Backend Version">BE v{backendVersion ?? '...'}</span>
          </div>

          {/* Center: API Requests (Dev Only) */}
          {isDevelopment && apiRequestsRemaining !== null && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">API Requests:</span>
              <span className={`font-bold ${apiRequestsRemaining < 50 ? 'text-red-400' : apiRequestsRemaining < 100 ? 'text-yellow-400' : 'text-green-400'}`}>
                {apiRequestsRemaining}
              </span>
            </div>
          )}

          {/* Right: Links & Info */}
          <div className="flex items-center gap-3">
            <a 
              href="https://www.ncpgambling.org/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors underline"
            >
              Responsible Gaming
            </a>
            <span className="text-gray-400">•</span>
            <a 
              href="https://github.com/wford26/BetTrack" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>

        {/* Bottom Row: Disclaimer (subtle) */}
        <div className="mt-1 pt-1 border-t border-gray-700">
          <p className="text-center text-gray-500 text-[10px]">
            BetTrack is a tracking tool only. We do not facilitate betting. Please gamble responsibly. 
            If you or someone you know has a gambling problem, call 1-800-GAMBLER.
          </p>
        </div>
      </div>
    </footer>
  );
}
