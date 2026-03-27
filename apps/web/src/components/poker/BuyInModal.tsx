import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChipAmount, ChipIcon } from './ChipAmount';
import { BaseModal } from '@/components/ui/Modal';

interface BuyInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (amount: number, displayName: string) => void;
  minAmount: number;
  maxAmount?: number;
  seatIndex: number;
  isGuest: boolean;
  initialDisplayName?: string;
  /** "buyin" (default) = initial seat request; "rebuy" = re-buy after busting */
  mode?: 'buyin' | 'rebuy';
}

export function BuyInModal({
  isOpen,
  onClose,
  onSubmit,
  minAmount,
  maxAmount,
  seatIndex,
  isGuest,
  initialDisplayName = '',
  mode = 'buyin',
}: BuyInModalProps) {
  const [amountStr, setAmountStr] = useState<string>(minAmount.toString());
  const [displayName, setDisplayName] = useState<string>(initialDisplayName);

  useEffect(() => {
    if (isOpen) {
      setAmountStr(minAmount.toString());
      setDisplayName(initialDisplayName);
    }
  }, [initialDisplayName, isOpen, minAmount]);

  const isRebuy = mode === 'rebuy';
  const isUnlimited = maxAmount == null;

  const handleAmountChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    const final = clean.replace(/^0+(?!$)/, '');
    setAmountStr(final);
  };

  const currentAmount = amountStr === '' ? Number.NaN : parseInt(amountStr, 10);
  const isAmountValid =
    !Number.isNaN(currentAmount) &&
    currentAmount >= minAmount &&
    (isUnlimited || currentAmount <= maxAmount!);
  const hasRequiredName = isRebuy || !isGuest || displayName.trim().length > 0;
  const isValid = isAmountValid && hasRequiredName;

  const handleConfirm = () => {
    if (!isValid || Number.isNaN(currentAmount)) return;
    onSubmit(currentAmount, isRebuy ? initialDisplayName : displayName.trim());
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose}>
      <div
        className="relative w-full max-w-[380px] p-7 rounded-2xl pointer-events-auto font-body"
        style={{
          background: 'var(--surface-container-low)',
          border: isRebuy ? '1px solid var(--secondary)/25' : '1px solid var(--outline-variant)',
          boxShadow: isRebuy ? '0 24px 80px rgba(255,109,139,0.15)' : '0 24px 80px rgba(0,0,0,0.7)',
        }}
      >
        {/* Close button */}
        <Dialog.Close asChild>
          <button className="close-btn" aria-label="Close">✕</button>
        </Dialog.Close>

        {/* Header */}
        <div className="mb-6">
          {isRebuy && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full mb-2.5 bg-[--danger]/12 border border-[--danger]/30">
              <span className="text-[9px] font-bold text-[--danger] uppercase tracking-widest">BUSTED</span>
            </div>
          )}
          <Dialog.Title className="text-white text-xl font-extrabold font-display m-0 tracking-tight">
            {isRebuy ? 'Re-buy' : 'Join Table'}
          </Dialog.Title>
          <Dialog.Description className="text-white/35 text-xs mt-1 m-0">
            {isRebuy
              ? `Re-enter at seat ${seatIndex + 1} — awaiting host approval`
              : `Request seat ${seatIndex + 1}`}
          </Dialog.Description>
        </div>

        {/* Form fields */}
        <div className="flex flex-col gap-4">
          {isGuest && !isRebuy && (
            <div>
              <label className="label">Display Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={20}
                className="input-field h-11"
              />
            </div>
          )}

          {isRebuy && initialDisplayName && (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[--primary] flex items-center justify-center text-black text-sm font-bold">
                {initialDisplayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-white text-sm font-bold">{initialDisplayName}</div>
                <div className="text-white/35 text-[11px]">Returning player</div>
              </div>
            </div>
          )}

          <div>
            <label className="label">{isRebuy ? 'Re-buy Amount' : 'Buy-In Amount'}</label>
            <div className="flex items-center gap-2.5 h-12 px-3.5 rounded-xl bg-[--surface-container-lowest] border border-white/10 transition-colors focus-within:border-[--primary]">
              <ChipIcon size={16} color="rgba(255,255,255,0.4)" />
              <input
                type="text"
                inputMode="numeric"
                value={amountStr}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="flex-1 min-w-0 bg-transparent border-none outline-none text-white text-lg font-bold font-mono num-font"
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-white/25 text-[10px] inline-flex items-center">
                Min{' '}
                <ChipAmount
                  amount={minAmount}
                  iconSize={10}
                  amountStyle={{ color: 'inherit', fontSize: 10 }}
                  style={{ gap: 3, marginLeft: 4 }}
                />
              </span>
              <span className="text-white/25 text-[10px] inline-flex items-center">
                Max{' '}
                {isUnlimited ? (
                  'Unlimited'
                ) : (
                  <ChipAmount
                    amount={maxAmount!}
                    iconSize={10}
                    amountStyle={{ color: 'inherit', fontSize: 10 }}
                    style={{ gap: 3, marginLeft: 4 }}
                  />
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 mt-6">
          <button
            data-testid="buyin-cancel-button"
            onClick={onClose}
            className="flex-1 py-3 rounded-[14px] border border-white/10 bg-transparent text-white/40 font-body text-sm font-semibold cursor-pointer hover:bg-white/[0.05] hover:text-white/60 transition-colors"
          >
            Cancel
          </button>
          <button
            data-testid={isRebuy ? 'rebuy-submit-button' : 'seat-request-submit-button'}
            onClick={handleConfirm}
            disabled={!isValid}
            className="flex-[2] py-3 rounded-[14px] border-none font-body text-sm font-bold transition-all"
            style={{
              background: isValid ? (isRebuy ? 'var(--secondary)' : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)') : 'rgba(255,255,255,0.06)',
              color: isValid ? (isRebuy ? '#fff' : '#000') : 'rgba(255,255,255,0.2)',
              cursor: isValid ? 'pointer' : 'not-allowed',
              boxShadow: isValid
                ? isRebuy
                  ? '0 4px 20px rgba(255,109,139,0.25)'
                  : '0 4px 20px rgba(228,215,253,0.25)'
                : 'none',
            }}
          >
            {isRebuy ? 'Request Re-buy' : 'Request Seat'}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
