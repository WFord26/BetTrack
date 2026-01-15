import React from 'react';
import OddsCell, { EmptyOddsCell } from './OddsCell';
import { formatTime, getSportDisplayName, getSportColorClass } from '../../utils/format';

interface GameOdds {
  spread?: { line: number; odds: number };
  total?: { line: number; odds: number };
  moneyline?: number;
}

interface Game {
  id: string;
  sportKey: string;
  sportName: string;
  awayTeamName: string;
  homeTeamName: string;
  commenceTime: string;
  venue?: string;
  weather?: string;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
  awayOdds?: GameOdds;
  homeOdds?: GameOdds;
  period?: string | null;
  clock?: string | null;
}

interface Selection {
  gameId: string;
  selectionType: 'moneyline' | 'spread' | 'total';
  selection: 'home' | 'away' | 'over' | 'under';
  odds: number;
  line?: number;
  gameName: string;
  teamName?: string;
}

interface GameCardProps {
  game: Game;
  onSelect: (selection: Selection) => void;
  selectedBets?: Set<string>;
  useDecimalOdds?: boolean;
  bookmaker?: string;
}

export default function GameCard({ game, onSelect, selectedBets = new Set(), useDecimalOdds = false, bookmaker = 'draftkings' }: GameCardProps) {
  const isLive = game.status === 'in_progress';
  const isCompleted = game.status === 'final';
  const sportBadge = getSportDisplayName(game.sportKey);
  const sportColor = getSportColorClass(game.sportKey);

  // Get bookmaker display name and logo
  const getBookmakerInfo = (bookmakerKey: string) => {
    const bookmakers: Record<string, {name: string, logo: string, color: string}> = {
      draftkings: { name: 'DraftKings', logo: '👑', color: 'bg-green-600' },
      fanduel: { name: 'FanDuel', logo: '🎯', color: 'bg-blue-600' },
      betmgm: { name: 'BetMGM', logo: '🦁', color: 'bg-yellow-600' },
      pointsbet: { name: 'PointsBet', logo: '⚡', color: 'bg-red-600' },
      bovada: { name: 'Bovada', logo: '🐂', color: 'bg-red-700' },
      mybookie: { name: 'MyBookie', logo: '📚', color: 'bg-purple-600' },
    };
    return bookmakers[bookmakerKey] || { name: bookmakerKey, logo: '🎲', color: 'bg-gray-600' };
  };

  const bookmakerInfo = getBookmakerInfo(bookmaker);

  // Helper to generate selection key
  const getSelectionKey = (
    selectionType: string,
    selection: string,
    line?: number
  ): string => {
    return `${game.id}-${selectionType}-${selection}${line !== undefined ? `-${line}` : ''}`;
  };

  // Helper to check if selection is active
  const isSelected = (selectionType: string, selection: string, line?: number): boolean => {
    return selectedBets.has(getSelectionKey(selectionType, selection, line));
  };

  // Handler for moneyline selection
  const handleMoneylineClick = (selection: 'home' | 'away', odds: number) => {
    onSelect({
      gameId: game.id,
      selectionType: 'moneyline',
      selection,
      odds,
      gameName: `${game.awayTeamName} vs ${game.homeTeamName}`,
      teamName: selection === 'home' ? game.homeTeamName : game.awayTeamName
    });
  };

  // Handler for spread selection
  const handleSpreadClick = (
    selection: 'home' | 'away',
    odds: number,
    line: number
  ) => {
    onSelect({
      gameId: game.id,
      selectionType: 'spread',
      selection,
      odds,
      line,
      gameName: `${game.awayTeamName} vs ${game.homeTeamName}`,
      teamName: selection === 'home' ? game.homeTeamName : game.awayTeamName
    });
  };

  // Handler for total selection
  const handleTotalClick = (
    selection: 'over' | 'under',
    odds: number,
    line: number
  ) => {
    onSelect({
      gameId: game.id,
      selectionType: 'total',
      selection,
      odds,
      line,
      gameName: `${game.awayTeamName} vs ${game.homeTeamName}`
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      {/* Game Header */}
      <div className="bg-gray-50 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`${sportColor} text-white text-xs font-bold px-2 py-1 rounded`}>
              {sportBadge}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {formatTime(game.commenceTime)}
            </span>
            {isLive && (
              <div className="flex items-center gap-1">
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded animate-pulse">
                  LIVE
                </span>
                {(game.period || game.clock) && (
                  <span className="text-xs text-gray-600 dark:text-gray-300">
                    {game.period && <span>{game.period}</span>}
                    {game.clock && <span className="ml-1">{game.clock}</span>}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className={`${bookmakerInfo.color} text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1`}>
            <span>{bookmakerInfo.logo}</span>
            <span>{bookmakerInfo.name}</span>
          </div>
        </div>
        {/* Game Location/Weather Info */}
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <span>📍 {game.venue || `${game.homeTeamName} Home`}</span>
          {game.weather && (
            <span className="ml-3">🌤️ {game.weather}</span>
          )}
          {!game.weather && game.sportKey.includes('basketball') && (
            <span className="ml-3">🏀 Indoor Arena</span>
          )}
          {!game.weather && game.sportKey.includes('hockey') && (
            <span className="ml-3">🏒 Indoor Arena</span>
          )}
        </div>
      </div>

      {/* Column Headers - Only show for active games */}
      {!isCompleted && (
        <div className="grid grid-cols-[2fr_repeat(3,1fr)] gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300">
          <div>Team</div>
          <div className="text-center">Spread</div>
          <div className="text-center">Total</div>
          <div className="text-center">Moneyline</div>
        </div>
      )}
      
      {/* Final Score Header for completed games */}
      {isCompleted && (
        <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 text-center">
          Final Score
        </div>
      )}

      {/* Away Team Row */}
      {!isCompleted ? (
        <div className="grid grid-cols-[2fr_repeat(3,1fr)] gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 items-center">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">{game.awayTeamName}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Away</div>
            </div>
            {isLive && game.awayScore !== null && game.awayScore !== undefined && (
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {game.awayScore}
              </span>
            )}
          </div>
          
          <div className="flex justify-center">
            {game.awayOdds?.spread ? (
              <OddsCell
                odds={game.awayOdds.spread.odds}
                line={game.awayOdds.spread.line}
                selected={isSelected('spread', 'away', game.awayOdds.spread.line)}
                onClick={() =>
                  handleSpreadClick('away', game.awayOdds.spread!.odds, game.awayOdds.spread!.line)
                }
                useDecimalOdds={useDecimalOdds}
              />
            ) : (
              <EmptyOddsCell />
            )}
          </div>

          <div className="flex justify-center">
            {game.awayOdds?.total ? (
              <OddsCell
                odds={game.awayOdds.total.odds}
                line={game.awayOdds.total.line}
                prefix="O"
                selected={isSelected('total', 'over', game.awayOdds.total.line)}
                onClick={() =>
                  handleTotalClick('over', game.awayOdds.total!.odds, game.awayOdds.total!.line)
                }
                useDecimalOdds={useDecimalOdds}
              />
            ) : (
              <EmptyOddsCell />
            )}
          </div>

          <div className="flex justify-center">
            {game.awayOdds?.moneyline ? (
              <OddsCell
                odds={game.awayOdds.moneyline}
                selected={isSelected('moneyline', 'away')}
                onClick={() => handleMoneylineClick('away', game.awayOdds.moneyline!)}
                useDecimalOdds={useDecimalOdds}
              />
            ) : (
              <EmptyOddsCell />
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{game.awayTeamName}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Away</div>
          </div>
          <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {game.awayScore ?? '-'}
          </span>
        </div>
      )}

      {/* Home Team Row */}
      {!isCompleted ? (
        <div className="grid grid-cols-[2fr_repeat(3,1fr)] gap-2 px-4 py-3 items-center">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">{game.homeTeamName}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Home</div>
            </div>
            {isLive && game.homeScore !== null && game.homeScore !== undefined && (
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {game.homeScore}
              </span>
            )}
          </div>
          
          <div className="flex justify-center">
            {game.homeOdds?.spread ? (
              <OddsCell
                odds={game.homeOdds.spread.odds}
                line={game.homeOdds.spread.line}
                selected={isSelected('spread', 'home', game.homeOdds.spread.line)}
                onClick={() =>
                  handleSpreadClick('home', game.homeOdds.spread!.odds, game.homeOdds.spread!.line)
                }
                useDecimalOdds={useDecimalOdds}
              />
            ) : (
              <EmptyOddsCell />
            )}
          </div>

          <div className="flex justify-center">
            {game.homeOdds?.total ? (
              <OddsCell
                odds={game.homeOdds.total.odds}
                line={game.homeOdds.total.line}
                prefix="U"
                selected={isSelected('total', 'under', game.homeOdds.total.line)}
                onClick={() =>
                  handleTotalClick('under', game.homeOdds.total!.odds, game.homeOdds.total!.line)
                }
                useDecimalOdds={useDecimalOdds}
              />
            ) : (
              <EmptyOddsCell />
            )}
          </div>

          <div className="flex justify-center">
            {game.homeOdds?.moneyline ? (
              <OddsCell
                odds={game.homeOdds.moneyline}
                selected={isSelected('moneyline', 'home')}
                onClick={() => handleMoneylineClick('home', game.homeOdds.moneyline!)}
                useDecimalOdds={useDecimalOdds}
              />
            ) : (
              <EmptyOddsCell />
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{game.homeTeamName}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Home</div>
          </div>
          <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {game.homeScore ?? '-'}
          </span>
        </div>
      )}
    </div>
  );
}
