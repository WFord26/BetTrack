/**
 * LineMovementChart Component
 * Visualizes line movements over time with before/after comparisons
 * Shows timeline of movements for a specific game or bookmaker
 */

import React, { useMemo } from 'react';
import { LineMovement } from '../../types/movements.types';
import { useDarkMode } from '../../contexts/DarkModeContext';

interface LineMovementChartProps {
  movements: LineMovement[];
  marketType?: 'h2h' | 'spreads' | 'totals';
  title?: string;
  compact?: boolean;
}

export default function LineMovementChart({
  movements,
  marketType,
  title = 'Line Movement Timeline',
  compact = false
}: LineMovementChartProps) {
  const { isDarkMode } = useDarkMode();

  const filteredMovements = useMemo(() => {
    return marketType ? movements.filter(m => m.marketType === marketType) : movements;
  }, [movements, marketType]);

  const getMovementColor = (type: string): string => {
    const colors: Record<string, string> = {
      steam: isDarkMode ? 'text-red-400 bg-red-900/20' : 'text-red-600 bg-red-100',
      reverse: isDarkMode ? 'text-blue-400 bg-blue-900/20' : 'text-blue-600 bg-blue-100',
      gradual: isDarkMode ? 'text-yellow-400 bg-yellow-900/20' : 'text-yellow-600 bg-yellow-100',
      injury: isDarkMode ? 'text-purple-400 bg-purple-900/20' : 'text-purple-600 bg-purple-100',
      normal: isDarkMode ? 'text-gray-400 bg-gray-900/20' : 'text-gray-600 bg-gray-100'
    };
    return colors[type] || colors.normal;
  };

  const formatNumber = (value: any): string => {
    const num = parseFloat(value);
    return num >= 0 ? `+${num.toFixed(2)}` : num.toFixed(2);
  };

  const timelineItems = useMemo(() => {
    if (filteredMovements.length === 0) return [];

    // Sort by detection time
    const sorted = [...filteredMovements].sort(
      (a, b) => new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime()
    );

    // Find earliest and latest
    const earliest = new Date(sorted[0].detectedAt);
    const latest = new Date(sorted[sorted.length - 1].detectedAt);
    const totalTime = latest.getTime() - earliest.getTime();

    return sorted.map(m => ({
      movement: m,
      position: totalTime === 0 ? 0 : ((new Date(m.detectedAt).getTime() - earliest.getTime()) / totalTime) * 100
    }));
  }, [filteredMovements]);

  if (filteredMovements.length === 0) {
    return (
      <div
        className={`${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        } rounded-lg border p-6 text-center`}
      >
        <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
          No {marketType ? `${marketType} ` : ''}movements to display
        </p>
      </div>
    );
  }

  return (
    <div
      className={`${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } rounded-lg border overflow-hidden`}
    >
      {/* Header */}
      <div
        className={`px-6 py-4 border-b ${
          isDarkMode ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'
        }`}
      >
        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </h3>
        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {filteredMovements.length} movements detected
        </p>
      </div>

      <div className="p-6">
        {!compact && (
          <>
            {/* Timeline visualization */}
            <div className="mb-8">
              <div className="relative h-12 bg-gradient-to-r from-blue-500/10 to-red-500/10 rounded-lg overflow-hidden border border-gray-300/20">
                {timelineItems.map((item, idx) => (
                  <div
                    key={item.movement.id}
                    className="absolute top-0 h-full w-1 cursor-pointer group"
                    style={{ left: `${item.position}%` }}
                    title={new Date(item.movement.detectedAt).toLocaleString()}
                  >
                    <div
                      className={`h-full w-1 transition-all ${
                        item.movement.movementType === 'steam'
                          ? 'bg-red-500'
                          : item.movement.movementType === 'reverse'
                          ? 'bg-blue-500'
                          : item.movement.movementType === 'gradual'
                          ? 'bg-yellow-500'
                          : item.movement.movementType === 'injury'
                          ? 'bg-purple-500'
                          : 'bg-gray-500'
                      }`}
                    />
                    <div
                      className={`absolute top-12 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none ${
                        isDarkMode
                          ? 'bg-gray-900 text-white border border-gray-700'
                          : 'bg-gray-100 text-gray-900 border border-gray-300'
                      }`}
                    >
                      {new Date(item.movement.detectedAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>{new Date(filteredMovements[0].detectedAt).toLocaleTimeString()}</span>
                <span>{new Date(filteredMovements[filteredMovements.length - 1].detectedAt).toLocaleTimeString()}</span>
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
              {['steam', 'reverse', 'gradual', 'injury', 'normal'].map(type => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded ${
                      type === 'steam'
                        ? 'bg-red-500'
                        : type === 'reverse'
                        ? 'bg-blue-500'
                        : type === 'gradual'
                        ? 'bg-yellow-500'
                        : type === 'injury'
                        ? 'bg-purple-500'
                        : 'bg-gray-500'
                    }`}
                  />
                  <span className={`text-xs capitalize ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {type}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Movement details list */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {timelineItems.map((item, idx) => (
            <div
              key={item.movement.id}
              className={`p-4 rounded-lg border-l-4 ${
                isDarkMode ? 'bg-gray-750' : 'bg-gray-50'
              } ${getMovementColor(item.movement.movementType)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium capitalize ${getMovementColor(
                      item.movement.movementType
                    )}`}
                  >
                    {item.movement.movementType}
                  </span>
                  <span className={`ml-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {new Date(item.movement.detectedAt).toLocaleTimeString()}
                  </span>
                </div>
                <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {formatNumber(item.movement.averageMovement)} pts
                </span>
              </div>

              {/* Before/After comparison */}
              {item.movement.linesBefore && item.movement.linesAfter && (
                <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
                  <div>
                    <p className={`font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Before
                    </p>
                    <div className={`space-y-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {Object.entries(item.movement.linesBefore)
                        .slice(0, 2)
                        .map(([bookmaker, lines]: [string, any]) => (
                          <div key={`before-${bookmaker}`} className="text-xs">
                            <span className="font-medium">{bookmaker}:</span>
                            {item.movement.marketType === 'spreads' && lines.homeSpread && (
                              <span> {lines.homeSpread}</span>
                            )}
                            {item.movement.marketType === 'h2h' && lines.homePrice && (
                              <span> {lines.homePrice}</span>
                            )}
                            {item.movement.marketType === 'totals' && lines.totalLine && (
                              <span> {lines.totalLine}</span>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                  <div>
                    <p className={`font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      After
                    </p>
                    <div className={`space-y-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {Object.entries(item.movement.linesAfter)
                        .slice(0, 2)
                        .map(([bookmaker, lines]: [string, any]) => (
                          <div key={`after-${bookmaker}`} className="text-xs">
                            <span className="font-medium">{bookmaker}:</span>
                            {item.movement.marketType === 'spreads' && lines.homeSpread && (
                              <span> {lines.homeSpread}</span>
                            )}
                            {item.movement.marketType === 'h2h' && lines.homePrice && (
                              <span> {lines.homePrice}</span>
                            )}
                            {item.movement.marketType === 'totals' && lines.totalLine && (
                              <span> {lines.totalLine}</span>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Details */}
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <div>
                  <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Books moved:</span>
                  <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {item.movement.bookmakerCount}
                  </p>
                </div>
                <div>
                  <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Time to move:</span>
                  <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {item.movement.timeToMove}s
                  </p>
                </div>
                <div>
                  <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Max movement:</span>
                  <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {item.movement.maxMovement ? formatNumber(item.movement.maxMovement) : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
