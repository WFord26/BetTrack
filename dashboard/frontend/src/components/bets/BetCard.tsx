import React, { useState } from 'react';
import { Bet } from '../../types/game.types';
import { formatCurrency, formatOdds, formatDate, formatRelativeTime, getSportDisplayName, getSportColorClass } from '../../utils/format';
import api from '../../services/api';

interface BetCardProps {
  bet: Bet;
}

export default function BetCard({ bet }: BetCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [cashOutAmount, setCashOutAmount] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Group legs by SGP
  const groupedLegs = React.useMemo(() => {
    const sgpGroups: { [key: string]: typeof bet.legs } = {};
    const regularLegs: typeof bet.legs = [];

    bet.legs.forEach(leg => {
      if (leg.sgpGroupId) {
        if (!sgpGroups[leg.sgpGroupId]) {
          sgpGroups[leg.sgpGroupId] = [];
        }
        sgpGroups[leg.sgpGroupId].push(leg);
      } else {
        regularLegs.push(leg);
      }
    });

    return { sgpGroups, regularLegs };
  }, [bet.legs]);

  // Status badge styling
  const getStatusBadge = () => {
    const statusConfig = {
      pending: { label: 'Pending', classes: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      won: { label: 'Won', classes: 'bg-green-100 text-green-800 border-green-200' },
      lost: { label: 'Lost', classes: 'bg-red-100 text-red-800 border-red-200' },
      push: { label: 'Push', classes: 'bg-gray-100 text-gray-800 border-gray-200' },
      cancelled: { label: 'Cancelled', classes: 'bg-gray-100 text-gray-500 border-gray-200' }
    };

    const config = statusConfig[bet.status] || statusConfig.pending;

    return (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${config.classes}`}>
        {config.label}
      </span>
    );
  };

  // Bet type badge styling
  const getBetTypeBadge = () => {
    const typeConfig = {
      single: { label: 'Single', classes: 'bg-blue-100 text-blue-800' },
      parlay: { label: 'Parlay', classes: 'bg-purple-100 text-purple-800' },
      teaser: { label: 'Teaser', classes: 'bg-pink-100 text-pink-800' }
    };

    const config = typeConfig[bet.betType] || typeConfig.single;

    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${config.classes}`}>
        {config.label}
      </span>
    );
  };

  // Calculate profit/loss
  const getProfit = () => {
    if (bet.status === 'pending' || !bet.actualPayout) {
      return null;
    }
    return bet.actualPayout - bet.stake;
  };

  const profit = getProfit();

  // Format leg selection display
  const formatLegSelection = (leg: any) => {
    // Determine the team name based on selection
    const getTeamName = () => {
      if (!leg.game) return leg.teamName || 'Team';
      
      if (leg.selectionType === 'moneyline' || leg.selectionType === 'spread') {
        return leg.selection === 'home' ? leg.game.homeTeamName : leg.game.awayTeamName;
      }
      
      return leg.teamName || leg.game.homeTeamName || 'Team';
    };

    if (leg.selectionType === 'moneyline') {
      return `${getTeamName()} ML`;
    }
    if (leg.selectionType === 'spread') {
      const line = leg.line > 0 ? `+${leg.line}` : leg.line;
      return `${getTeamName()} ${line}`;
    }
    if (leg.selectionType === 'total') {
      const direction = leg.selection === 'over' ? 'O' : 'U';
      return `${direction} ${leg.line}`;
    }
    return leg.selection;
  };

  // Get leg status badge
  const getLegStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: '⏳', classes: 'text-yellow-600' },
      won: { label: '✓', classes: 'text-green-600' },
      lost: { label: '✗', classes: 'text-red-600' },
      push: { label: '—', classes: 'text-gray-600' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

    return <span className={`text-lg font-bold ${config.classes}`}>{config.label}</span>;
  };

  // Handle cash out
  const handleCashOut = async () => {
    if (!cashOutAmount || parseFloat(cashOutAmount) <= 0) return;

    setIsProcessing(true);
    try {
      const payout = parseFloat(cashOutAmount);
      const profit = payout - bet.stake;
      const status = profit > 0 ? 'won' : profit < 0 ? 'lost' : 'push';

      await api.post(`/bets/${bet.id}/settle`, {
        status,
        actualPayout: payout
      });

      // Reload the page to show updated bet
      window.location.reload();
    } catch (error) {
      console.error('Error cashing out bet:', error);
      alert('Failed to cash out bet. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    setIsProcessing(true);
    try {
      await api.delete(`/bets/${bet.id}?force=true`);
      // Reload the page to remove the deleted bet
      window.location.reload();
    } catch (error) {
      console.error('Error deleting bet:', error);
      alert('Failed to delete bet. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:scale-[1.01] transition-all duration-200">
      {/* Header with gradient accent */}
      <div className="relative p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/10 dark:to-purple-900/10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate flex items-center gap-2">
              <span className="inline-block w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></span>
              {bet.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              {formatRelativeTime(bet.placedAt)}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {getBetTypeBadge()}
            {getStatusBadge()}
          </div>
        </div>

        {/* Stats Grid with enhanced styling */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg p-3 border border-gray-200/50 dark:border-gray-700/50">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Stake</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-0.5">{formatCurrency(bet.stake)}</p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg p-3 border border-gray-200/50 dark:border-gray-700/50">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Odds</p>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">{formatOdds(bet.oddsAtPlacement)}</p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg p-3 border border-gray-200/50 dark:border-gray-700/50">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              {bet.status === 'pending' ? 'Potential' : 'Payout'}
            </p>
            <p className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-0.5">
              {bet.status === 'pending'
                ? formatCurrency(bet.potentialPayout || 0)
                : formatCurrency(bet.actualPayout || 0)}
            </p>
          </div>
          {profit !== null && (
            <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg p-3 border border-gray-200/50 dark:border-gray-700/50">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Profit</p>
              <p className={`text-lg font-bold mt-0.5 ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Legs Section with modern styling */}
      <div className="bg-gray-50/50 dark:bg-gray-800/50">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-100/80 dark:hover:bg-gray-700/80 transition-all group"
        >
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <span className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
              {bet.legs.length}
            </span>
            {bet.legs.length === 1 ? 'Leg' : 'Legs'}
          </span>
          <svg
            className={`w-5 h-5 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-all duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isExpanded && (
          <div className="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
            {/* SGP Groups with enhanced design */}
            {Object.entries(groupedLegs.sgpGroups).map(([groupId, legs]) => (
              <div key={`sgp-${groupId}`} className="px-4 py-4 bg-gradient-to-r from-purple-100/80 to-pink-100/80 dark:from-purple-900/30 dark:to-pink-900/30 border-l-4 border-purple-600 shadow-inner">
                {/* SGP Badge */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-lg shadow-md">
                    ⚡ SAME GAME PARLAY
                  </span>
                  <span className="text-xs text-purple-800 dark:text-purple-200 font-semibold bg-white/60 dark:bg-black/20 px-2 py-1 rounded">
                    {legs.length} legs • {formatOdds(bet.oddsAtPlacement)}
                  </span>
                </div>

                {/* Game Info with score */}
                {legs[0].game && (
                  <div className="mb-3 p-3 bg-white/70 dark:bg-gray-800/70 rounded-lg border border-purple-200 dark:border-purple-800">
                    {legs[0].game.sportKey && (
                      <span className={`${getSportColorClass(legs[0].game.sportKey)} text-white text-xs font-bold px-2.5 py-1 rounded-md inline-block shadow-sm`}>
                        {getSportDisplayName(legs[0].game.sportKey)}
                      </span>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {legs[0].game.awayTeamName}
                        </p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                          {legs[0].game.homeTeamName}
                        </p>
                      </div>
                      {legs[0].game.awayScore !== undefined && legs[0].game.homeScore !== undefined && (
                        <div className="text-right ml-4">
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            {legs[0].game.awayScore}
                          </p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            {legs[0].game.homeScore}
                          </p>
                        </div>
                      )}
                    </div>
                    {legs[0].game.commenceTime && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                        {formatDate(legs[0].game.commenceTime)}
                      </p>
                    )}
                  </div>
                )}

                {/* SGP Legs */}
                <div className="space-y-2">
                  {legs.map((leg, idx) => (
                    <div key={leg.id || idx} className="flex items-center justify-between bg-white/80 dark:bg-gray-800/80 p-2.5 rounded-lg border border-purple-200/50 dark:border-purple-800/50">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-purple-600 dark:text-purple-400 font-bold text-lg">•</span>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          {formatLegSelection(leg)}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                          ({formatOdds(leg.odds)})
                        </span>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        {getLegStatusBadge(leg.status || 'pending')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Regular Legs with enhanced design */}
            {groupedLegs.regularLegs.map((leg, index) => (
              <div key={leg.id || index} className="px-4 py-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Sport Badge */}
                    {leg.game && leg.game.sportKey && (
                      <span className={`${getSportColorClass(leg.game.sportKey)} text-white text-xs font-bold px-2.5 py-1 rounded-md mb-2 inline-block shadow-sm`}>
                        {getSportDisplayName(leg.game.sportKey)}
                      </span>
                    )}

                    {/* Game Info with scores */}
                    {leg.game && (
                      <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                              {leg.game.awayTeamName}
                            </p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                              {leg.game.homeTeamName}
                            </p>
                          </div>
                          {leg.game.awayScore !== undefined && leg.game.homeScore !== undefined && (
                            <div className="text-right ml-4">
                              <p className="text-lg font-bold text-gray-900 dark:text-white">
                                {leg.game.awayScore}
                              </p>
                              <p className="text-lg font-bold text-gray-900 dark:text-white">
                                {leg.game.homeScore}
                              </p>
                            </div>
                          )}
                        </div>
                        {leg.game.commenceTime && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                            </svg>
                            {formatDate(leg.game.commenceTime)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Selection with prominent display */}
                    <div className="mt-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-3 rounded-lg border-l-4 border-blue-500">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {formatLegSelection(leg)}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">
                        Odds: {formatOdds(leg.odds)}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex-shrink-0 mt-1">
                    {getLegStatusBadge(leg.status || 'pending')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer (Settled Date or Actions) */}
      {bet.settledAt ? (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-t border-gray-100 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
          Settled {formatRelativeTime(bet.settledAt)}
        </div>
      ) : (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-100 dark:border-gray-600 flex gap-2">
          <button
            onClick={() => setShowCashOutModal(true)}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Cash Out
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      )}

      {/* Cash Out Modal */}
      {showCashOutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Cash Out Bet</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Enter the amount you received for cashing out this bet. The bet will be marked as closed.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cash Out Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={cashOutAmount}
                onChange={(e) => setCashOutAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                autoFocus
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Original stake: {formatCurrency(bet.stake)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCashOutModal(false);
                  setCashOutAmount('');
                }}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCashOut}
                disabled={isProcessing || !cashOutAmount || parseFloat(cashOutAmount) <= 0}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Processing...' : 'Confirm Cash Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Delete Bet</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this bet? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
