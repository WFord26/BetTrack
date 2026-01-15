import React from 'react';
import { getSportDisplayName } from '../../utils/format';

interface SportFilterProps {
  value: string;
  onChange: (sport: string) => void;
}

const SPORTS = [
  { key: 'all', label: 'All Sports' },
  { key: 'basketball_nba', label: 'NBA' },
  { key: 'americanfootball_nfl', label: 'NFL' },
  { key: 'icehockey_nhl', label: 'NHL' },
  { key: 'baseball_mlb', label: 'MLB' },
  { key: 'americanfootball_ncaaf', label: 'NCAAF' },
  { key: 'basketball_ncaab', label: 'NCAAB' }
];

export default function SportFilter({ value, onChange }: SportFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {SPORTS.map((sport) => (
        <button
          key={sport.key}
          onClick={() => onChange(sport.key)}
          className={`
            px-4 py-2 rounded-lg font-medium text-sm transition-all
            ${
              value === sport.key
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }
          `}
        >
          {sport.label}
        </button>
      ))}
    </div>
  );
}
