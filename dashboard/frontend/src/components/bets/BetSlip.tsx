import React, { useState } from 'react';
import { useBetSlip } from '../../hooks/useBetSlip';
import BetLegItem from './BetLegItem';
import TeaserControl from './TeaserControl';
import { formatOdds, formatCurrency } from '../../utils/format';

interface BetSlipProps {
  useDecimalOdds?: boolean;
  onClear?: () => void;
  onRemoveLeg?: (index: number) => void;
}

export default function BetSlip({ useDecimalOdds = false, onClear, onRemoveLeg }: BetSlipProps) {
  const {
    legs,
    betType,
    stake,
    teaserPoints,
    combinedOdds,
    potentialPayout,
    potentialProfit,
    isValid,
    isSubmitting,
    submitError,
    removeLeg,
    updateLeg,
    setBetType,
    setStake,
    setTeaserPoints,
    clearSlip,
    submitBet
  } = useBetSlip();

  const [betName, setBetName] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Quick stake buttons
  const quickStakes = [10, 25, 50, 100, 250, 500];

  // Handle clear with callback
  const handleClearSlip = () => {
    clearSlip();
    if (onClear) {
      onClear();
    }
  };

  // Handle remove leg with callback
  const handleRemoveLeg = (index: number) => {
    removeLeg(index);
    if (onRemoveLeg) {
      onRemoveLeg(index);
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!isValid || !betName.trim()) return;

    const success = await submitBet({ name: betName.trim() });
    
    if (success) {
      setBetName('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      
      // Clear selections in parent component
      if (onClear) {
        onClear();
      }
    }
  };

  // Minimized state
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full shadow-2xl p-4 hover:from-blue-700 hover:to-blue-800 transition-all z-50 flex items-center gap-2"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        {legs.length > 0 && (
          <span className="bg-white text-blue-700 rounded-full px-2.5 py-0.5 text-sm font-bold">
            {legs.length}
          </span>
        )}
      </button>
    );
  }

  // Empty state
  if (legs.length === 0) {
    return (
      <div className="fixed bottom-4 right-4 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 text-center z-50 border-2 border-blue-600 dark:border-blue-500">
        <button
          onClick={() => setIsMinimized(true)}
          className="absolute top-3 right-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Minimize"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <div className="text-4xl mb-3">🎟️</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {/* Minimize button */}
          <button
            onClick={() => setIsMinimized(true)}
            className="text-white/80 hover:text-white transition-colors p-1"
            title="Minimize"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          Bet Slip Empty
        </h3>
        <p className="text-sm text-gray-600">
          Click on any odds to add them to your bet slip
        </p>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] z-50 border-2 border-blue-600">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-lg">Bet Slip</h3>
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-semibold">
            {legs.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Minimize button */}
          <button
            onClick={() => setIsMinimized(true)}
            className="text-white/80 hover:text-white transition-colors p-1"
            title="Minimize"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={handleClearSlip}
            className="text-white/80 hover:text-white transition-colors text-sm font-medium"
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Success Message */}
        {showSuccess && (
          <div className="m-4 bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-800 font-medium">
              ✅ Bet placed successfully!
            </p>
          </div>
        )}

        {/* Error Message */}
        {submitError && (
          <div className="m-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">{submitError}</p>
          </div>
        )}

        <div className="p-4 space-y-4">
          {/* Bet Type Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setBetType('single')}
              disabled={legs.length > 1}
              className={`
                flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all
                ${
                  betType === 'single'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
                ${legs.length > 1 ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              Single
            </button>
            <button
              onClick={() => setBetType('parlay')}
              disabled={legs.length < 2}
              className={`
                flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all
                ${
                  betType === 'parlay'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
                ${legs.length < 2 ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              Parlay
            </button>
            <button
              onClick={() => setBetType('teaser')}
              disabled={legs.length < 2}
              className={`
                flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all
                ${
                  betType === 'teaser'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
                ${legs.length < 2 ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              Teaser
            </button>
          </div>

          {/* Teaser Control */}
          {betType === 'teaser' && (
            <TeaserControl
              legs={legs}
              selectedPoints={teaserPoints}
              onChange={setTeaserPoints}
            />
          )}

          {/* Legs */}
          <div className="space-y-2">
            {legs.map((leg, index) => (
              <BetLegItem
                key={index}
                leg={leg}
                index={index}
                onRemove={handleRemoveLeg}
                onUpdate={updateLeg}
                showTeaser={betType === 'teaser'}
                teaserPoints={teaserPoints}
                useDecimalOdds={useDecimalOdds}
              />
            ))}
          </div>

          {/* Bet Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bet Name *
            </label>
            <input
              type="text"
              value={betName}
              onChange={(e) => setBetName(e.target.value)}
              placeholder="e.g., Sunday Parlay"
              maxLength={100}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Stake */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Stake Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400">$</span>
              <input
                type="number"
                step="1"
                min="0"
                value={stake || ''}
                onChange={(e) => setStake(parseFloat(e.target.value) || 0)}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="0.00"
              />
            </div>

            {/* Quick Stakes */}
            <div className="grid grid-cols-3 gap-2 mt-2">
              {quickStakes.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setStake(amount)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded transition-colors"
                >
                  ${amount}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Odds & Submit */}
      <div className="border-t border-gray-200 p-4 space-y-3 bg-gray-50">
        {/* Combined Odds */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Combined Odds:</span>
          <span className="font-bold text-gray-900">
            {combinedOdds ? formatOdds(combinedOdds, useDecimalOdds) : '—'}
          </span>
        </div>

        {/* Potential Payout */}
        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-green-800">Potential Payout:</span>
            <span className="text-xl font-bold text-green-900">
              {stake > 0 ? formatCurrency(potentialPayout) : '$0.00'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-green-700">Profit:</span>
            <span className="font-semibold text-green-800">
              {stake > 0 ? formatCurrency(potentialProfit) : '$0.00'}
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || !betName.trim() || isSubmitting}
          className={`
            w-full py-3 rounded-lg font-bold text-white transition-all
            ${
              isValid && betName.trim() && !isSubmitting
                ? 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'
                : 'bg-gray-300 cursor-not-allowed'
            }
          `}
        >
          {isSubmitting ? 'Placing Bet...' : 'Place Bet'}
        </button>

        {/* Validation Messages */}
        {!betName.trim() && legs.length > 0 && (
          <p className="text-xs text-red-600 text-center">
            Bet name is required
          </p>
        )}
        {stake <= 0 && legs.length > 0 && (
          <p className="text-xs text-red-600 text-center">
            Enter stake amount
          </p>
        )}
      </div>
    </div>
  );
}
