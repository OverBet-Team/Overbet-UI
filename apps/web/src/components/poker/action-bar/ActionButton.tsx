"use client";

import React from "react";
import { motion } from "framer-motion";
import type { ActionVariant } from "./types";

interface ActionButtonProps {
  variant: ActionVariant;
  label: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  active?: boolean;
  compact?: boolean;
  onClick: () => void;
  testId?: string;
  icon?: React.ReactNode;
}

// Desktop button styles
const VARIANT_STYLES: Record<ActionVariant, string> = {
  fold: "text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20",
  check: "text-[--color-tertiary] bg-[--color-tertiary]/10 border border-[--color-tertiary]/30 hover:bg-[--color-tertiary]/20",
  call: "text-[--color-tertiary] bg-[--color-tertiary]/10 border border-[--color-tertiary]/30 hover:bg-[--color-tertiary]/20",
  raise: "text-[--color-primary] bg-[--color-primary]/10 border border-[--color-primary]/30 hover:bg-[--color-primary]/20",
  "all-in": "text-[--color-primary] bg-[--color-primary]/20 border-2 border-[--color-primary]/50 hover:bg-[--color-primary]/30 shadow-[0_0_20px_rgba(255,100,255,0.2)]",
};

// Mobile compact styles
const COMPACT_VARIANT_STYLES: Record<ActionVariant, string> = {
  fold: "text-white/60 bg-white/5 border border-white/10",
  check: "text-[--color-tertiary] bg-[--color-tertiary]/10 border border-[--color-tertiary]/30",
  call: "text-[--color-tertiary] bg-[--color-tertiary]/10 border border-[--color-tertiary]/30",
  raise: "text-[--color-primary] bg-[--color-primary]/10 border border-[--color-primary]/30",
  "all-in": "text-[--color-primary] bg-[--color-primary]/20 border-2 border-[--color-primary]/50",
};

export const ActionButton = React.memo(function ActionButton({
  variant,
  label,
  shortcut,
  disabled = false,
  active = false,
  compact = false,
  onClick,
  testId,
  icon,
}: ActionButtonProps) {
  const variantClass = compact ? COMPACT_VARIANT_STYLES[variant] : VARIANT_STYLES[variant];

  return (
    <motion.button
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      whileHover={disabled ? undefined : { y: -2 }}
      className={`
        relative flex flex-col items-center justify-center rounded-xl transition-all duration-300
        font-headline font-bold uppercase tracking-[0.15em]
        ${compact ? "px-4 py-3 text-[10px] min-w-[80px]" : "px-8 py-4 text-xs min-w-[140px]"}
        ${variantClass}
        ${active ? "brightness-125 ring-2 ring-white/20" : ""}
        ${disabled ? "opacity-20 grayscale pointer-events-none" : "cursor-pointer"}
      `}
    >
      {icon && <div className={`${compact ? "mb-1" : "mb-1.5"}`}>{icon}</div>}
      <span>{label}</span>
      {shortcut && !compact && (
        <span className="absolute top-1 right-2 text-[8px] font-mono opacity-30">{shortcut}</span>
      )}
    </motion.button>
  );
});
