/** The `Game.status` vocabulary this codebase writes. */
export type LocalGameStatus = 'scheduled' | 'live' | 'completed';

export interface ApiSportsStatus {
  short?: string | null;
  long?: string | null;
}

/**
 * Translate an API-Sports status block to our `Game.status` vocabulary.
 *
 * The live short-codes are sport-specific — american-football reports
 * `Q1`–`Q4`/`HT`/`OT`, baseball reports the bare inning number, the rest
 * report `LIVE` — but they don't collide, so one table covers every host in
 * this directory. Anything unrecognised falls back to `scheduled` rather than
 * guessing a terminal state.
 */
export function mapApiStatusToLocal(status?: ApiSportsStatus | null): LocalGameStatus {
  const short = (status?.short || '').toUpperCase();
  const long = (status?.long || '').toLowerCase();

  if (short === 'FT' || short === 'AOT' || long.includes('finished') || long.includes('final')) {
    return 'completed';
  }

  if (short === 'NS' || short === 'TBD' || long.includes('scheduled') || long.includes('postponed')) {
    return 'scheduled';
  }

  if (
    short === 'LIVE' ||
    short === 'HT' ||
    short === 'OT' ||
    /^Q[1-4]$/.test(short) ||
    /^[0-9]+$/.test(short) ||
    long.includes('in play') ||
    long.includes('in progress')
  ) {
    return 'live';
  }

  return 'scheduled';
}

/**
 * American-football seasons are labelled by their start year but play into the
 * following Jan/Feb (playoffs). A raw `getFullYear()` mislabels any game played
 * after the calendar flips — map Jan/Feb dates back to the prior season year.
 */
export function resolveAmericanFootballSeason(date: Date): number {
  return date.getMonth() <= 1 ? date.getFullYear() - 1 : date.getFullYear();
}
