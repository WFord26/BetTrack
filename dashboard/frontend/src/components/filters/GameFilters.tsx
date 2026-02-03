import React, { useState } from 'react';
import { useDarkMode } from '../../contexts/DarkModeContext';

interface GameFiltersProps {
  selectedSports: string[];
  onSportToggle: (sport: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  selectedBookmaker: string;
  onBookmakerChange: (bookmaker: string) => void;
  oddsFormat: 'american' | 'decimal' | 'fractional';
  onOddsFormatChange: (format: 'american' | 'decimal' | 'fractional') => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  availableSports: { key: string; name: string; count: number }[];
  availableBookmakers: string[];
}

// Map sport keys to image files and categories
const SPORT_CONFIG: Record<string, { 
  image: string; 
  displayName: string;
  category: 'professional' | 'college';
  baseKey: string;
}> = {
  'basketball_nba': { 
    image: '/sports/basketball.svg', 
    displayName: 'NBA',
    category: 'professional',
    baseKey: 'basketball'
  },
  'basketball_ncaab': { 
    image: '/sports/basketball.svg', 
    displayName: 'NCAAB',
    category: 'college',
    baseKey: 'basketball'
  },
  'americanfootball_nfl': { 
    image: '/sports/football.svg', 
    displayName: 'NFL',
    category: 'professional',
    baseKey: 'football'
  },
  'americanfootball_ncaaf': { 
    image: '/sports/football.svg', 
    displayName: 'NCAAF',
    category: 'college',
    baseKey: 'football'
  },
  'icehockey_nhl': { 
    image: '/sports/hockey.svg', 
    displayName: 'NHL',
    category: 'professional',
    baseKey: 'hockey'
  },
  'soccer_epl': { 
    image: '/sports/soccer.svg', 
    displayName: 'EPL',
    category: 'professional',
    baseKey: 'soccer'
  },
  'soccer_usa_mls': { 
    image: '/sports/soccer.svg', 
    displayName: 'MLS',
    category: 'professional',
    baseKey: 'soccer'
  },
  'baseball_mlb': { 
    image: '/sports/basketball.svg', // fallback
    displayName: 'MLB',
    category: 'professional',
    baseKey: 'baseball'
  },
};

export default function GameFilters({
  selectedSports,
  onSportToggle,
  selectedStatus,
  onStatusChange,
  selectedBookmaker,
  onBookmakerChange,
  oddsFormat,
  onOddsFormatChange,
  selectedDate,
  onDateChange,
  availableSports,
  availableBookmakers,
}: GameFiltersProps) {
  const [activeSportDropdown, setActiveSportDropdown] = useState<string | null>(null);

  // Group sports by base sport type
  const groupedSports = availableSports.reduce((acc, sport) => {
    const config = SPORT_CONFIG[sport.key];
    if (!config) return acc;
    
    if (!acc[config.baseKey]) {
      acc[config.baseKey] = {
        professional: [],
        college: [],
        image: config.image
      };
    }
    
    acc[config.baseKey][config.category].push(sport);
    return acc;
  }, {} as Record<string, { 
    professional: typeof availableSports; 
    college: typeof availableSports;
    image: string;
  }>);

  const toggleSportDropdown = (baseKey: string) => {
    const categories = groupedSports[baseKey];
    const hasBothCategories = categories.professional.length > 0 && categories.college.length > 0;
    
    if (hasBothCategories) {
      setActiveSportDropdown(activeSportDropdown === baseKey ? null : baseKey);
    } else {
      // If only one category, select it directly
      const singleSport = [...categories.professional, ...categories.college][0];
      if (singleSport) {
        onSportToggle(singleSport.key);
      }
    }
  };

  const isSportActive = (baseKey: string) => {
    const categories = groupedSports[baseKey];
    const allSports = [...categories.professional, ...categories.college];
    return allSports.some(sport => selectedSports.includes(sport.key));
  };

  const { isDarkMode } = useDarkMode();

  return (
    <div 
      className="relative"
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        backgroundColor: isDarkMode ? '#020617' : '#f8fafc',
        color: isDarkMode ? '#e5e7eb' : '#1e293b',
        border: `4px solid ${isDarkMode ? '#e5e7eb' : '#cbd5e1'}`,
        padding: '16px',
        boxShadow: isDarkMode ? '0 0 0 2px rgba(229,231,235,0.12) inset, 0 8px 16px rgba(0,0,0,0.4)' : '0 0 0 2px rgba(203,213,225,0.3) inset, 0 8px 16px rgba(0,0,0,0.1)',
        imageRendering: 'pixelated',
      }}
    >
      {/* Pixel grid overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: isDarkMode 
            ? 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)'
            : 'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)',
          backgroundSize: '6px 6px',
          pointerEvents: 'none',
        }}
      />

      {/* Vertical Filter Layout */}
      <div className="relative z-10 space-y-6">
        {/* Date Filter */}
        <div>
          <h3 className="text-[10px] font-bold tracking-wider uppercase opacity-60 mb-3">Date</h3>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full bg-gray-800 dark:bg-gray-800 bg-white text-gray-900 dark:text-white px-3 py-2 rounded border-2 border-gray-300 dark:border-gray-700 focus:border-red-600 focus:outline-none text-sm"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            }}
          />
        </div>

        {/* Status Filters */}
        <div>
          <h3 className="text-[10px] font-bold tracking-wider uppercase opacity-60 mb-3">Status</h3>
          <div className="flex flex-col gap-1.5">
            {[
              { value: 'all', label: 'All' },
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'live', label: 'Live', badge: '🔴' },
              { value: 'completed', label: 'Final' },
            ].map((status) => (
              <button
                key={status.value}
                onClick={() => onStatusChange(status.value)}
                className={`
                  w-full px-3 py-1.5 font-bold text-[10px] tracking-wider transition-all rounded
                  ${
                    selectedStatus === status.value
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }
                `}
              >
                {status.badge && <span className="mr-1">{status.badge}</span>}
                {status.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sport Filters */}
        <div>
          <h3 className="text-[10px] font-bold tracking-wider uppercase opacity-60 mb-3">Sports</h3>
          <div className="flex gap-2 items-center flex-wrap">
            {Object.entries(groupedSports).map(([baseKey, categories]) => {
              const hasGames = [...categories.professional, ...categories.college].length > 0;
              if (!hasGames) return null;

              const isActive = isSportActive(baseKey);
              const hasBothCategories = categories.professional.length > 0 && categories.college.length > 0;
              const isDropdownOpen = activeSportDropdown === baseKey;

              return (
                <div key={baseKey} className="relative">
                  {/* Sport Icon Button */}
                  <button
                    onClick={() => toggleSportDropdown(baseKey)}
                    className={`
                      w-10 h-10 rounded-lg transition-all transform hover:scale-110 border-2
                      ${isActive 
                        ? 'bg-red-600 border-red-500' 
                        : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                      }
                    `}
                    title={baseKey}
                  >
                    <img 
                      src={categories.image}
                      alt={baseKey}
                      className="w-full h-full p-1.5"
                    />
                  </button>

                  {/* Dropdown Pill Box (only if both professional and college) */}
                  {hasBothCategories && isDropdownOpen && (
                    <div 
                      className="absolute top-full left-0 mt-2 bg-gray-900 border-2 border-gray-700 rounded-lg p-2 min-w-[160px] z-50"
                      style={{
                        boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                      }}
                    >
                      {/* Professional */}
                      {categories.professional.length > 0 && (
                        <div className="mb-2">
                          <div className="text-[8px] font-bold tracking-wider uppercase opacity-60 mb-1.5 px-1">
                            Professional
                          </div>
                          <div className="flex flex-col gap-1">
                            {categories.professional.map((sport) => {
                              const isSelected = selectedSports.includes(sport.key);
                              const config = SPORT_CONFIG[sport.key];
                              
                              return (
                                <button
                                  key={sport.key}
                                  onClick={() => {
                                    onSportToggle(sport.key);
                                    setActiveSportDropdown(null);
                                  }}
                                  className={`
                                    px-3 py-1.5 text-[10px] font-bold tracking-wider transition-all rounded-full
                                    flex items-center justify-between gap-2
                                    ${
                                      isSelected
                                        ? 'bg-red-600 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }
                                  `}
                                >
                                  <span>{config?.displayName}</span>
                                  <span className="text-[8px] opacity-70">
                                    {sport.count}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* College */}
                      {categories.college.length > 0 && (
                        <div>
                          <div className="text-[8px] font-bold tracking-wider uppercase opacity-60 mb-1.5 px-1">
                            College
                          </div>
                          <div className="flex flex-col gap-1">
                            {categories.college.map((sport) => {
                              const isSelected = selectedSports.includes(sport.key);
                              const config = SPORT_CONFIG[sport.key];
                              
                              return (
                                <button
                                  key={sport.key}
                                  onClick={() => {
                                    onSportToggle(sport.key);
                                    setActiveSportDropdown(null);
                                  }}
                                  className={`
                                    px-3 py-1.5 text-[10px] font-bold tracking-wider transition-all rounded-full
                                    flex items-center justify-between gap-2
                                    ${
                                      isSelected
                                        ? 'bg-red-600 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }
                                  `}
                                >
                                  <span>{config?.displayName}</span>
                                  <span className="text-[8px] opacity-70">
                                    {sport.count}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bookmaker Filter */}
        <div>
          <h3 className="text-[10px] font-bold tracking-wider uppercase opacity-60 mb-3">Bookmaker</h3>
          <select
            value={selectedBookmaker}
            onChange={(e) => onBookmakerChange(e.target.value)}
            className="w-full bg-gray-800 text-white text-[10px] font-bold tracking-wider px-3 py-2 rounded border-2 border-gray-700 hover:border-gray-600 focus:border-red-600 focus:outline-none transition-colors"
          >
            <option value="all">All</option>
            {availableBookmakers.map(bookmaker => (
              <option key={bookmaker} value={bookmaker}>
                {bookmaker.charAt(0).toUpperCase() + bookmaker.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Odds Format Filter */}
        <div>
          <h3 className="text-[10px] font-bold tracking-wider uppercase opacity-60 mb-3">Odds Format</h3>
          <div className="flex flex-col gap-1.5">
            {[
              { value: 'american', label: 'American' },
              { value: 'decimal', label: 'Decimal' },
              { value: 'fractional', label: 'Fractional' },
            ].map((format) => (
              <button
                key={format.value}
                onClick={() => onOddsFormatChange(format.value as any)}
                className={`
                  w-full px-3 py-1.5 font-bold text-[10px] tracking-wider transition-all rounded
                  ${
                    oddsFormat === format.value
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }
                `}
              >
                {format.label}
              </button>
            ))}
          </div>
        </div>

        {/* Clear All Button */}
        {(selectedSports.length > 0 || selectedStatus !== 'all' || selectedBookmaker !== 'all') && (
          <button
            onClick={() => {
              selectedSports.forEach(sport => onSportToggle(sport));
              onStatusChange('all');
              onBookmakerChange('all');
              setActiveSportDropdown(null);
            }}
            className="w-full text-red-400 hover:text-red-300 text-[10px] font-bold tracking-wider transition-colors px-3 py-2 rounded hover:bg-gray-800 border border-red-600"
          >
            CLEAR ALL FILTERS
          </button>
        )}
      </div>
    </div>
  );
}
