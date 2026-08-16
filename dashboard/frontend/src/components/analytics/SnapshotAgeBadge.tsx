/**
 * Snapshot age badge
 *
 * Odds refresh on the sync cadence (~10 min by default), so an opportunity is
 * only ever as current as the snapshot it was computed from. This badge makes
 * that age impossible to miss.
 */

import React from 'react';

interface Props {
  ageSeconds: number;
  isDarkMode: boolean;
}

/** Above this the snapshot is old enough that the lines have likely moved. */
export const STALE_THRESHOLD_SECONDS = 300;

export function formatAge(ageSeconds: number): string {
  if (ageSeconds < 60) return `${ageSeconds}s old`;
  const minutes = Math.floor(ageSeconds / 60);
  if (minutes < 60) return `${minutes}m old`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m old`;
}

export default function SnapshotAgeBadge({ ageSeconds, isDarkMode }: Props) {
  const stale = ageSeconds > STALE_THRESHOLD_SECONDS;
  const warning = !stale && ageSeconds > STALE_THRESHOLD_SECONDS / 2;

  const className = stale
    ? isDarkMode
      ? 'bg-red-900 text-red-200'
      : 'bg-red-100 text-red-800'
    : warning
    ? isDarkMode
      ? 'bg-yellow-900 text-yellow-200'
      : 'bg-yellow-100 text-yellow-800'
    : isDarkMode
    ? 'bg-green-900 text-green-200'
    : 'bg-green-100 text-green-800';

  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap ${className}`}
      title={
        stale
          ? 'These odds are older than one sync cycle. Re-check both books before placing.'
          : 'Age of the odds snapshot this opportunity was computed from'
      }
    >
      {stale ? '⚠ ' : ''}
      {formatAge(ageSeconds)}
    </span>
  );
}
