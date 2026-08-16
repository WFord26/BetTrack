import React, { useState } from 'react';

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
    image: '/sports/baseball.svg',
    displayName: 'MLB',
    category: 'professional',
    baseKey: 'baseball'
  },
};

const STATUS_OPTIONS: { value: string; label: string; live?: boolean }[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'live', label: 'Live', live: true },
  { value: 'completed', label: 'Final' },
];

const ODDS_FORMAT_OPTIONS: { value: 'american' | 'decimal' | 'fractional'; label: string }[] = [
  { value: 'american', label: 'US' },
  { value: 'decimal', label: 'DEC' },
  { value: 'fractional', label: 'FRAC' },
];

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

  return (
    <div className="ds-card-ink dark:ds-panel relative p-4 flex flex-col gap-5">
      {/* Date Filter */}
      <div>
        <h3 className="font-display text-[7px] text-ink-muted dark:text-cream-muted tracking-[.12em] uppercase mb-2.5">
          Date
        </h3>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-full bg-sand-panel2 border-2 border-ink text-ink dark:bg-dusk-panel2 dark:border-0 dark:text-cream px-3 py-2.5 text-[14px] font-body focus:outline-none focus:ring-2 focus:ring-gold"
        />
      </div>

      {/* Status Filters */}
      <div>
        <h3 className="font-display text-[7px] text-ink-muted dark:text-cream-muted tracking-[.12em] uppercase mb-2.5">
          Status
        </h3>
        <div className="flex flex-col gap-1.5">
          {STATUS_OPTIONS.map((status) => {
            const isActive = selectedStatus === status.value;
            return (
              <button
                key={status.value}
                onClick={() => onStatusChange(status.value)}
                className={`w-full flex items-center gap-2.5 px-[11px] py-2 font-display text-[7.5px] tracking-[.06em] uppercase transition-colors ${
                  isActive
                    ? 'bg-terra text-terra-text border-2 border-ink dark:bg-gold dark:text-dusk dark:border-0'
                    : 'bg-sand-panel text-ink-secondary border-2 border-ink dark:bg-dusk-panel2 dark:text-cream-muted dark:border-0'
                }`}
              >
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    status.live
                      ? 'bg-coral animate-ds-blink'
                      : 'bg-ink-muted dark:bg-dusk-ring'
                  }`}
                />
                {status.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sport Filters */}
      <div>
        <h3 className="font-display text-[7px] text-ink-muted dark:text-cream-muted tracking-[.12em] uppercase mb-2.5">
          Sports
        </h3>
        <div className="flex gap-1.5 items-start flex-wrap">
          {Object.entries(groupedSports).map(([baseKey, categories]) => {
            const hasGames = [...categories.professional, ...categories.college].length > 0;
            if (!hasGames) return null;

            const isActive = isSportActive(baseKey);
            const hasBothCategories = categories.professional.length > 0 && categories.college.length > 0;
            const isDropdownOpen = activeSportDropdown === baseKey;

            return (
              <div key={baseKey} className="relative">
                {/* Sport Icon Tile */}
                <button
                  onClick={() => toggleSportDropdown(baseKey)}
                  className={`w-[42px] h-[42px] flex items-center justify-center transition-all border-2 ${
                    isActive
                      ? 'bg-terra border-ink shadow-[0_3px_0_#3a2413] dark:bg-gold dark:border-0 dark:shadow-[0_3px_0_#8a5a10]'
                      : 'bg-sand-panel border-ink dark:bg-dusk-panel2 dark:border-0'
                  }`}
                  title={baseKey}
                >
                  <img
                    src={categories.image}
                    alt={baseKey}
                    className="w-[26px] h-[26px]"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </button>

                {/* Dropdown Pill Box (only if both professional and college) */}
                {hasBothCategories && isDropdownOpen && (
                  <div className="ds-card-ink dark:ds-panel absolute top-full left-0 mt-2 p-2 min-w-[160px] z-50">
                    {/* Professional */}
                    {categories.professional.length > 0 && (
                      <div className="mb-2">
                        <div className="font-display text-[6px] text-ink-muted dark:text-cream-faint tracking-[.08em] uppercase mb-1.5 px-1">
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
                                className={`px-3 py-1.5 font-display text-[7px] tracking-[.06em] transition-colors flex items-center justify-between gap-2 ${
                                  isSelected
                                    ? 'bg-terra text-terra-text dark:bg-gold dark:text-dusk'
                                    : 'bg-sand-panel text-ink-secondary dark:bg-dusk-panel2 dark:text-cream-muted'
                                }`}
                              >
                                <span>{config?.displayName}</span>
                                <span className="font-body text-[11px] opacity-70">
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
                        <div className="font-display text-[6px] text-ink-muted dark:text-cream-faint tracking-[.08em] uppercase mb-1.5 px-1">
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
                                className={`px-3 py-1.5 font-display text-[7px] tracking-[.06em] transition-colors flex items-center justify-between gap-2 ${
                                  isSelected
                                    ? 'bg-terra text-terra-text dark:bg-gold dark:text-dusk'
                                    : 'bg-sand-panel text-ink-secondary dark:bg-dusk-panel2 dark:text-cream-muted'
                                }`}
                              >
                                <span>{config?.displayName}</span>
                                <span className="font-body text-[11px] opacity-70">
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
        <h3 className="font-display text-[7px] text-ink-muted dark:text-cream-muted tracking-[.12em] uppercase mb-2.5">
          Bookmaker
        </h3>
        <select
          value={selectedBookmaker}
          onChange={(e) => onBookmakerChange(e.target.value)}
          className="w-full bg-sand-panel2 border-2 border-ink text-ink dark:bg-dusk-panel2 dark:border-0 dark:text-cream font-display text-[7px] tracking-[.06em] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold"
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
        <h3 className="font-display text-[7px] text-ink-muted dark:text-cream-muted tracking-[.12em] uppercase mb-2.5">
          Odds Format
        </h3>
        <div className="flex gap-1.5">
          {ODDS_FORMAT_OPTIONS.map((format) => {
            const isActive = oddsFormat === format.value;
            return (
              <button
                key={format.value}
                onClick={() => onOddsFormatChange(format.value)}
                className={`flex-1 text-center py-2 font-display text-[7px] tracking-[.06em] transition-colors ${
                  isActive
                    ? 'bg-terra text-terra-text border-2 border-ink dark:bg-gold dark:text-dusk dark:border-0'
                    : 'bg-sand-panel text-ink-secondary border-2 border-ink dark:bg-dusk-panel2 dark:text-cream-muted dark:border-0'
                }`}
              >
                {format.label}
              </button>
            );
          })}
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
          className="w-full font-display text-[7px] tracking-[.06em] uppercase py-2.5 border-2 border-terra text-terra hover:bg-terra hover:text-terra-text dark:border-coral dark:text-coral dark:hover:bg-coral dark:hover:text-dusk transition-colors"
        >
          Clear All Filters
        </button>
      )}
    </div>
  );
}
