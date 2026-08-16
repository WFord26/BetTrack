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
    <footer className="fixed bottom-0 left-0 right-0 bg-dusk-chrome text-cream-muted py-2 px-4 text-xs z-40 font-body">
      <div className="max-w-7xl mx-auto">
        {/* Main Footer Row */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: Copyright & Versions */}
          <div className="flex items-center gap-3">
            <span className="text-cream">© {currentYear} BETTRACK</span>
            <span className="text-cream-faint">·</span>
            <span className="text-cream-faint" title="Frontend Version">FE v{FRONTEND_VERSION}</span>
            <span className="text-cream-faint">·</span>
            <span className="text-cream-faint" title="Backend Version">BE v{backendVersion ?? '...'}</span>
          </div>

          {/* Center: API Requests (Dev Only) */}
          {isDevelopment && apiRequestsRemaining !== null && (
            <div className="flex items-center gap-2">
              <span className="text-cream-faint">API Requests:</span>
              <span className={`font-bold ${apiRequestsRemaining < 50 ? 'text-coral' : apiRequestsRemaining < 100 ? 'text-gold' : 'text-sunwin-dark'}`}>
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
              className="text-cream-faint hover:text-gold transition-colors underline"
            >
              Responsible Gaming
            </a>
            <span className="text-cream-faint">·</span>
            <a
              href="https://github.com/wford26/BetTrack"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cream-faint hover:text-gold transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>

        {/* Bottom Row: Disclaimer (subtle) */}
        <div className="mt-1 pt-1 border-t border-dusk-panel2">
          <p className="text-center text-cream-faint text-[10px]">
            BetTrack is a tracking tool only. We do not facilitate betting. Please gamble responsibly.
            If you or someone you know has a gambling problem, call 1-800-GAMBLER.
          </p>
        </div>
      </div>
    </footer>
  );
}
