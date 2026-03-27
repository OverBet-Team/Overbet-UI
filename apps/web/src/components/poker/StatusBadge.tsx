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
    called: "bg-[--gold]/10 text-[--gold] border-[--gold]/20",
    folded: "bg-[--danger]/10 text-[--danger] border-[--danger]/20",
    checked: "bg-[--tertiary]/10 text-[--tertiary] border-[--tertiary]/20",
    raised: "bg-[--secondary]/10 text-[--secondary] border-[--secondary]/20",
    active: "bg-[--tertiary]/10 text-[--tertiary] border-[--tertiary]/20",
    thinking: "bg-[--tertiary]/10 text-[--tertiary] border-[--tertiary]/20 animate-pulse",
  };

  const colorClass = statusColors[normalizedStatus as keyof typeof statusColors] 
    || (isActive 
      ? "bg-[--tertiary]/10 text-[--tertiary] border-[--tertiary]/20"
      : "bg-white/5 text-[--text-muted] border-white/5"
    );

  return (
    <motion.div
      key={status}
      initial={{ opacity: 0, y: 10, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.8 }}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 30,
        mass: 1
      }}
      className={cn(
        "px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-[0.12em] font-headline whitespace-nowrap shadow-xl backdrop-blur-md",
        colorClass
      )}
      aria-label={`Player status: ${status}`}
    >
      {status}
    </motion.div>
  );
};

export default memo(StatusBadge);
