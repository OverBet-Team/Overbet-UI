import type { FC } from "react";
import { memo } from "react";

interface StatusBadgeProps {
  status: string;
  isActive?: boolean;
}

/**
 * StatusBadge displays player status above their avatar
 * Examples: "CALLED", "FOLDED", "THINKING", "RAISED"
 * Active players get accent color, others get muted
 */
const StatusBadge: FC<StatusBadgeProps> = ({ status, isActive = false }) => {
  return (
    <div
      className={`
        px-3 py-0.5 rounded-full text-[0.55rem] font-bold uppercase tracking-widest font-headline
        ${
          isActive
            ? "bg-[--tertiary]/10 text-[--tertiary] border border-[--tertiary]/20"
            : "bg-white/5 text-[--on-surface-variant]/40 border border-white/5"
        }
      `}
      aria-label={`Player status: ${status}`}
    >
      {status}
    </div>
  );
};

export default memo(StatusBadge);
