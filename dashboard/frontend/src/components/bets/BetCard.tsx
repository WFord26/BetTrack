import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Bet } from '../../types/game.types';
import { formatCurrency, formatOdds, formatDate, formatRelativeTime, getSportDisplayName, getSportColorClass } from '../../utils/format';
import { useDarkMode } from '../../contexts/DarkModeContext';
import api from '../../services/api';

interface BetCardProps {
  bet: Bet;
}

export default function BetCard({ bet }: BetCardProps) {
  const { isDarkMode } = useDarkMode();
  const [isFlipped, setIsFlipped] = useState(false);
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [cashOutAmount, setCashOutAmount] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleStatus, setSettleStatus] = useState<'won' | 'lost' | 'push'>('won');
  const [settleAmount, setSettleAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate actual odds (boosted if payout is higher than expected)
  const displayedOdds = React.useMemo(() => {
    // Convert string values to numbers (Prisma returns Decimal as string)
    const stake = Number(bet.stake);
    const potentialPayout = Number(bet.potentialPayout);
    
    // Calculate what payout SHOULD be based on oddsAtPlacement
    const expectedPayout = bet.oddsAtPlacement > 0
      ? stake * (1 + bet.oddsAtPlacement / 100)
      : stake * (1 + 100 / Math.abs(bet.oddsAtPlacement));
    
    // Check if actual payout is higher (boosted)
    const isBoosted = Math.abs(potentialPayout - expectedPayout) > 0.01;
    
    console.log(`[BetCard ${bet.name}] Boost detection:`, {
      oddsAtPlacement: bet.oddsAtPlacement,
      stake: stake,
      expectedPayout: expectedPayout.toFixed(2),
      actualPayout: potentialPayout.toFixed(2),
      isBoosted
    });
    
    if (!isBoosted) {
      return bet.oddsAtPlacement;
    }
    
    // Back-calculate boosted odds from actual payout
    const boostedDecimal = potentialPayout / stake;
    const boostedAmerican = boostedDecimal >= 2
      ? Math.round((boostedDecimal - 1) * 100)
      : Math.round(-100 / (boostedDecimal - 1));
    
    console.log(`[BetCard ${bet.name}] Boosted odds:`, boostedAmerican);
    return boostedAmerican;
  }, [bet.oddsAtPlacement, bet.stake, bet.potentialPayout, bet.name]);

  const wasBoosted = displayedOdds !== bet.oddsAtPlacement;

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

  // Handle settle
  const handleSettle = async () => {
    setIsProcessing(true);
    try {
      const payload: any = { status: settleStatus };
      
      // If custom amount provided, use it; otherwise let backend calculate
      if (settleAmount && parseFloat(settleAmount) > 0) {
        payload.actualPayout = parseFloat(settleAmount);
      }

      await api.post(`/bets/${bet.id}/settle`, payload);
      window.location.reload();
    } catch (error) {
      console.error('Error settling bet:', error);
      alert('Failed to settle bet. Please try again.');
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

  // Status color for card border
  const getStatusColor = () => {
    switch (bet.status) {
      case 'won': return 'border-green-600';
      case 'lost': return 'border-red-600';
      case 'push': return 'border-gray-500';
      case 'cancelled': return 'border-gray-400';
      default: return 'border-red-600';
    }
  };

  return (
    <>
      {/* Playing Card Container with Flip Animation */}
      <div 
        className="playing-card-container cursor-pointer block"
        style={{
          perspective: '1000px',
          height: '430px',
          maxHeight: '430px',
          width: '100%',
          margin: 0,
          padding: 0,
          overflow: 'hidden'
        }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div
          className="relative w-full h-full transition-transform duration-700"
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
          }}
        >
          {/* FRONT OF CARD */}
          <div 
            className="absolute inset-0 rounded-lg overflow-hidden"
            style={{
              backfaceVisibility: 'hidden',
              boxShadow: '8px 8px 0px rgba(0, 0, 0, 0.3)',
              imageRendering: 'pixelated',
              backgroundImage: `url(${isDarkMode ? '/cards/spade-dark.svg' : '/cards/spade-light.svg'})`,
              backgroundSize: '150%',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          >
          {/* Status Badge - Upper Right Corner Inside Card */}
          <div className="absolute top-3 right-3 z-20">
            {getStatusBadge()}
          </div>

          {/* Centered Content */}
          <div className="relative z-10 h-full flex flex-col justify-center items-center text-center p-6">
              {/* Bet Name */}
              <h3 
                className="text-xl font-bold text-gray-900 dark:text-white mb-4 truncate"
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  textShadow: '2px 2px 0px rgba(0,0,0,0.2)',
                  letterSpacing: '0.05em'
                }}
              >
                {bet.name}
              </h3>

              {/* Stats Grid */}
              <div className="space-y-3">
                {/* Stake */}
                <div className="flex justify-between items-center border-b-2 border-dashed border-gray-300 dark:border-gray-600 pb-2">
                  <span 
                    className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase"
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      letterSpacing: '0.05em'
                    }}
                  >
                    STAKE
                  </span>
                  <span 
                    className="text-xl font-bold text-gray-900 dark:text-white"
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      textShadow: '2px 2px 0px rgba(0,0,0,0.1)'
                    }}
                  >
                    {formatCurrency(bet.stake)}
                  </span>
                </div>

                {/* Odds */}
                <div className="flex justify-between items-center border-b-2 border-dashed border-gray-300 dark:border-gray-600 pb-2">
                  <span 
                    className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase"
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      letterSpacing: '0.05em'
                    }}
                  >
                    ODDS
                  </span>
                  <span 
                    className="text-xl font-bold text-red-600 dark:text-red-400"
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      textShadow: '2px 2px 0px rgba(0,0,0,0.1)'
                    }}
                  >
                    {formatOdds(displayedOdds)}
                  </span>
                </div>

                {/* Payout */}
                <div className="flex justify-between items-center border-b-2 border-dashed border-gray-300 dark:border-gray-600 pb-2">
                  <span 
                    className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase"
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      letterSpacing: '0.05em'
                    }}
                  >
                    PAYOUT
                  </span>
                  <span 
                    className="text-xl font-bold text-gray-900 dark:text-white"
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      textShadow: '2px 2px 0px rgba(0,0,0,0.1)'
                    }}
                  >
                    {bet.status === 'pending'
                      ? formatCurrency(Number(bet.potentialPayout || 0))
                      : formatCurrency(Number(bet.actualPayout || 0))}
                  </span>
                </div>

                {/* Profit */}
                {profit !== null && (
                  <div className="flex justify-between items-center pt-1">
                    <span 
                      className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase"
                      style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        letterSpacing: '0.05em'
                      }}
                    >
                      PROFIT
                    </span>
                    <span 
                      className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                      style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        textShadow: '3px 3px 0px rgba(0,0,0,0.2)'
                      }}
                    >
                      {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                    </span>
                  </div>
                )}
              </div>

              {/* Status Badge */}
              <div className="mt-4 flex justify-center">
                {getStatusBadge()}
              </div>
              
              {/* Click to flip hint */}
              <p 
                className="text-xs text-center text-gray-500 dark:text-gray-400 mt-3"
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                }}
              >
                CLICK TO VIEW LEGS ↻
              </p>
            </div>
          </div>

          {/* BACK OF CARD */}
          <div 
          className="absolute inset-0 rounded-lg overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            boxShadow: '8px 8px 0px rgba(0, 0, 0, 0.3)',
            imageRendering: 'pixelated',
            backgroundImage: `url(${isDarkMode ? '/cards/spade-dark.svg' : '/cards/spade-light.svg'})`,
            backgroundSize: '150%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
            <div 
              className="relative z-10 overflow-y-auto card-back-scroll"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#dc2626 rgba(0,0,0,0.1)',
                boxSizing: 'border-box',
                padding: '50px 60px 60px 60px',
                height: '100%',
                maxHeight: '320px'
              }}
            >
              <style>{`
                .card-back-scroll::-webkit-scrollbar {
                  width: 8px;
                }
                .card-back-scroll::-webkit-scrollbar-track {
                  background: rgba(0,0,0,0.1);
                  border-radius: 4px;
                }
                .card-back-scroll::-webkit-scrollbar-thumb {
                  background: #dc2626;
                  border-radius: 4px;
                  border: 2px solid rgba(0,0,0,0.1);
                }
                .card-back-scroll::-webkit-scrollbar-thumb:hover {
                  background: #b91c1c;
                }
              `}</style>
              <h4 
                className="text-sm font-bold text-gray-900 dark:text-white mb-2"
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  textShadow: '2px 2px 0px rgba(0,0,0,0.2)',
                  letterSpacing: '0.05em'
                }}
              >
                {bet.betType.toUpperCase()} • {bet.legs.length} {bet.legs.length === 1 ? 'LEG' : 'LEGS'}
              </h4>

              {/* Legs List */}
              <div className="space-y-1">
                {/* SGP Groups */}
                {Object.entries(groupedLegs.sgpGroups).map(([groupId, legs]) => (
                  <div key={`sgp-${groupId}`} className="mb-2">
                    <div 
                      className="text-xs font-bold text-red-600 dark:text-red-400 mb-1"
                      style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        letterSpacing: '0.05em'
                      }}
                    >
                      ⚡ SGP
                    </div>
                    {legs.map((leg, idx) => (
                      <div key={leg.id || idx} className="text-xs mb-1">
                        <div className="flex items-center justify-between">
                          <span 
                            className="font-bold text-gray-900 dark:text-white flex-1"
                            style={{
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                            }}
                          >
                            {formatLegSelection(leg)}
                          </span>
                          <span className="text-gray-600 dark:text-gray-400 ml-2">
                            {formatOdds(leg.odds)}
                          </span>
                          {getLegStatusBadge(leg.status || 'pending')}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                {/* Regular Legs */}
                {groupedLegs.regularLegs.map((leg, index) => (
                  <div key={leg.id || index} className="text-xs mb-1">
                    {leg.game && (
                      <div className="text-gray-600 dark:text-gray-400 mb-0.5" style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                      }}>
                        {leg.game.awayTeamName} @ {leg.game.homeTeamName}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span 
                        className="font-bold text-gray-900 dark:text-white flex-1"
                        style={{
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                        }}
                      >
                        {formatLegSelection(leg)}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400 ml-2">
                        {formatOdds(leg.odds)}
                      </span>
                      {getLegStatusBadge(leg.status || 'pending')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Date and Actions */}
              <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                <p 
                  className="text-xs text-gray-600 dark:text-gray-400 mb-2"
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                  }}
                >
                  Placed: {formatRelativeTime(bet.placedAt)}
                  {bet.settledAt && (
                    <> • Settled: {formatRelativeTime(bet.settledAt)}</>
                  )}
                </p>
                
                {!bet.settledAt && (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSettleStatus('won');
                        setSettleAmount(bet.potentialPayout?.toString() || '');
                        setShowSettleModal(true);
                      }}
                      className="flex-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded border-2 border-red-700 transition-colors"
                      style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        boxShadow: '2px 2px 0px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      SETTLE
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteModal(true);
                      }}
                      className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold rounded border-2 border-gray-700 transition-colors"
                      style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        boxShadow: '2px 2px 0px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      DELETE
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Modals (rendered outside card for proper z-index) */}
      {showCashOutModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border-4 border-red-600 max-w-md w-full p-6"
               style={{
                 boxShadow: '8px 8px 0px rgba(0, 0, 0, 0.3)'
               }}>
            <h3 
              className="text-lg font-bold text-gray-900 dark:text-white mb-4"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                textShadow: '2px 2px 0px rgba(0,0,0,0.2)',
                letterSpacing: '0.05em'
              }}
            >
              CASH OUT BET
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Enter the amount you received for cashing out this bet.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                     style={{
                       fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                     }}>
                CASH OUT AMOUNT ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={cashOutAmount}
                onChange={(e) => setCashOutAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                }}
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
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded border-2 border-gray-700 font-bold transition-colors disabled:opacity-50"
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  boxShadow: '4px 4px 0px rgba(0, 0, 0, 0.3)'
                }}
              >
                CANCEL
              </button>
              <button
                onClick={handleCashOut}
                disabled={isProcessing || !cashOutAmount || parseFloat(cashOutAmount) <= 0}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded border-2 border-red-700 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  boxShadow: '4px 4px 0px rgba(0, 0, 0, 0.3)'
                }}
              >
                {isProcessing ? 'PROCESSING...' : 'CONFIRM'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showDeleteModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border-4 border-red-600 max-w-md w-full p-6"
               style={{
                 boxShadow: '8px 8px 0px rgba(0, 0, 0, 0.3)'
               }}>
            <h3 
              className="text-lg font-bold text-gray-900 dark:text-white mb-4"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                textShadow: '2px 2px 0px rgba(0,0,0,0.2)',
                letterSpacing: '0.05em'
              }}
            >
              DELETE BET
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this bet? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded border-2 border-gray-700 font-bold transition-colors disabled:opacity-50"
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  boxShadow: '4px 4px 0px rgba(0, 0, 0, 0.3)'
                }}
              >
                CANCEL
              </button>
              <button
                onClick={handleDelete}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded border-2 border-red-700 font-bold transition-colors disabled:opacity-50"
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  boxShadow: '4px 4px 0px rgba(0, 0, 0, 0.3)'
                }}
              >
                {isProcessing ? 'DELETING...' : 'DELETE'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showSettleModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border-4 border-red-600 max-w-md w-full p-6"
               style={{
                 boxShadow: '8px 8px 0px rgba(0, 0, 0, 0.3)'
               }}>
            <h3 
              className="text-lg font-bold text-gray-900 dark:text-white mb-4"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                textShadow: '2px 2px 0px rgba(0,0,0,0.2)',
                letterSpacing: '0.05em'
              }}
            >
              SETTLE BET
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Manually settle this bet when games are not tracked automatically.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                     style={{
                       fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                     }}>
                OUTCOME
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    setSettleStatus('won');
                    setSettleAmount(bet.potentialPayout?.toString() || '');
                  }}
                  className={`px-4 py-2 rounded font-bold border-2 transition-colors ${
                    settleStatus === 'won'
                      ? 'bg-green-600 text-white border-green-700'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white border-gray-300 dark:border-gray-700 hover:bg-gray-300 dark:hover:bg-gray-500'
                  }`}
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    boxShadow: settleStatus === 'won' ? '3px 3px 0px rgba(0, 0, 0, 0.3)' : 'none'
                  }}
                >
                  WON
                </button>
                <button
                  onClick={() => {
                    setSettleStatus('lost');
                    setSettleAmount('0');
                  }}
                  className={`px-4 py-2 rounded font-bold border-2 transition-colors ${
                    settleStatus === 'lost'
                      ? 'bg-red-600 text-white border-red-700'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white border-gray-300 dark:border-gray-700 hover:bg-gray-300 dark:hover:bg-gray-500'
                  }`}
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    boxShadow: settleStatus === 'lost' ? '3px 3px 0px rgba(0, 0, 0, 0.3)' : 'none'
                  }}
                >
                  LOST
                </button>
                <button
                  onClick={() => {
                    setSettleStatus('push');
                    setSettleAmount(bet.stake.toString());
                  }}
                  className={`px-4 py-2 rounded font-bold border-2 transition-colors ${
                    settleStatus === 'push'
                      ? 'bg-gray-600 text-white border-gray-700'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white border-gray-300 dark:border-gray-700 hover:bg-gray-300 dark:hover:bg-gray-500'
                  }`}
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    boxShadow: settleStatus === 'push' ? '3px 3px 0px rgba(0, 0, 0, 0.3)' : 'none'
                  }}
                >
                  PUSH
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                     style={{
                       fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                     }}>
                PAYOUT AMOUNT ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                }}
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-0.5">
                <p>Stake: {formatCurrency(Number(bet.stake))}</p>
                <p>Expected payout (if won): {formatCurrency(Number(bet.potentialPayout || 0))}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowSettleModal(false);
                  setSettleAmount('');
                }}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded border-2 border-gray-700 font-bold transition-colors disabled:opacity-50"
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  boxShadow: '4px 4px 0px rgba(0, 0, 0, 0.3)'
                }}
              >
                CANCEL
              </button>
              <button
                onClick={handleSettle}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded border-2 border-red-700 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  boxShadow: '4px 4px 0px rgba(0, 0, 0, 0.3)'
                }}
              >
                {isProcessing ? 'SETTLING...' : 'SETTLE'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
