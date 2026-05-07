export interface OutlierBookmaker {
  bookmaker: string;
  line: number;
  deviation: number;
}

export interface BestValue {
  side: 'home' | 'away' | 'over' | 'under';
  bookmaker: string;
  line: number;
  impliedProb: number;
}

export interface ConsensusResult {
  gameId: string;
  marketType: string;
  consensusLine: number;
  standardDeviation: number;
  outlierBookmakers: OutlierBookmaker[];
  bookmakerCount: number;
  disagreementScore: number;
  bestValue: BestValue;
}

export interface HighDisagreementGame {
  gameId: string;
  homeTeamName: string;
  awayTeamName: string;
  commenceTime: string;
  sportKey: string;
  consensus: ConsensusResult[];
  maxDisagreementScore: number;
}

export type DisagreementCategory = 'low' | 'medium' | 'high' | 'extreme';

export function getDisagreementCategory(score: number): DisagreementCategory {
  if (score >= 81) return 'extreme';
  if (score >= 61) return 'high';
  if (score >= 31) return 'medium';
  return 'low';
}

export function getDisagreementColor(score: number): string {
  if (score >= 81) return 'text-red-500';
  if (score >= 61) return 'text-orange-500';
  if (score >= 31) return 'text-yellow-500';
  return 'text-green-500';
}

export function getDisagreementBadgeColor(score: number): string {
  if (score >= 81) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  if (score >= 61) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
  if (score >= 31) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
  return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
}
