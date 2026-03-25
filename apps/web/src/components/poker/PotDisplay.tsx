import type { FC } from "react";
import { memo } from "react";

interface PotDisplayProps {
  amount: number;
  label?: string;
  compact?: boolean;
}

/**
 * PotDisplay renders editorial-scale pot amount
 * Mobile: text-5xl, Desktop: text-[6.25rem] (100px)
 * Includes tertiary blur glow and optional label
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

        {/* Amount */}
        <h1
          className={`
            font-headline font-bold text-[--on-surface] tracking-tighter relative
            ${compact ? "text-5xl" : "text-5xl md:text-[6.25rem]"}
            leading-none opacity-80
          `}
          aria-label={`Pot amount: ${amount}`}
        >
          {amount}
        </h1>
      </div>
    </div>
  );
};

export default memo(PotDisplay);
