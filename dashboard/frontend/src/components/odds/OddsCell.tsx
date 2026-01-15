import React from 'react';
import { formatOdds, formatSpread, formatTotal } from '../../utils/format';

interface OddsCellProps {
  odds: number;
  line?: number;
  prefix?: string;
  selected?: boolean;
  isBest?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  useDecimalOdds?: boolean;
}

export default function OddsCell({
  odds,
  line,
  prefix,
  selected = false,
  isBest = false,
  onClick,
  disabled = false,
  useDecimalOdds = false
}: OddsCellProps) {
  const formattedOdds = formatOdds(odds, useDecimalOdds);
  const formattedLine = line !== undefined ? (
    prefix ? `${prefix} ${formatTotal(line)}` : formatSpread(line)
  ) : null;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-3 py-2 rounded-md text-sm font-medium transition-all
        min-w-[80px] text-center
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${selected 
          ? 'bg-blue-100 border-2 border-blue-600 text-blue-900' 
          : 'bg-white border border-gray-300 hover:border-gray-400 hover:shadow-md'
        }
        ${isBest && !selected ? 'text-green-600 font-bold' : ''}
      `}
    >
      <div className="flex flex-col gap-0.5">
        {formattedLine && (
          <div className="text-xs text-gray-600 font-semibold">
            {formattedLine}
          </div>
        )}
        <div className={selected ? 'text-blue-900' : ''}>
          {formattedOdds}
        </div>
      </div>
    </button>
  );
}

/**
 * Empty cell for games without odds
 */
export function EmptyOddsCell() {
  return (
    <div className="px-3 py-2 min-w-[80px] text-center text-gray-400 text-sm">
      —
    </div>
  );
}
