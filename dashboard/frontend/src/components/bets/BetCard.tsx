import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Bet } from '../../types/game.types';
import { formatCurrency, formatOdds, formatRelativeTime } from '../../utils/format';
import { useDarkMode } from '../../contexts/DarkModeContext';
import api from '../../services/api';

interface BetCardProps {
  bet: Bet;
}

type LegLikeStatus = 'pending' | 'won' | 'lost' | 'push';

export default function BetCard({ bet }: BetCardProps) {
  const { isDarkMode } = useDarkMode();
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [cashOutAmount, setCashOutAmount] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleStatus, setSettleStatus] = useState<'won' | 'lost' | 'push'>('won');
  const [settleAmount, setSettleAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

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

  // Status-keyed palette shared by the stub column, stamp and leg dots
  const STATUS_META: Record<string, { stub: string; stamp: string; dot: string }> = {
    won: { stub: 'bg-sunwin-light', stamp: 'border-sunwin-light text-sunwin-light', dot: 'bg-sunwin-light' },
    lost: { stub: 'bg-sunloss-light', stamp: 'border-sunloss-light text-sunloss-light', dot: 'bg-sunloss-light' },
    pending: { stub: 'bg-sunpending', stamp: 'border-sunpending text-sunpending', dot: 'bg-sunpending' },
    push: { stub: 'bg-sand-shadow', stamp: 'border-ink-muted text-ink-muted', dot: 'bg-sand-shadow' },
    cancelled: { stub: 'bg-sand-shadow', stamp: 'border-ink-muted text-ink-muted', dot: 'bg-sand-shadow' }
  };

  const statusMeta = STATUS_META[bet.status] || STATUS_META.pending;

  // Ticket-stub vertical label: bet type + leg count, from real data
  const stubLabel = bet.legs.length > 1
    ? `${bet.betType.toUpperCase()} · ${bet.legs.length} LEG`
    : bet.betType.toUpperCase();

  // Payout figure + color, from real settled/potential payout fields
  const payoutValue = bet.status === 'pending'
    ? Number(bet.potentialPayout || 0)
    : Number(bet.actualPayout ?? 0);

  const payoutColorClass =
    bet.status === 'won' ? 'text-sunwin-light' :
    bet.status === 'lost' ? 'text-sunloss-light' :
    bet.status === 'pending' ? 'text-gold' :
    'text-ink-muted';

  const actionBtnClass = isDarkMode
    ? 'flex-1 font-display text-[7px] tracking-[.08em] px-2 py-1.5 bg-dusk-panel2 text-cream-muted hover:bg-ember hover:text-cream transition-colors'
    : 'flex-1 font-display text-[7px] tracking-[.08em] px-2 py-1.5 bg-sand-panel2 text-ink-secondary border-2 border-ink hover:bg-terra hover:text-terra-text transition-colors';

  return (
    <>
      <div
        className="ds-sand-bg flex"
        style={
          isDarkMode
            ? { boxShadow: '0 8px 0 #120a22' }
            : { border: '3px solid #3a2413', boxShadow: '6px 6px 0 #d8c19a' }
        }
      >
        {/* Left stub column */}
        <div
          className={`flex-shrink-0 flex flex-col items-center justify-center gap-2.5 py-3 ${statusMeta.stub}`}
          style={{ width: '78px', borderRight: '3px dashed #b39a72' }}
        >
          <span
            className="font-display text-[7px] tracking-[.18em] text-terra-text"
            style={{ writingMode: 'vertical-rl' }}
          >
            {stubLabel}
          </span>
        </div>

        {/* Stamp column */}
        <div className="flex-shrink-0 flex items-center justify-center" style={{ width: '92px' }}>
          <span
            className={`font-display text-[8px] tracking-[.1em] border-[3px] px-2.5 py-1.5 rotate-[9deg] ${statusMeta.stamp} ${
              bet.status === 'pending' ? 'animate-ds-blink-slow' : ''
            }`}
          >
            {bet.status.toUpperCase()}
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0" style={{ padding: '14px 16px' }}>
          <p className="font-display text-[6.5px] text-ink-muted tracking-[.1em]">
            PLACED {formatRelativeTime(bet.placedAt).toUpperCase()}
            {bet.settledAt && <> &middot; SETTLED {formatRelativeTime(bet.settledAt).toUpperCase()}</>}
          </p>

          <div className="flex flex-col gap-2.5 mt-2.5">
            {bet.legs.map((leg, idx) => {
              const legStatus: LegLikeStatus = (leg.status as LegLikeStatus) || 'pending';
              const legDot = STATUS_META[legStatus]?.dot || STATUS_META.pending.dot;
              return (
                <div key={leg.id || idx} className="flex items-center gap-2">
                  <span className={`w-[9px] h-[9px] rounded-full flex-shrink-0 ${legDot}`} />
                  <div className="min-w-0">
                    <div className="font-body text-[13.5px] font-bold text-ink truncate">
                      {formatLegSelection(leg)}
                      {leg.sgpGroupId && <span className="ml-1 text-ember">&#9889;</span>}
                    </div>
                    {leg.game && (
                      <div className="font-body text-[11.5px] text-ink-muted truncate">
                        {leg.game.awayTeamName} @ {leg.game.homeTeamName}
                      </div>
                    )}
                  </div>
                  <span className="ml-auto font-display text-[8px] text-ink-secondary flex-shrink-0">
                    {formatOdds(leg.odds)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 mt-3 pt-2.5" style={{ borderTop: '2px dotted #b39a72' }}>
            <div className="ds-barcode flex-1 h-4" />
            <span className="font-body text-[12px] text-ink-muted whitespace-nowrap">
              {formatCurrency(bet.stake)} stake
            </span>
            <span className={`font-display text-[10px] whitespace-nowrap ${payoutColorClass}`}>
              {formatCurrency(payoutValue)}
            </span>
          </div>

          {!bet.settledAt && (
            <div className="flex gap-2 mt-2.5">
              <button
                onClick={() => {
                  setSettleStatus('won');
                  setSettleAmount(bet.potentialPayout?.toString() || '');
                  setShowSettleModal(true);
                }}
                className={actionBtnClass}
              >
                SETTLE
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className={actionBtnClass}
              >
                DELETE
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modals (rendered outside card for proper z-index) */}
      {showCashOutModal && createPortal(
        <div className="fixed inset-0 bg-dusk-shadow/70 flex items-center justify-center z-50 p-4">
          <div className={`${isDarkMode ? 'ds-panel' : 'ds-card-ink'} max-w-md w-full p-6`}>
            <h3 className={`font-display text-[13px] tracking-[.06em] mb-4 ${isDarkMode ? 'text-cream' : 'text-ink'}`}>
              CASH OUT BET
            </h3>
            <p className={`font-body text-sm mb-4 ${isDarkMode ? 'text-cream-secondary' : 'text-ink-secondary'}`}>
              Enter the amount you received for cashing out this bet.
            </p>
            <div className="mb-4">
              <label className={`block font-display text-[7px] tracking-[.08em] mb-2 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
                CASH OUT AMOUNT ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={cashOutAmount}
                onChange={(e) => setCashOutAmount(e.target.value)}
                placeholder="0.00"
                className={`w-full px-4 py-2 font-body focus:outline-none ${
                  isDarkMode
                    ? 'bg-dusk-panel2 text-cream border-2 border-dusk-panel2 focus:border-gold'
                    : 'bg-sand-panel2 text-ink border-2 border-ink focus:border-terra'
                }`}
                autoFocus
              />
              <p className={`font-body text-xs mt-1 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
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
                className={`flex-1 px-4 py-2 font-display text-[9px] tracking-[.06em] disabled:opacity-50 ${
                  isDarkMode ? 'bg-dusk-panel2 text-cream-muted' : 'bg-sand-panel2 text-ink-secondary border-2 border-ink'
                }`}
              >
                CANCEL
              </button>
              <button
                onClick={handleCashOut}
                disabled={isProcessing || !cashOutAmount || parseFloat(cashOutAmount) <= 0}
                className={`flex-1 px-4 py-2 font-display text-[9px] tracking-[.06em] disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDarkMode ? 'ds-btn-press' : 'ds-btn-press-light'
                }`}
              >
                {isProcessing ? 'PROCESSING...' : 'CONFIRM'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showDeleteModal && createPortal(
        <div className="fixed inset-0 bg-dusk-shadow/70 flex items-center justify-center z-50 p-4">
          <div className={`${isDarkMode ? 'ds-panel' : 'ds-card-ink'} max-w-md w-full p-6`}>
            <h3 className={`font-display text-[13px] tracking-[.06em] mb-4 ${isDarkMode ? 'text-cream' : 'text-ink'}`}>
              DELETE BET
            </h3>
            <p className={`font-body text-sm mb-6 ${isDarkMode ? 'text-cream-secondary' : 'text-ink-secondary'}`}>
              Are you sure you want to delete this bet? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isProcessing}
                className={`flex-1 px-4 py-2 font-display text-[9px] tracking-[.06em] disabled:opacity-50 ${
                  isDarkMode ? 'bg-dusk-panel2 text-cream-muted' : 'bg-sand-panel2 text-ink-secondary border-2 border-ink'
                }`}
              >
                CANCEL
              </button>
              <button
                onClick={handleDelete}
                disabled={isProcessing}
                className={`flex-1 px-4 py-2 font-display text-[9px] tracking-[.06em] disabled:opacity-50 ${
                  isDarkMode ? 'ds-btn-press' : 'ds-btn-press-light'
                }`}
                style={isDarkMode ? { backgroundColor: '#ef5350', color: '#fdf3df', boxShadow: '0 4px 0 #8a2e2b' } : undefined}
              >
                {isProcessing ? 'DELETING...' : 'DELETE'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showSettleModal && createPortal(
        <div className="fixed inset-0 bg-dusk-shadow/70 flex items-center justify-center z-50 p-4">
          <div className={`${isDarkMode ? 'ds-panel' : 'ds-card-ink'} max-w-md w-full p-6`}>
            <h3 className={`font-display text-[13px] tracking-[.06em] mb-4 ${isDarkMode ? 'text-cream' : 'text-ink'}`}>
              SETTLE BET
            </h3>
            <p className={`font-body text-sm mb-4 ${isDarkMode ? 'text-cream-secondary' : 'text-ink-secondary'}`}>
              Manually settle this bet when games are not tracked automatically.
            </p>

            <div className="mb-4">
              <label className={`block font-display text-[7px] tracking-[.08em] mb-2 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
                OUTCOME
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    setSettleStatus('won');
                    setSettleAmount(bet.potentialPayout?.toString() || '');
                  }}
                  className={`px-4 py-2 font-display text-[9px] tracking-[.06em] transition-colors ${
                    settleStatus === 'won'
                      ? 'bg-sunwin-light text-terra-text'
                      : isDarkMode ? 'bg-dusk-panel2 text-cream-muted' : 'bg-sand-panel2 text-ink-secondary border-2 border-ink'
                  }`}
                >
                  WON
                </button>
                <button
                  onClick={() => {
                    setSettleStatus('lost');
                    setSettleAmount('0');
                  }}
                  className={`px-4 py-2 font-display text-[9px] tracking-[.06em] transition-colors ${
                    settleStatus === 'lost'
                      ? 'bg-sunloss-light text-terra-text'
                      : isDarkMode ? 'bg-dusk-panel2 text-cream-muted' : 'bg-sand-panel2 text-ink-secondary border-2 border-ink'
                  }`}
                >
                  LOST
                </button>
                <button
                  onClick={() => {
                    setSettleStatus('push');
                    setSettleAmount(bet.stake.toString());
                  }}
                  className={`px-4 py-2 font-display text-[9px] tracking-[.06em] transition-colors ${
                    settleStatus === 'push'
                      ? 'bg-sand-shadow text-ink'
                      : isDarkMode ? 'bg-dusk-panel2 text-cream-muted' : 'bg-sand-panel2 text-ink-secondary border-2 border-ink'
                  }`}
                >
                  PUSH
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className={`block font-display text-[7px] tracking-[.08em] mb-2 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
                PAYOUT AMOUNT ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                placeholder="0.00"
                className={`w-full px-4 py-2 font-body focus:outline-none ${
                  isDarkMode
                    ? 'bg-dusk-panel2 text-cream border-2 border-dusk-panel2 focus:border-gold'
                    : 'bg-sand-panel2 text-ink border-2 border-ink focus:border-terra'
                }`}
              />
              <div className={`font-body text-xs mt-1 space-y-0.5 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
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
                className={`flex-1 px-4 py-2 font-display text-[9px] tracking-[.06em] disabled:opacity-50 ${
                  isDarkMode ? 'bg-dusk-panel2 text-cream-muted' : 'bg-sand-panel2 text-ink-secondary border-2 border-ink'
                }`}
              >
                CANCEL
              </button>
              <button
                onClick={handleSettle}
                disabled={isProcessing}
                className={`flex-1 px-4 py-2 font-display text-[9px] tracking-[.06em] disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDarkMode ? 'ds-btn-press' : 'ds-btn-press-light'
                }`}
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
