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
    if (leg.selectionType === 'moneyline') {
      return `${leg.teamName} ML`;
    }
    if (leg.selectionType === 'spread') {
      const line = leg.line > 0 ? `+${leg.line}` : leg.line;
      return `${leg.teamName} ${line}`;
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{bet.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {formatRelativeTime(bet.placedAt)}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {getBetTypeBadge()}
            {getStatusBadge()}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
          <div>
            <p className="text-xs text-gray-500">Stake</p>
            <p className="text-sm font-semibold text-gray-900">{formatCurrency(bet.stake)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Odds</p>
            <p className="text-sm font-semibold text-gray-900">{formatOdds(bet.oddsAtPlacement)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">
              {bet.status === 'pending' ? 'Potential' : 'Payout'}
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {bet.status === 'pending'
                ? formatCurrency(bet.potentialPayout || 0)
                : formatCurrency(bet.actualPayout || 0)}
            </p>
          </div>
          {profit !== null && (
            <div>
              <p className="text-xs text-gray-500">Profit</p>
              <p className={`text-sm font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Legs Section */}
      <div className="bg-gray-50">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700">
            {bet.legs.length} {bet.legs.length === 1 ? 'Leg' : 'Legs'}
          </span>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isExpanded && (
          <div className="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
            {bet.legs.map((leg, index) => (
              <div key={leg.id || index} className="px-4 py-3 bg-white dark:bg-gray-800">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Sport Badge */}
                    {leg.game && leg.game.sportKey && (
                      <span className={`${getSportColorClass(leg.game.sportKey)} text-white text-xs font-bold px-2 py-0.5 rounded mb-1 inline-block`}>
                        {getSportDisplayName(leg.game.sportKey)}
                      </span>
                    )}

                    {/* Game */}
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {leg.game ? `${leg.game.awayTeamName} @ ${leg.game.homeTeamName}` : 'Game'}
                    </p>

                    {/* Selection */}
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      {formatLegSelection(leg)} <span className="text-gray-500 dark:text-gray-400">({formatOdds(leg.odds)})</span>
                    </p>
                  </div>

                  {/* Status */}
                  <div className="ml-4 flex-shrink-0">
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
