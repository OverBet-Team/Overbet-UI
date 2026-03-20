"use client";

// OverBet — WinnerToast
// Moon Poker winner announcement overlay.
// Auto-fades after 6 seconds. NO manual "New Hand" button — OverBet auto-starts.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Trophy from "lucide-react/dist/esm/icons/trophy";
import { ChipAmount } from "./ChipAmount";

interface WinnerToastProps {
  winner: string;    // display name of the winner
  pot: number;       // chips won
  handName?: string; // e.g. "Full House", "Straight Flush"
}

export default function WinnerToast({ winner, pot, handName }: WinnerToastProps) {
  const [phase, setPhase] = useState<"hidden" | "in" | "visible" | "out">("hidden");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("in"), 20);
    const t2 = setTimeout(() => setPhase("visible"), 380);
    const t3 = setTimeout(() => setPhase("out"), 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [winner, pot]);

  const isVisible = phase === "in" || phase === "visible";

  return (
    <div
      className="winner-toast fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
      data-testid="winner-toast"
    >
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            className="bg-[--bg-surface] border border-[--gold]/30 rounded-2xl px-6 py-4 shadow-[0_8px_40px_rgba(245,158,11,0.2)] backdrop-blur-md text-center"
          >
            <div className="flex flex-col items-center gap-3">
              {/* Trophy icon */}
              <Trophy size={20} color="var(--gold)" />

              {/* Winner */}
              <div>
                <p className="text-[--text-secondary] text-sm font-body">Hand Winner</p>
                <p className="text-[--gold] font-display font-bold text-lg">{winner}</p>
              </div>

              {/* Pot won */}
              <ChipAmount
                amount={pot}
                prefix={<span className="text-[--gold] text-base font-bold -tracking-[0.01em]">+</span>}
                iconSize={14}
                iconColor="var(--gold)"
                amountStyle={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 600 }}
                suffix={<span className="text-[--text-muted] text-xs font-body">chips</span>}
                style={{ gap: 7 }}
              />

              {/* Hand name — "Won with X" */}
              {handName ? (
                <div
                  data-testid="winner-hand-name"
                  className="flex items-center gap-1.5 bg-[--bg-elevated] border border-[--gold]/35 rounded-lg px-[10px] py-1.5"
                >
                  <span className="text-[--gold] text-[10px] leading-none">♦</span>
                  <span className="text-[--text-primary] font-body text-xs font-semibold tracking-[0.02em] whitespace-nowrap">
                    Won with {handName}
                  </span>
                  <span className="text-[--gold] text-[10px] leading-none">♦</span>
                </div>
              ) : null}

              {/* Auto-start hint */}
              <p className="text-[--text-muted] text-[10px] font-body">
                Next hand starting automatically…
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
