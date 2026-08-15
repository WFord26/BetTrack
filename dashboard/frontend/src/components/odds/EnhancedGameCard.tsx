import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { addLeg } from '../../store/betSlipSlice';
import { formatTime, getSportDisplayName } from '../../utils/format';

interface Bookmaker {
  key: string;
  title: string;
  markets: {
    key: string;
    outcomes: Array<{
      name: string;
      price: number;
      point?: number;
    }>;
  }[];
}

interface Game {
  id: string;
  sportKey: string;
  sportName: string;
  awayTeamName: string;
  homeTeamName: string;
  commenceTime: string;
  venue?: string;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
  currentOdds?: any[];
  bookmakers?: Bookmaker[];
  period?: string;
  clock?: string;
  timeRemaining?: string;
  inningHalf?: string | null;  // "Top" or "Bot" for baseball
  balls?: number | null;
  strikes?: number | null;
  outs?: number | null;
}

interface EnhancedGameCardProps {
  game: Game;
  onSelect?: (selection: any) => void;
  selectedBets?: Set<string>;
  oddsFormat?: 'american' | 'decimal' | 'fractional';
}

// Map sport keys to image files
const SPORT_IMAGES: Record<string, string> = {
  'basketball_nba': '/sports/basketball.png',
  'basketball_ncaab': '/sports/basketball.png',
  'americanfootball_nfl': '/sports/football.png',
  'americanfootball_ncaaf': '/sports/football.png',
  'icehockey_nhl': '/sports/hockey.png',
  'soccer_epl': '/sports/soccer.png',
  'soccer_usa_mls': '/sports/soccer.png',
  'baseball_mlb': '/sports/baseball.svg',
};

function formatGameTime(commenceTime: string, status: string): string {
  if (status === 'in_progress') return 'LIVE';
  if (status === 'final') return 'FINAL';

  const date = new Date(commenceTime);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 60 && diffMins > 0) {
    return `${diffMins}m`;
  }

  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function americanToDecimal(american: number): number {
  if (american > 0) {
    return (american / 100) + 1;
  } else {
    return (100 / Math.abs(american)) + 1;
  }
}

function americanToFractional(american: number): string {
  if (american > 0) {
    return `${american}/100`;
  } else {
    return `100/${Math.abs(american)}`;
  }
}

function formatOddsValue(american: number, format: 'american' | 'decimal' | 'fractional'): string {
  if (format === 'decimal') {
    return americanToDecimal(american).toFixed(2);
  } else if (format === 'fractional') {
    return americanToFractional(american);
  } else {
    return (american > 0 ? '+' : '') + american;
  }
}

export default function EnhancedGameCard({ game, oddsFormat = 'american' }: EnhancedGameCardProps) {
  const dispatch = useDispatch();

  const isLive = game.status === 'in_progress';
  const isCompleted = game.status === 'final';

  const gameTime = useMemo(() => formatGameTime(game.commenceTime, game.status), [game.commenceTime, game.status]);
  const sportImage = SPORT_IMAGES[game.sportKey] || '/sports/basketball.png';
  const isBaseball = game.sportKey === 'baseball_mlb';

  const inningHalfLabel = useMemo(() => {
    const half = (game.inningHalf || '').trim();
    if (!half) return '';
    const normalized = half.toLowerCase();
    if (normalized.startsWith('top') || normalized.startsWith('t')) return 'TOP';
    if (normalized.startsWith('bot') || normalized.startsWith('bottom') || normalized.startsWith('b')) return 'BOT';
    return half.toUpperCase();
  }, [game.inningHalf]);

  const baseballSituation = useMemo(() => {
    const hasCount = game.balls != null || game.strikes != null || game.outs != null;
    if (!hasCount) return null;
    return `${game.balls ?? '-'}-${game.strikes ?? '-'}-${game.outs ?? '-'}`;
  }, [game.balls, game.strikes, game.outs]);

  const baseballInningLine = useMemo(() => {
    if (!isBaseball || !isLive) return null;

    const periodValue = game.period ? String(game.period).trim() : '';
    if (periodValue && inningHalfLabel) {
      const arrow = inningHalfLabel === 'TOP' ? '▲' : inningHalfLabel === 'BOT' ? '▼' : '';
      return `${arrow ? `${arrow} ` : ''}${inningHalfLabel} ${periodValue}`.trim();
    }

    if (periodValue) {
      return `INNING ${periodValue}`;
    }

    if (game.clock) {
      return game.clock;
    }

    return null;
  }, [isBaseball, isLive, game.period, game.clock, inningHalfLabel]);

  // Get best odds across all bookmakers
  const getBestOdds = () => {
    if (!game.bookmakers || game.bookmakers.length === 0) return null;

    // Find best odds for each market type
    const bestH2H = { away: null as any, home: null as any, bookmaker: '' };
    const bestSpread = { away: null as any, home: null as any, bookmaker: '' };
    const bestTotal = { over: null as any, under: null as any, bookmaker: '' };

    game.bookmakers.forEach(bookmaker => {
      const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h');
      const spreadMarket = bookmaker.markets.find(m => m.key === 'spreads');
      const totalMarket = bookmaker.markets.find(m => m.key === 'totals');

      // Best moneyline (higher is better for positive, closer to 0 for negative)
      if (h2hMarket) {
        const awayML = h2hMarket.outcomes.find(o => o.name === game.awayTeamName);
        const homeML = h2hMarket.outcomes.find(o => o.name === game.homeTeamName);

        if (awayML && (!bestH2H.away || awayML.price > bestH2H.away.price)) {
          bestH2H.away = awayML;
          if (!bestH2H.bookmaker) bestH2H.bookmaker = bookmaker.key;
        }
        if (homeML && (!bestH2H.home || homeML.price > bestH2H.home.price)) {
          bestH2H.home = homeML;
          if (!bestH2H.bookmaker) bestH2H.bookmaker = bookmaker.key;
        }
      }

      // Best spread
      if (spreadMarket) {
        const awaySpread = spreadMarket.outcomes.find(o => o.name === game.awayTeamName);
        const homeSpread = spreadMarket.outcomes.find(o => o.name === game.homeTeamName);

        if (awaySpread && (!bestSpread.away || awaySpread.price > bestSpread.away.price)) {
          bestSpread.away = awaySpread;
          if (!bestSpread.bookmaker) bestSpread.bookmaker = bookmaker.key;
        }
        if (homeSpread && (!bestSpread.home || homeSpread.price > bestSpread.home.price)) {
          bestSpread.home = homeSpread;
          if (!bestSpread.bookmaker) bestSpread.bookmaker = bookmaker.key;
        }
      }

      // Best total
      if (totalMarket) {
        const over = totalMarket.outcomes.find(o => o.name === 'Over');
        const under = totalMarket.outcomes.find(o => o.name === 'Under');

        if (over && (!bestTotal.over || over.price > bestTotal.over.price)) {
          bestTotal.over = over;
          if (!bestTotal.bookmaker) bestTotal.bookmaker = bookmaker.key;
        }
        if (under && (!bestTotal.under || under.price > bestTotal.under.price)) {
          bestTotal.under = under;
          if (!bestTotal.bookmaker) bestTotal.bookmaker = bookmaker.key;
        }
      }
    });

    return { bestH2H, bestSpread, bestTotal };
  };

  const bestOdds = getBestOdds();
  const awayML = bestOdds?.bestH2H.away;
  const homeML = bestOdds?.bestH2H.home;
  const awaySpread = bestOdds?.bestSpread.away;
  const homeSpread = bestOdds?.bestSpread.home;
  const totalOver = bestOdds?.bestTotal.over;
  const totalUnder = bestOdds?.bestTotal.under;

  // Get primary bookmaker for the footer chip
  const primaryBookmaker = game.bookmakers?.[0]?.key || 'draftkings';
  const hasBookmakerData = !!(game.bookmakers && game.bookmakers.length > 0);

  // Handle adding bet to bet slip
  const handleAddToBetSlip = (type: 'moneyline' | 'spread' | 'total', selection: 'home' | 'away' | 'over' | 'under', odds: number, line?: number) => {
    dispatch(addLeg({
      gameId: game.id,
      selectionType: type,
      selection: selection,
      odds: odds,
      line: line,
      teamName: selection === 'home' ? game.homeTeamName : selection === 'away' ? game.awayTeamName : undefined,
      status: 'pending',
      game: {
        ...game,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: game.status as 'scheduled' | 'in_progress' | 'completed' | 'postponed' | 'cancelled'
      }
    }));
  };

  const oddsCellClasses = 'ds-odds-cell-light dark:ds-odds-cell-dark w-full px-1.5 py-1.5 text-center text-[13px] font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed';
  const marketLabelClasses = 'font-display text-[6px] text-ink-muted dark:text-cream-faint tracking-[.08em] uppercase text-center';

  return (
    <div className="flex flex-col">
      {/* Scoreboard */}
      <div className="ds-card-ink dark:ds-panel p-4">
        {/* Header row */}
        <div className="flex items-center gap-2.5 mb-3.5">
          <img
            src={sportImage}
            alt={getSportDisplayName(game.sportKey)}
            className="w-5 h-5"
            style={{ imageRendering: 'pixelated' }}
          />
          <span className="font-display text-[7px] text-ink-muted dark:text-cream-muted tracking-[.1em] uppercase">
            {getSportDisplayName(game.sportKey)}
          </span>
          <span
            className={`ml-auto font-display text-[7px] px-[9px] py-1.5 tracking-[.08em] ${
              isLive
                ? 'bg-[#c0392b] dark:bg-coral text-terra-text dark:text-dusk animate-ds-blink'
                : isCompleted
                ? 'bg-ink dark:bg-dusk-ring text-sand dark:text-cream-muted'
                : 'bg-ink dark:bg-dusk-panel2 text-sand dark:text-cream-muted'
            }`}
          >
            {gameTime}
          </span>
        </div>

        {/* Score row */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2.5 items-center mb-3.5">
          {/* Away Team */}
          <div className="text-center">
            <div
              className="font-display text-[22px] text-gold-away dark:text-gold [text-shadow:2px_2px_0_#3a2413] dark:[text-shadow:3px_3px_0_#120a22]"
            >
              {game.awayScore ?? '--'}
            </div>
            <Link
              to={`/teams/${encodeURIComponent(game.sportKey)}/${encodeURIComponent(game.awayTeamName)}`}
              className="font-body text-[13.5px] font-semibold mt-2 leading-tight block text-ink dark:text-cream hover:text-gold-away dark:hover:text-gold transition-colors"
            >
              {game.awayTeamName}
            </Link>
          </div>

          {/* Period/Clock Info */}
          <div className="min-w-16 text-center">
            {isLive && (game.period || game.clock || game.inningHalf || baseballSituation) ? (
              <div className="px-[10px] py-2 bg-ink dark:bg-[#3a1424] dark:shadow-[0_0_0_2px_#ef5350]">
                {isBaseball ? (
                  <>
                    {baseballInningLine && (
                      <div className="font-display text-[8px] text-[#f6a34c] dark:text-coral leading-tight">
                        {baseballInningLine}
                      </div>
                    )}
                    {baseballSituation && (
                      <div className="font-display text-[7px] text-terra-text dark:text-cream mt-1 leading-tight">
                        {baseballSituation}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {game.period && (
                      <div className="font-display text-[8px] text-[#f6a34c] dark:text-coral leading-tight">
                        {game.period.match(/^\d+$/) ? `Q${game.period}` : game.period}
                      </div>
                    )}
                    {game.clock && (
                      <div className="font-display text-[7px] text-terra-text dark:text-cream mt-1 leading-tight">
                        {game.clock}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="font-display text-[9px] text-ink-muted dark:text-cream-faint">VS</div>
            )}
          </div>

          {/* Home Team */}
          <div className="text-center">
            <div
              className="font-display text-[22px] text-terra dark:text-ember [text-shadow:2px_2px_0_#3a2413] dark:[text-shadow:3px_3px_0_#120a22]"
            >
              {game.homeScore ?? '--'}
            </div>
            <Link
              to={`/teams/${encodeURIComponent(game.sportKey)}/${encodeURIComponent(game.homeTeamName)}`}
              className="font-body text-[13.5px] font-semibold mt-2 leading-tight block text-ink dark:text-cream hover:text-terra dark:hover:text-ember transition-colors"
            >
              {game.homeTeamName}
            </Link>
          </div>
        </div>

        {/* Betting Odds - Only show for scheduled and in_progress games */}
        {game.status !== 'final' && (
          <div className="flex flex-col gap-1.5 border-t-2 border-sand-divider dark:border-dusk-panel2 pt-3">
            {/* Moneyline Row */}
            <div className="grid grid-cols-[1fr_76px_1fr] gap-1.5 items-center">
              <button
                onClick={() => awayML && handleAddToBetSlip('moneyline', 'away', awayML.price)}
                disabled={!awayML}
                className={oddsCellClasses}
              >
                {awayML ? formatOddsValue(awayML.price, oddsFormat) : '--'}
              </button>
              <div className={marketLabelClasses}>Moneyline</div>
              <button
                onClick={() => homeML && handleAddToBetSlip('moneyline', 'home', homeML.price)}
                disabled={!homeML}
                className={oddsCellClasses}
              >
                {homeML ? formatOddsValue(homeML.price, oddsFormat) : '--'}
              </button>
            </div>

            {/* Spread Row */}
            <div className="grid grid-cols-[1fr_76px_1fr] gap-1.5 items-center">
              <button
                onClick={() => awaySpread && handleAddToBetSlip('spread', 'away', awaySpread.price, awaySpread.point)}
                disabled={!awaySpread}
                className={oddsCellClasses}
              >
                {awaySpread ? (
                  <>
                    {awaySpread.point > 0 ? '+' : ''}{awaySpread.point} ({formatOddsValue(awaySpread.price, oddsFormat)})
                  </>
                ) : '--'}
              </button>
              <div className={marketLabelClasses}>Spread</div>
              <button
                onClick={() => homeSpread && handleAddToBetSlip('spread', 'home', homeSpread.price, homeSpread.point)}
                disabled={!homeSpread}
                className={oddsCellClasses}
              >
                {homeSpread ? (
                  <>
                    {homeSpread.point > 0 ? '+' : ''}{homeSpread.point} ({formatOddsValue(homeSpread.price, oddsFormat)})
                  </>
                ) : '--'}
              </button>
            </div>

            {/* Total Row */}
            <div className="grid grid-cols-[1fr_76px_1fr] gap-1.5 items-center">
              <button
                onClick={() => totalOver && handleAddToBetSlip('total', 'over', totalOver.price, totalOver.point)}
                disabled={!totalOver}
                className={oddsCellClasses}
              >
                {totalOver ? (
                  <>
                    O {totalOver.point} ({formatOddsValue(totalOver.price, oddsFormat)})
                  </>
                ) : '--'}
              </button>
              <div className={marketLabelClasses}>Total</div>
              <button
                onClick={() => totalUnder && handleAddToBetSlip('total', 'under', totalUnder.price, totalUnder.point)}
                disabled={!totalUnder}
                className={oddsCellClasses}
              >
                {totalUnder ? (
                  <>
                    U {totalUnder.point} ({formatOddsValue(totalUnder.price, oddsFormat)})
                  </>
                ) : '--'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer: Details + Bookmaker */}
      <div className="flex gap-2 mt-3.5">
        <Link
          to={`/game/${game.id}`}
          className="ds-btn-press-light dark:ds-btn-press flex-1 font-display text-[7.5px] py-2.5 text-center"
        >
          DETAILS
        </Link>
        {hasBookmakerData && (
          <div
            className="w-[110px] bg-sand-panel border-2 border-ink text-ink-secondary dark:bg-dusk-panel dark:border-0 dark:text-cream-muted dark:shadow-[0_0_0_2px_#43306a_inset] font-display text-[7.5px] py-2.5 text-center flex items-center justify-center"
            title={primaryBookmaker}
          >
            {primaryBookmaker.slice(0, 12).toUpperCase()}
          </div>
        )}
      </div>

      {/* Venue */}
      {game.venue && (
        <div className="mt-1.5 font-body text-ink-muted dark:text-cream-faint text-[8px] text-center tracking-wide">
          {game.venue}
        </div>
      )}
    </div>
  );
}
