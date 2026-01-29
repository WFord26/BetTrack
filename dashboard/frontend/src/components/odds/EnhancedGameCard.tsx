import React, { useState, useMemo, useEffect } from 'react';
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
}

interface EnhancedGameCardProps {
  game: Game;
  onSelect?: (selection: any) => void;
  selectedBets?: Set<string>;
  useDecimalOdds?: boolean;
}

const BOOKMAKER_INFO: Record<string, { logo: string; color: string }> = {
  draftkings: { logo: '👑', color: 'bg-green-600' },
  fanduel: { logo: '🎯', color: 'bg-blue-600' },
  betmgm: { logo: '🦁', color: 'bg-yellow-600' },
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

export default function EnhancedGameCard({ game, useDecimalOdds = false }: EnhancedGameCardProps) {
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
    
    const h2hMarkets = game.bookmakers
      .map(b => ({
        bookmaker: b,
        market: b.markets.find(m => m.key === 'h2h')
      }))
      .filter(item => item.market);

    if (h2hMarkets.length === 0) return null;

    return h2hMarkets;
  };

  const bestOdds = getBestOdds();
  const visibleBookmakers = expandedBookmakers ? bestOdds : bestOdds?.slice(0, 2);

  // Get primary bookmaker odds for inline display
  const primaryBook = bestOdds?.[0];
  const h2hMarket = primaryBook?.market;
  const spreadMarket = primaryBook?.bookmaker.markets.find(m => m.key === 'spreads');
  const totalMarket = primaryBook?.bookmaker.markets.find(m => m.key === 'totals');

  const awayML = h2hMarket?.outcomes.find(o => o.name === game.awayTeamName);
  const homeML = h2hMarket?.outcomes.find(o => o.name === game.homeTeamName);
  const awaySpread = spreadMarket?.outcomes.find(o => o.name === game.awayTeamName);
  const homeSpread = spreadMarket?.outcomes.find(o => o.name === game.homeTeamName);
  const totalOver = totalMarket?.outcomes.find(o => o.name === 'Over');
  const totalUnder = totalMarket?.outcomes.find(o => o.name === 'Under');

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
      game: game
    }));
  };

  return (
    <div className="relative group">
      {/* 8-bit Scoreboard */}
      <div
        className="pixel-card"
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          backgroundColor: '#020617',
          color: '#e5e7eb',
          border: '4px solid #e5e7eb',
          padding: '12px',
          boxShadow: '0 0 0 2px rgba(229,231,235,0.12) inset, 0 8px 16px rgba(0,0,0,0.4)',
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
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '6px 6px',
            pointerEvents: 'none',
          }}
        />

        {/* Sport Icon */}
        <div className="absolute top-2 right-2 w-10 h-10 opacity-30">
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
            {isLive && (game.period || game.clock || game.timeRemaining) ? (
              <div 
                className={`px-3 py-2 rounded text-white font-bold ${
                  blinkOn ? 'bg-red-600' : 'bg-red-900'
                } transition-colors border-2 border-red-500`}
              >
                <div className="text-[8px] tracking-wider leading-tight">
                  {game.period || 'LIVE'}
                </div>
                {(game.clock || game.timeRemaining) && (
                  <div className="text-[9px] tracking-wider leading-tight mt-0.5">
                    {game.clock || game.timeRemaining}
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

        {/* Betting Odds - Vertical Table Format - Always show all rows */}
        <div className="mt-3 pt-3 border-t-2 border-gray-700 relative z-10">
          <div className="text-[9px] space-y-1">
            {/* Moneyline Row */}
            <div className="grid grid-cols-[1fr_90px_1fr] gap-2 items-center">
              <button
                onClick={() => awayML && handleAddToBetSlip('moneyline', 'away', awayML.price)}
                disabled={!awayML}
                className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-[#38bdf8] px-2 py-1.5 rounded transition-colors text-center disabled:opacity-30 disabled:cursor-not-allowed min-h-[28px]"
              >
                {awayML ? (awayML.price > 0 ? '+' : '') + awayML.price : '--'}
              </button>
              <div className="text-[8px] font-bold tracking-wider uppercase opacity-60 whitespace-nowrap text-center">
                Moneyline
              </div>
              <button
                onClick={() => homeML && handleAddToBetSlip('moneyline', 'home', homeML.price)}
                disabled={!homeML}
                className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-[#f97316] px-2 py-1.5 rounded transition-colors text-center disabled:opacity-30 disabled:cursor-not-allowed min-h-[28px]"
              >
                {homeML ? (homeML.price > 0 ? '+' : '') + homeML.price : '--'}
              </button>
            </div>

            {/* Spread Row */}
            <div className="grid grid-cols-[1fr_90px_1fr] gap-2 items-center">
              <button
                onClick={() => awaySpread && handleAddToBetSlip('spread', 'away', awaySpread.price, awaySpread.point)}
                disabled={!awaySpread}
                className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-[#38bdf8] px-2 py-1.5 rounded transition-colors text-center disabled:opacity-30 disabled:cursor-not-allowed min-h-[28px]"
              >
                {awaySpread ? (awaySpread.point > 0 ? '+' : '') + awaySpread.point : '--'}
              </button>
              <div className="text-[8px] font-bold tracking-wider uppercase opacity-60 whitespace-nowrap text-center">
                Spread
              </div>
              <button
                onClick={() => homeSpread && handleAddToBetSlip('spread', 'home', homeSpread.price, homeSpread.point)}
                disabled={!homeSpread}
                className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-[#f97316] px-2 py-1.5 rounded transition-colors text-center disabled:opacity-30 disabled:cursor-not-allowed min-h-[28px]"
              >
                {homeSpread ? (homeSpread.point > 0 ? '+' : '') + homeSpread.point : '--'}
              </button>
            </div>

            {/* Total Row */}
            <div className="grid grid-cols-[1fr_90px_1fr] gap-2 items-center">
              <button
                onClick={() => totalOver && handleAddToBetSlip('total', 'over', totalOver.price, totalOver.point)}
                disabled={!totalOver}
                className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-green-500 px-2 py-1.5 rounded transition-colors text-center disabled:opacity-30 disabled:cursor-not-allowed min-h-[28px]"
              >
                {totalOver ? `O ${totalOver.point}` : '--'}
              </button>
              <div className="text-[8px] font-bold tracking-wider uppercase opacity-60 whitespace-nowrap text-center">
                Total
              </div>
              <button
                onClick={() => totalUnder && handleAddToBetSlip('total', 'under', totalUnder.price, totalUnder.point)}
                disabled={!totalUnder}
                className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-green-500 px-2 py-1.5 rounded transition-colors text-center disabled:opacity-30 disabled:cursor-not-allowed min-h-[28px]"
              >
                {totalUnder ? `U ${totalUnder.point}` : '--'}
              </button>
            </div>
          </div>
        </div>
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
