import type { FC } from "react";
import { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChipIcon } from "./ChipAmount";

interface PotDisplayProps {
  amount: number;
  label?: string;
  compact?: boolean;
}

/**
 * PotDisplay renders editorial-scale pot amount with motion scale animation
 */
const PotDisplay: FC<PotDisplayProps> = ({
  amount,
  label = "TOTAL POT",
  compact = false,
}) => {
  return (
    <div className="flex flex-col items-center gap-2">
      {/* Glass Panel Container */}
      <div className={cn(
        "glass-panel px-6 py-3 flex flex-col items-center gap-1 min-w-[160px]",
        compact ? "px-4 py-2 min-w-[120px]" : ""
      )}>
        {/* Label */}
        <div className="flex items-center gap-1.5 opacity-40">
          <ChipIcon size={10} color="var(--tertiary)" />
          <p className="text-[9px] uppercase tracking-[0.2em] font-black font-headline">
            {label}
          </p>
        </div>

        {/* Amount with motion scale */}
        <motion.div
          key={amount}
          initial={{ scale: 1.1, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            type: "spring", 
            stiffness: 400, 
            damping: 25
          }}
          className={cn(
            "font-headline font-black text-[--on-surface] tracking-tighter leading-none",
            compact ? "text-3xl" : "text-4xl md:text-5xl"
          )}
          aria-label={`Pot amount: ${amount}`}
        >
          {amount.toLocaleString()}
        </motion.div>
      </div>

      {/* Subtle Glow Underneath */}
      <div className="w-24 h-1 bg-[--tertiary]/20 blur-md rounded-full" />
    </div>
  );
};

export default memo(PotDisplay);
