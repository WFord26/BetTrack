import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function Footer() {
  const [apiRequestsRemaining, setApiRequestsRemaining] = useState<number | null>(null);

  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        const response = await api.get('/admin/health');
        if (response.data?.data?.apiRequestsRemaining !== undefined) {
          setApiRequestsRemaining(response.data.data.apiRequestsRemaining);
        }
      } catch (error) {
        console.error('Failed to fetch health data:', error);
      }
    };

    // Fetch on mount
    fetchHealthData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchHealthData, 30000);

    return () => clearInterval(interval);
  }, []);

  const currentYear = new Date().getFullYear();

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white py-3 px-6 flex items-center justify-between text-sm z-40">
      <div>
        © {currentYear} Sports Odds Dashboard. All rights reserved.
      </div>
      <div className="flex items-center gap-2">
        {apiRequestsRemaining !== null && (
          <>
            <span className="text-gray-400">API Requests Remaining:</span>
            <span className={`font-bold ${apiRequestsRemaining < 50 ? 'text-red-400' : apiRequestsRemaining < 100 ? 'text-yellow-400' : 'text-green-400'}`}>
              {apiRequestsRemaining}
            </span>
          </>
        )}
      </div>
      <div className="w-64">
        {/* Empty spacer for balance */}
      </div>
    </footer>
  );
}
