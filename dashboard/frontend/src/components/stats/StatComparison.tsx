import React from 'react';

interface StatComparisonProps {
  homeStats?: Record<string, any>;
  awayStats?: Record<string, any>;
  homeTeam?: string;
  awayTeam?: string;
}

export default function StatComparison({ homeStats, awayStats, homeTeam, awayTeam }: StatComparisonProps) {
  if (!homeStats || !awayStats) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">Team Statistics</h3>
        <p className="text-gray-400">No team statistics available</p>
      </div>
    );
  }

  // Extract common stat keys
  const statKeys = Array.from(new Set([
    ...Object.keys(homeStats),
    ...Object.keys(awayStats)
  ])).filter(key => typeof homeStats[key] === 'object' || typeof awayStats[key] === 'object');

  const renderStatRow = (label: string, homeValue: any, awayValue: any) => {
    const homeNum = typeof homeValue === 'number' ? homeValue : 
                    homeValue?.total !== undefined ? homeValue.total : 0;
    const awayNum = typeof awayValue === 'number' ? awayValue : 
                    awayValue?.total !== undefined ? awayValue.total : 0;
    
    const total = homeNum + awayNum;
    const homePercent = total > 0 ? (homeNum / total) * 100 : 50;
    const awayPercent = total > 0 ? (awayNum / total) * 100 : 50;

    return (
      <div key={label} className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-blue-400 font-medium">{awayNum}</span>
          <span className="text-gray-300 font-semibold">{label}</span>
          <span className="text-red-400 font-medium">{homeNum}</span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-gray-700">
          <div 
            className="bg-blue-500 transition-all duration-300"
            style={{ width: `${awayPercent}%` }}
          />
          <div 
            className="bg-red-500 transition-all duration-300"
            style={{ width: `${homePercent}%` }}
          />
        </div>
      </div>
    );
  };

  const formatStatLabel = (key: string): string => {
    return key.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-xl font-bold text-white mb-4">Team Statistics</h3>
      
      <div className="flex justify-between items-center mb-6 text-sm">
        <span className="text-blue-400 font-bold">{awayTeam || 'Away'}</span>
        <span className="text-gray-500">vs</span>
        <span className="text-red-400 font-bold">{homeTeam || 'Home'}</span>
      </div>

      <div className="space-y-4">
        {statKeys.map(key => {
          const homeValue = homeStats[key];
          const awayValue = awayStats[key];
          
          if (!homeValue && !awayValue) return null;
          
          return renderStatRow(formatStatLabel(key), homeValue, awayValue);
        })}

        {statKeys.length === 0 && (
          <p className="text-gray-400 text-center py-4">
            No comparable statistics available
          </p>
        )}
      </div>
    </div>
  );
}
