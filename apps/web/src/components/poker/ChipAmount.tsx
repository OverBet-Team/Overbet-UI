import React from 'react';
import { motion } from 'framer-motion';

export function formatChipAmount(amount: number) {
  return amount.toLocaleString();
}

export function ChipIcon({
  size = 12,
  color = 'var(--on-surface-variant)',
  style,
}: {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, ...style }}>
      <circle cx="10" cy="10" r="8" stroke={color} strokeWidth="1.5" />
      <circle cx="10" cy="10" r="5" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      <circle cx="10" cy="10" r="2" fill={color} />
    </svg>
  );
}

export function ChipAmount({
  amount,
  prefix,
  suffix,
  iconSize = 12,
  iconColor,
  gap = 4,
  style,
  amountStyle,
}: {
  amount: number | string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  iconSize?: number;
  iconColor?: string;
  gap?: number;
  style?: React.CSSProperties;
  amountStyle?: React.CSSProperties;
}) {
  const amountText = typeof amount === 'number' ? formatChipAmount(amount) : amount;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      {prefix}
      <ChipIcon size={iconSize} color={iconColor} />
      <span style={amountStyle}>{amountText}</span>
      {suffix}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ChipStack — Overlapping chip circles with color tiers
// ═══════════════════════════════════════════════════════════════════════════

interface ChipStackProps {
  amount: number;
  /** layoutId for Motion shared layout animations (seat→pot) */
  layoutId?: string;
  className?: string;
  style?: React.CSSProperties;
}

// Chip color tiers based on amount
function getChipColor(amount: number): string {
  if (amount >= 500) return 'bg-violet-600'; // Purple
  if (amount >= 100) return 'bg-slate-800 ring-1 ring-white'; // Black with white ring
  if (amount >= 25) return 'bg-green-500'; // Green
  if (amount >= 5) return 'bg-red-500'; // Red
  return 'bg-slate-200'; // White (1-4)
}

export function ChipStack({ amount, layoutId, className, style }: ChipStackProps) {
  // Calculate how many chips to show (max 5)
  const chipCount = Math.min(5, Math.max(1, Math.ceil(amount / 100)));
  const overflow = amount > 500 ? `+${Math.floor((amount - 500) / 100)}` : null;

  const chipColor = getChipColor(amount);

  return (
    <motion.div
      layoutId={layoutId}
      className={`inline-flex flex-col items-center gap-1 ${className || ''}`}
      style={style}
    >
      {/* Overlapping chip stack */}
      <div className="relative flex flex-col-reverse" style={{ height: chipCount * 6 + 16 }}>
        {Array.from({ length: chipCount }).map((_, i) => (
          <div
            key={i}
            className={`absolute w-8 h-8 rounded-full ${chipColor} shadow-md`}
            style={{
              bottom: i * 6,
              left: 0,
            }}
          />
        ))}
        {/* Overflow label */}
        {overflow && (
          <div className="absolute -top-1 -right-2 bg-[--bg-elevated] text-[--text-primary] text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-white/10">
            {overflow}
          </div>
        )}
      </div>

      {/* Amount label below */}
      <div className="text-xs font-semibold text-[--text-secondary] num-font">{formatChipAmount(amount)}</div>
    </motion.div>
  );
}
