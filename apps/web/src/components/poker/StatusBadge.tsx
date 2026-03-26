import type { FC } from "react";
import { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  isActive?: boolean;
}

/**
 * StatusBadge displays player status above their avatar with spring animation
 * Per-status colors: called=gold, folded=muted, checked=tertiary, raised=secondary, active=tertiary
 */
const StatusBadge: FC<StatusBadgeProps> = ({ status, isActive = false }) => {
  const normalizedStatus = status.toLowerCase();
  
  // Determine colors based on status
  const statusColors = {
    called: "bg-[--gold]/20 text-[--gold] border-[--gold]/40",
    folded: "bg-white/5 text-[--text-muted] border-white/10",
    checked: "bg-[--tertiary]/15 text-[--tertiary] border-[--tertiary]/30",
    raised: "bg-[--secondary]/20 text-[--secondary] border-[--secondary]/40",
    active: "bg-[--tertiary]/15 text-[--tertiary] border-[--tertiary]/30",
    thinking: "bg-[--tertiary]/15 text-[--tertiary] border-[--tertiary]/30",
  };

  const colorClass = statusColors[normalizedStatus as keyof typeof statusColors] 
    || (isActive 
      ? "bg-[--tertiary]/10 text-[--tertiary] border-[--tertiary]/20"
      : "bg-white/5 text-[--text-muted] border-white/5"
    );

  return (
    <motion.div
      key={status}
      initial={{ opacity: 0, y: 15, scale: 0.5, rotate: -10 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, y: -15, scale: 0.5, rotate: 10 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 15,
        mass: 0.8
      }}
      className={cn(
        "px-3 py-0.5 rounded-full border text-[0.55rem] font-bold uppercase tracking-widest font-headline whitespace-nowrap shadow-lg shadow-black/50",
        colorClass
      )}
      aria-label={`Player status: ${status}`}
    >
      {status}
    </motion.div>
  );
};

export default memo(StatusBadge);
