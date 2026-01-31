import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { addLeg } from '../../store/betSlipSlice';
import { formatTime, getSportDisplayName } from '../../utils/format';
import { useDarkMode } from '../../contexts/DarkModeContext';

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
}

interface EnhancedGameCardProps {
  game: Game;
  onSelect?: (selection: any) => void;
  selectedBets?: Set<string>;
  oddsFormat?: 'american' | 'decimal' | 'fractional';
}

const BOOKMAKER_INFO: Record<string, { logo: string; color: string; useImage?: boolean }> = {
  draftkings: { logo: '/bookmaker/draftkings.png', color: 'bg-green-600', useImage: true },
  fanduel: { logo: '/bookmaker/fanduel.png', color: 'bg-blue-600', useImage: true },
  betmgm: { logo: '/bookmaker/betmgm.png', color: 'bg-yellow-600', useImage: true },
  betrivers: { logo: '/bookmaker/betrivers.png', color: 'bg-blue-500', useImage: true },
  betus: { logo: '/bookmaker/betus.png', color: 'bg-red-600', useImage: true },
  mybookieag: { logo: '📚', color: 'bg-purple-600' },
  pointsbet: { logo: '⚡', color: 'bg-red-600' },
  bovada: { logo: '🐂', color: 'bg-red-700' },
  mybookie: { logo: '📚', color: 'bg-purple-600' },
};

// Map sport keys to image files
const SPORT_IMAGES: Record<string, string> = {
  'basketball_nba': '/sports/basketball.png',
  'basketball_ncaab': '/sports/basketball.png',
  'americanfootball_nfl': '/sports/football.png',
  'americanfootball_ncaaf': '/sports/football.png',
  'icehockey_nhl': '/sports/hockey.png',
  'soccer_epl': '/sports/soccer.png',
  'soccer_usa_mls': '/sports/soccer.png',
  'baseball_mlb': '/sports/basketball.png', // fallback until baseball added
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
  const [expandedBookmakers, setExpandedBookmakers] = useState(false);
  const [blinkOn, setBlinkOn] = useState(true);
  const dispatch = useDispatch();
  
  const isLive = game.status === 'in_progress';
  const isCompleted = game.status === 'final';
  
  const gameTime = useMemo(() => formatGameTime(game.commenceTime, game.status), [game.commenceTime, game.status]);
  const sportImage = SPORT_IMAGES[game.sportKey] || '/sports/basketball.png';

  useEffect(() => {
    if (!isLive) return;
    const t = setInterval(() => setBlinkOn((v) => !v), 500);
    return () => clearInterval(t);
  }, [isLive]);

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

  // Get primary bookmaker for icon display
  const primaryBookmaker = game.bookmakers?.[0]?.key || 'draftkings';
  const bookmakerInfo = BOOKMAKER_INFO[primaryBookmaker] || { logo: '🎲', color: 'bg-gray-600', useImage: false };
  
  console.log('Game data:', { 
    id: game.id, 
    period: game.period, 
    clock: game.clock, 
    status: game.status 
  });

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

  const { isDarkMode } = useDarkMode();

  return (
    <div className="relative group">
      {/* 8-bit Scoreboard */}
      <div
        className="pixel-card"
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          backgroundColor: isDarkMode ? '#020617' : '#f8fafc',
          color: isDarkMode ? '#e5e7eb' : '#1e293b',
          border: `4px solid ${isDarkMode ? '#e5e7eb' : '#cbd5e1'}`,
          padding: '12px',
          boxShadow: isDarkMode ? '0 0 0 2px rgba(229,231,235,0.12) inset, 0 8px 16px rgba(0,0,0,0.4)' : '0 0 0 2px rgba(203,213,225,0.3) inset, 0 8px 16px rgba(0,0,0,0.1)',
          imageRendering: 'pixelated',
          userSelect: 'none',
          position: 'relative',
          overflow: 'hidden',
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

        {/* Bookmaker Icon - Upper Left */}
        <div className="absolute top-2 left-2 z-20">
          <div 
            className="flex items-center justify-center"
            title={primaryBookmaker.charAt(0).toUpperCase() + primaryBookmaker.slice(1)}
          >
            {bookmakerInfo.useImage ? (
              <img 
                src={bookmakerInfo.logo} 
                alt={primaryBookmaker}
                className="h-14 w-auto"
              />
            ) : (
              <span className="text-4xl">{bookmakerInfo.logo}</span>
            )}
          </div>
        </div>

        {/* Sport Icon */}
        <div className="absolute top-2 right-2 w-10 h-10 opacity-60">
          <img 
            src={sportImage}
            alt={getSportDisplayName(game.sportKey)} 
            className="w-full h-full"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        {/* Top Section - Sport Name and Status */}
        <div className="flex justify-center items-center mb-3 relative z-10">
          <div className="text-center">
            <div className="text-[9px] tracking-wider opacity-90 mb-1">
              {getSportDisplayName(game.sportKey).substring(0, 15).toUpperCase()}
            </div>
            <div 
              className={`px-2 py-0.5 text-[10px] font-bold tracking-wider ${
                isLive 
                  ? `${blinkOn ? 'bg-red-600 text-white' : 'bg-red-900 text-red-300'} border-2 border-red-600` 
                  : isCompleted
                  ? 'bg-gray-700 text-gray-300 border-2 border-gray-600'
                  : 'bg-gray-800 text-gray-400 border-2 border-gray-700'
              } transition-colors`}
            >
              {gameTime}
            </div>
          </div>
        </div>

        {/* Scores and Team Info */}
        <div className="flex justify-between items-center my-4 relative z-10 gap-2">
          {/* Away Team */}
          <div className="text-center flex-1">
            <div className="text-[32px] font-bold tracking-wider mb-1" style={{ color: '#38bdf8' }}>
              {game.awayScore ?? '--'}
            </div>
            <Link 
              to={`/teams/${game.awayTeamName}`} 
              className="text-[9px] font-bold tracking-wide hover:text-[#38bdf8] transition-colors block px-1 leading-tight"
              style={{ minHeight: '28px' }}
            >
              {game.awayTeamName}
            </Link>
          </div>
          
          {/* Period/Clock Info */}
          <div className="text-center px-3">
            {isLive && (game.period || game.clock) ? (
              <div 
                className={`px-3 py-2 rounded text-white font-bold ${
                  blinkOn ? 'bg-red-600' : 'bg-red-900'
                } transition-colors border-2 border-red-500`}
              >
                {game.period && (
                  <div className="text-[8px] tracking-wider leading-tight">
                    {game.period.match(/^\d+$/) ? `Q${game.period}` : game.period}
                  </div>
                )}
                {game.clock && (
                  <div className="text-[9px] tracking-wider leading-tight mt-0.5">
                    {game.clock}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[10px] opacity-50">VS</div>
            )}
          </div>
          
          {/* Home Team */}
          <div className="text-center flex-1">
            <div className="text-[32px] font-bold tracking-wider mb-1" style={{ color: '#f97316' }}>
              {game.homeScore ?? '--'}
            </div>
            <Link 
              to={`/teams/${game.homeTeamName}`} 
              className="text-[9px] font-bold tracking-wide hover:text-[#f97316] transition-colors block px-1 leading-tight"
              style={{ minHeight: '28px' }}
            >
              {game.homeTeamName}
            </Link>
          </div>
        </div>

        {/* Betting Odds - Only show for scheduled and in_progress games */}
        {game.status !== 'final' && (
          <div className="mt-3 pt-3 border-t-2 border-gray-300 dark:border-gray-700 relative z-10">
            <div className="text-[9px] space-y-1">
              {/* Moneyline Row */}
              <div className="grid grid-cols-[1fr_90px_1fr] gap-2 items-center">
              <button
                onClick={() => awayML && handleAddToBetSlip('moneyline', 'away', awayML.price)}
                disabled={!awayML}
                className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 hover:border-[#38bdf8] px-2 py-1.5 rounded transition-colors text-center disabled:opacity-30 disabled:cursor-not-allowed min-h-[28px]"
              >
                {awayML ? formatOddsValue(awayML.price, oddsFormat) : '--'}
              </button>
              <div className="text-[8px] font-bold tracking-wider uppercase opacity-60 whitespace-nowrap text-center">
                Moneyline
              </div>
              <button
                onClick={() => homeML && handleAddToBetSlip('moneyline', 'home', homeML.price)}
                disabled={!homeML}
                className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 hover:border-[#f97316] px-2 py-1.5 rounded transition-colors text-center disabled:opacity-30 disabled:cursor-not-allowed min-h-[28px]"
              >
                {homeML ? formatOddsValue(homeML.price, oddsFormat) : '--'}
              </button>
            </div>

            {/* Spread Row */}
            <div className="grid grid-cols-[1fr_90px_1fr] gap-2 items-center">
              <button
                onClick={() => awaySpread && handleAddToBetSlip('spread', 'away', awaySpread.price, awaySpread.point)}
                disabled={!awaySpread}
                className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 hover:border-[#38bdf8] px-2 py-1.5 rounded transition-colors text-center disabled:opacity-30 disabled:cursor-not-allowed min-h-[28px]"
              >
                {awaySpread ? (
                  <>
                    {awaySpread.point > 0 ? '+' : ''}{awaySpread.point} ({formatOddsValue(awaySpread.price, oddsFormat)})
                  </>
                ) : '--'}
              </button>
              <div className="text-[8px] font-bold tracking-wider uppercase opacity-60 whitespace-nowrap text-center">
                Spread
              </div>
              <button
                onClick={() => homeSpread && handleAddToBetSlip('spread', 'home', homeSpread.price, homeSpread.point)}
                disabled={!homeSpread}
                className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 hover:border-[#f97316] px-2 py-1.5 rounded transition-colors text-center disabled:opacity-30 disabled:cursor-not-allowed min-h-[28px]"
              >
                {homeSpread ? (
                  <>
                    {homeSpread.point > 0 ? '+' : ''}{homeSpread.point} ({formatOddsValue(homeSpread.price, oddsFormat)})
                  </>
                ) : '--'}
              </button>
            </div>

            {/* Total Row */}
            <div className="grid grid-cols-[1fr_90px_1fr] gap-2 items-center">
              <button
                onClick={() => totalOver && handleAddToBetSlip('total', 'over', totalOver.price, totalOver.point)}
                disabled={!totalOver}
                className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 hover:border-green-500 px-2 py-1.5 rounded transition-colors text-center disabled:opacity-30 disabled:cursor-not-allowed min-h-[28px]"
              >
                {totalOver ? (
                  <>
                    O {totalOver.point} ({formatOddsValue(totalOver.price, oddsFormat)})
                  </>
                ) : '--'}
              </button>
              <div className="text-[8px] font-bold tracking-wider uppercase opacity-60 whitespace-nowrap text-center">
                Total
              </div>
              <button
                onClick={() => totalUnder && handleAddToBetSlip('total', 'under', totalUnder.price, totalUnder.point)}
                disabled={!totalUnder}
                className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 hover:border-green-500 px-2 py-1.5 rounded transition-colors text-center disabled:opacity-30 disabled:cursor-not-allowed min-h-[28px]"
              >
                {totalUnder ? (
                  <>
                    U {totalUnder.point} ({formatOddsValue(totalUnder.price, oddsFormat)})
                  </>
                ) : '--'}
              </button>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* View Details Button */}
      <Link
        to={`/games/${game.id}`}
        className="block mt-2 w-full py-1.5 bg-red-600 hover:bg-red-700 text-white text-center font-bold text-[10px] tracking-wider transition-all transform hover:scale-[1.02]"
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          border: '2px solid #dc2626',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        }}
      >
        VIEW DETAILS →
      </Link>

      {/* Venue */}
      {game.venue && (
        <div className="mt-1 text-gray-500 dark:text-gray-600 text-[8px] text-center tracking-wide">
          📍 {game.venue}
        </div>
      )}
    </div>
  );
}
