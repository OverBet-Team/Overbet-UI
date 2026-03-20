"use client";

// OverBet — WinnerToast
// Compact single-line pill notification. Auto-fades after 6 s.
// Desktop: anchored bottom-right, slides in from right.
// Mobile (compact): anchored bottom-center, slides up.

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Trophy from "lucide-react/dist/esm/icons/trophy";
import { ChipAmount } from "./ChipAmount";

interface WinnerToastProps {
  winner: string;
  pot: number;
  handName?: string;
  /** When true: bottom-center slide-up (mobile). Default false: bottom-right slide-in. */
  compact?: boolean;
}

// Separated so React.memo identity is stable across hot reloads.
function WinnerToastInner({ winner, pot, handName, compact = false }: WinnerToastProps) {
  const [visible, setVisible] = useState(false);

  // Reset and re-show whenever the winner/pot changes (new hand resolution).
  // Use setTimeout to avoid calling setState synchronously inside the effect body.
  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 0);
    const t2 = setTimeout(() => setVisible(false), 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [winner, pot]);

  const wrapperClass = compact
    ? "fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)]"
    : "fixed bottom-4 right-4 z-50";

  const motionVariants = compact
    ? { initial: { y: 40, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: 40, opacity: 0 } }
    : { initial: { x: 40, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: 40, opacity: 0 } };

  return (
    <div className={wrapperClass} data-testid="winner-toast">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={motionVariants.initial}
            animate={motionVariants.animate}
            exit={motionVariants.exit}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="flex items-center gap-2.5 h-11 px-4 bg-[--bg-surface] border border-[--gold]/30 rounded-full shadow-[0_4px_24px_rgba(245,158,11,0.15)] backdrop-blur-md whitespace-nowrap"
          >
            {/* Trophy marker */}
            <Trophy size={15} color="var(--gold)" aria-hidden="true" />

            {/* Winner name */}
            <span className="text-[--gold] font-bold text-sm font-display">
              {winner}
            </span>

            {/* Pot won — ChipAmount API requires iconColor as a string for SVG; unavoidable inline */}
            <ChipAmount
              amount={pot}
              prefix={<span className="text-[--gold] text-sm font-bold">+</span>}
              iconSize={12}
              iconColor="var(--gold)"
              amountStyle={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 13 }}
              suffix={<span className="text-[--text-secondary] text-xs font-body">chips</span>}
            />

            {/* Hand name badge — omitted when undefined */}
            {handName != null && (
              <span
                data-testid="winner-hand-name"
                className="flex items-center gap-1 text-xs font-body text-[--text-secondary]"
              >
                <span className="text-[--gold] text-[10px] leading-none">♦</span>
                <span>Won with {handName}</span>
                <span className="text-[--gold] text-[10px] leading-none">♦</span>
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const WinnerToast = React.memo(WinnerToastInner);
export default WinnerToast;
