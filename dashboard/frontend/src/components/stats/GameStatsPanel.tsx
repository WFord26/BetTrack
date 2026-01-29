import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStats } from '../../hooks/useGameStats';
import BoxScore from './BoxScore';
import StatComparison from './StatComparison';
import PlayerStatsTable from './PlayerStatsTable';

interface GameStatsPanelProps {
  gameId: string;
  isLive?: boolean;
}

export default function GameStatsPanel({ gameId, isLive }: GameStatsPanelProps) {
  const navigate = useNavigate();
  const [showAverages, setShowAverages] = useState(true);
  const { data, loading, error } = useGameStats(
    gameId,
    isLive ? 15000 : undefined // Poll every 15s if live
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse bg-gray-800 rounded-lg p-6">
          <div className="h-8 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
        <h3 className="text-red-400 font-bold mb-2">Failed to load game stats</h3>
        <p className="text-red-300">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <p className="text-gray-400 text-center">No statistics available for this game</p>
      </div>
    );
  }

  const homeStats = data.teamStats.find(t => t.isHome);
  const awayStats = data.teamStats.find(t => !t.isHome);
  
  // Find season averages for teams
  const homeAvg = data.seasonAverages?.find(a => a.teamId === homeStats?.teamId);
  const awayAvg = data.seasonAverages?.find(a => a.teamId === awayStats?.teamId);

  // Check if we have any game data
  const hasGameStats = homeStats || awayStats || data.playerStats.length > 0;
  const hasSeasonAverages = homeAvg || awayAvg;

  return (
    <div className="space-y-6">
      {/* Toggle for current game vs season averages - only show if we have game stats */}
      {hasGameStats && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowAverages(!showAverages)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            {showAverages ? 'Show Current Game' : 'Show Season Averages'}
          </button>
        </div>
      )}

      {/* No data message - only show if we have no stats at all */}
      {!hasGameStats && !hasSeasonAverages && (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-white mb-2">
              Live Stats Not Available
            </h3>
            <p className="text-gray-400 mb-4">
              Detailed game statistics require an API-Sports subscription with live data access.
            </p>
            <div className="bg-gray-700/50 rounded-lg p-4 mb-4 text-left max-w-2xl mx-auto">
              <p className="text-gray-300 text-sm mb-3">
                <strong className="text-white">Current Setup:</strong> You're using The Odds API for betting lines and scores.
              </p>
              <p className="text-gray-300 text-sm mb-3">
                <strong className="text-white">To enable live stats:</strong>
              </p>
              <ul className="text-gray-400 text-sm space-y-1 ml-4">
                <li>• API-Sports Basic Plan ($10-15/mo): Live scores + basic stats</li>
                <li>• API-Sports Pro Plan ($30-50/mo): Full player stats + historical data</li>
                <li>• Sign up at: <a href="https://dashboard.api-football.com/register" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">dashboard.api-football.com</a></li>
              </ul>
              <p className="text-gray-500 text-xs mt-3">
                Note: Free tier only provides historical data after games complete, not live stats.
              </p>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Season Averages Section - show by default if no game stats yet */}
      {(showAverages || !hasGameStats) && hasSeasonAverages && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">Season Averages</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Away Team Averages */}
            {awayAvg && (
              <div className="bg-gray-700/50 rounded-lg p-4">
                <h4 className="text-blue-400 font-semibold mb-2">
                  {awayStats?.team.name}
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Games Played:</span>
                    <span className="text-white font-medium">{awayAvg.totalGames}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Home Record:</span>
                    <span className="text-white font-medium">{awayAvg.homeGames}G</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Away Record:</span>
                    <span className="text-white font-medium">{awayAvg.awayGames}G</span>
                  </div>
                  {awayAvg.avgStats && Object.entries(awayAvg.avgStats).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-400 capitalize">{key}:</span>
                      <span className="text-white font-medium">{value as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Home Team Averages */}
            {homeAvg && (
              <div className="bg-gray-700/50 rounded-lg p-4">
                <h4 className="text-red-400 font-semibold mb-2">
                  {homeStats?.team.name}
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Games Played:</span>
                    <span className="text-white font-medium">{homeAvg.totalGames}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Home Record:</span>
                    <span className="text-white font-medium">{homeAvg.homeGames}G</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Away Record:</span>
                    <span className="text-white font-medium">{homeAvg.awayGames}G</span>
                  </div>
                  {homeAvg.avgStats && Object.entries(homeAvg.avgStats).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-400 capitalize">{key}:</span>
                      <span className="text-white font-medium">{value as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Box Score */}
      {!showAverages && (homeStats?.quarterScores || awayStats?.quarterScores) && (
        <BoxScore
          homeTeam={homeStats?.team}
          awayTeam={awayStats?.team}
          homeScores={homeStats?.quarterScores || []}
          awayScores={awayStats?.quarterScores || []}
        />
      )}

      {/* Team Stats Comparison */}
      {!showAverages && (homeStats?.stats || awayStats?.stats) && (
        <StatComparison
          homeStats={homeStats?.stats}
          awayStats={awayStats?.stats}
          homeTeam={homeStats?.team.abbreviation || homeStats?.team.name}
          awayTeam={awayStats?.team.abbreviation || awayStats?.team.name}
        />
      )}

      {/* Player Stats */}
      {!showAverages && data.playerStats.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {awayStats && (
            <PlayerStatsTable
              title={`${awayStats.team.abbreviation || awayStats.team.name} Players`}
              players={data.playerStats.filter(
                p => p.team.id === awayStats.teamId
              )}
            />
          )}
          {homeStats && (
            <PlayerStatsTable
              title={`${homeStats.team.abbreviation || homeStats.team.name} Players`}
              players={data.playerStats.filter(
                p => p.team.id === homeStats.teamId
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}
