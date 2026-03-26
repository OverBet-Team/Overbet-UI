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
  fold: "text-[--danger] bg-[--surface-container-high] border border-white/10 hover:bg-white/10 focus-visible:ring-[--ring-magenta]",
  check: "text-white/90 bg-[--surface-container-high] border border-white/10 hover:bg-white/10 focus-visible:ring-[--ring-cyan]",
  call: "text-[--tertiary] bg-[--surface-container-high] border border-white/10 hover:bg-white/10 focus-visible:ring-[--ring-cyan]",
  raise: "text-[--tertiary] bg-[--surface-container-high] border border-white/10 hover:bg-white/10 focus-visible:ring-[--ring-cyan]",
  "all-in": "text-[--gold] bg-white/5 border-2 border-[--gold]/40 hover:bg-[--gold]/10 focus-visible:ring-[--gold]",
};

// Mobile compact styles
const COMPACT_VARIANT_STYLES: Record<ActionVariant, string> = {
  fold: "text-[--secondary] bg-[--secondary]/10 hover:bg-[--secondary]/20",
  check: "text-[--on-surface-variant] bg-white/5 hover:text-white hover:bg-white/10",
  call: "text-[--tertiary] bg-[--tertiary]/10 hover:bg-[--tertiary]/20",
  raise: "text-[--tertiary] bg-[--tertiary]/10 hover:bg-[--tertiary]/20",
  "all-in": "text-[--gold] bg-[--gold]/10 hover:bg-[--gold]/20",
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

  if (compact) {
    return (
      <motion.button
        data-testid={testId}
        onClick={onClick}
        disabled={disabled}
        whileTap={{ scale: 0.9 }}
        aria-disabled={disabled}
        className={`
          flex flex-col items-center justify-center gap-1 px-4 py-1 rounded-xl
          transition-all duration-300 cursor-pointer
          focus-visible:ring-2 focus-visible:ring-[--ring-active] focus-visible:ring-offset-2
          ${variantClass}
          ${active ? "bg-[--tertiary]/20 scale-105" : ""}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <div className="w-12 h-12 flex items-center justify-center rounded-xl">
          {icon}
        </div>
        <span className="font-body font-medium text-[10px] tracking-wide">{label}</span>
        {shortcut && (
          <span className="hidden md:inline text-[8px] font-mono opacity-35">{shortcut}</span>
        )}
      </motion.button>
    );
  }

  // Desktop layout
  return (
    <motion.button
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.95 }}
      aria-disabled={disabled}
      className={`
        flex items-center gap-2 px-4 rounded-xl transition-all
        focus-visible:ring-2 focus-visible:ring-offset-1
        ${variantClass}
        ${active ? "ring-1 ring-[--tertiary]/40" : ""}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${variant === "fold" ? "h-[48px]" : "h-[56px] min-w-[140px] justify-center gap-2.5"}
      `}
    >
      {icon}
      <span className={`font-bold uppercase tracking-wide ${variant === "fold" ? "text-sm text-white/70" : "text-sm"}`}>
        {label}
      </span>
    </motion.button>
  );
});
