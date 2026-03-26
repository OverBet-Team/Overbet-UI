"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChipAmount } from "../ChipAmount";

interface BetSliderProps {
  value: number;
  min: number;
  max: number;
  pot: number;
  onChange: (value: number) => void;
  onConfirm: () => void;
  onAllIn: () => void;
  compact?: boolean;
  disabled?: boolean;
}

interface Preset {
  label: string;
  value: number;
}

export const BetSlider = React.memo(function BetSlider({
  value,
  min,
  max,
  pot,
  onChange,
  onConfirm,
  onAllIn,
  compact = false,
  disabled = false,
}: BetSliderProps) {
  // Compute presets - memoized to avoid recalculation on every render
  const presets = useMemo<Preset[]>(() => {
    if (pot <= 0) return [];
    
    return [
      { label: "½ Pot", value: Math.min(Math.max(Math.round(pot * 0.5), min), max) },
      { label: "Pot", value: Math.min(Math.max(pot, min), max) },
      { label: "2× Pot", value: Math.min(Math.max(pot * 2, min), max) },
    ];
  }, [pot, min, max]);

  const clampedValue = Math.min(Math.max(value, min), max);

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className={`glass-panel mx-2 mb-2 p-4 flex flex-col gap-3 rounded-xl transition-all duration-300 ${disabled ? "opacity-40 saturate-50 pointer-events-none" : ""}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-white/40 text-xs uppercase tracking-wider">Raise To</span>
          <AnimatePresence mode="wait">
            <motion.div
              key={clampedValue}
              initial={{ scale: 1.1, color: "var(--tertiary)" }}
              animate={{ scale: 1, color: "var(--tertiary)" }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <ChipAmount
                amount={clampedValue}
                iconSize={14}
                amountStyle={{ color: "var(--tertiary)", fontSize: 18, fontWeight: 700 }}
              />
            </motion.div>
          </AnimatePresence>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Bet amount"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={clampedValue}
          aria-valuetext={`${clampedValue} chips`}
          className="w-full"
        />
        {presets.length > 0 && (
          <div className="flex gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => onChange(preset.value)}
                aria-label={`Bet ${preset.label.toLowerCase()}`}
                className="flex-1 py-1.5 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 text-xs font-semibold hover:bg-white/10 hover:border-white/15 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={onConfirm}
          disabled={disabled}
          className="w-full py-3 rounded-lg bg-[--tertiary] text-black font-extrabold text-base shadow-[0_0_12px_rgba(129,236,255,0.3)] hover:shadow-[0_0_20px_rgba(129,236,255,0.5)] active:scale-95 transition-all"
        >
          Raise to {clampedValue}
        </button>
      </motion.div>
    );
  }

  // Desktop layout
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className={`flex items-center gap-3 shrink-0 transition-all duration-300 ${disabled ? "opacity-40 saturate-50 pointer-events-none" : ""}`}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">Amount</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={clampedValue}
            initial={{ scale: 1.15, color: "var(--gold)" }}
            animate={{ scale: 1, color: "var(--tertiary)" }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="text-2xl font-bold tabular-nums"
          >
            {clampedValue}
          </motion.span>
        </AnimatePresence>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Bet amount"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clampedValue}
        aria-valuetext={`${clampedValue} chips`}
        className="bet-slider w-28"
      />
      {presets.length > 0 && (
        <div className="flex items-center gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => onChange(preset.value)}
              aria-label={`Bet ${preset.label.toLowerCase()}`}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase hover:bg-white/10 hover:border-white/15 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={onAllIn}
        disabled={disabled}
        aria-label="Go all-in"
        className="bg-white/5 border-2 border-[--gold]/40 rounded-lg px-4 py-1.5 text-[10px] font-bold uppercase text-[--gold] hover:bg-[--gold]/10 transition-colors"
      >
        All-In
      </button>
      <button
        onClick={onConfirm}
        disabled={disabled}
        className="bg-[--tertiary] text-black font-extrabold rounded-lg px-5 py-2.5 text-base shadow-[0_0_12px_rgba(129,236,255,0.3)] hover:shadow-[0_0_20px_rgba(129,236,255,0.5)] active:scale-95 whitespace-nowrap transition-all"
      >
        Confirm ↵
      </button>
    </motion.div>
  );
});
