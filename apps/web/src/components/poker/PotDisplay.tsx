import type { FC } from "react";
import { memo } from "react";
import { motion } from "framer-motion";

interface PotDisplayProps {
  amount: number;
  label?: string;
  compact?: boolean;
}

/**
 * PotDisplay renders editorial-scale pot amount with motion scale animation
 * Mobile: text-5xl, Desktop: text-[6.25rem] (100px)
 * Includes tertiary blur glow and spring scale on change
 */
const PotDisplay: FC<PotDisplayProps> = ({
  amount,
  label = "TOTAL POT",
  compact = false,
}) => {
  return (
    <div className="text-center">
      {/* Label */}
      <div className="flex items-center justify-center gap-1.5 mb-1 opacity-40">
        <span className="material-symbols-outlined text-[12px]">toll</span>
        <p className="text-[0.55rem] uppercase tracking-[0.3em] font-headline font-bold">
          {label}
        </p>
      </div>

      {/* Amount with glow */}
      <div className="relative">
        {/* Background glow */}
        <div className="absolute inset-0 blur-2xl bg-[--tertiary]/10 rounded-full" />

        {/* Amount with motion scale */}
        <motion.h1
          key={amount}
          initial={{ scale: 1.15, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 0.8 }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 20,
            duration: 0.4
          }}
          className={`
            font-headline font-bold text-[--on-surface] tracking-tighter relative
            ${compact ? "text-5xl" : "text-5xl md:text-[6.25rem]"}
            leading-none
          `}
          aria-label={`Pot amount: ${amount}`}
        >
          {amount}
        </motion.h1>
      </div>
    </div>
  );
};

export default memo(PotDisplay);
