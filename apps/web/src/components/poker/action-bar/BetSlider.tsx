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
      { label: "1/2 Pot", value: Math.min(Math.max(Math.round(pot * 0.5), min), max) },
      { label: "3/4 Pot", value: Math.min(Math.max(Math.round(pot * 0.75), min), max) },
      { label: "Pot", value: Math.min(Math.max(pot, min), max) },
    ];
  }, [pot, min, max]);

  const clampedValue = Math.min(Math.max(value, min), max);

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className={`glass-panel mx-2 mb-2 p-4 flex flex-col gap-4 rounded-xl border border-white/10 ${disabled ? "opacity-40 saturate-50 pointer-events-none" : ""}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-white/40 text-[10px] font-headline font-bold uppercase tracking-[0.2em]">RAISE TO</span>
          <AnimatePresence mode="wait">
            <motion.div
              key={clampedValue}
              initial={{ y: 5, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -5, opacity: 0 }}
              className="text-xl font-bold text-[--color-tertiary] font-mono"
            >
              {clampedValue.toLocaleString()}
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
          className="w-full accent-[--color-primary] h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
        />

        <div className="grid grid-cols-4 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => onChange(preset.value)}
              className="py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-headline font-bold uppercase tracking-wider hover:bg-white/10 transition-colors"
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={onAllIn}
            className="py-2 rounded-lg bg-[--color-primary]/10 border border-[--color-primary]/30 text-[10px] font-headline font-bold uppercase tracking-wider text-[--color-primary] hover:bg-[--color-primary]/20 transition-colors"
          >
            MAX
          </button>
        </div>

        <button
          onClick={onConfirm}
          disabled={disabled}
          className="w-full py-3 rounded-lg bg-[--color-primary] text-black font-headline font-bold text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(255,100,255,0.3)] hover:brightness-110 active:scale-[0.98] transition-all"
        >
          CONFIRM RAISE
        </button>
      </motion.div>
    );
  }

  // Desktop layout
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`flex items-center gap-6 p-4 glass-panel rounded-2xl border border-white/10 ${disabled ? "opacity-40 saturate-50 pointer-events-none" : ""}`}
    >
      <div className="flex flex-col min-w-[100px]">
        <span className="text-[10px] font-headline font-bold uppercase tracking-[0.2em] text-white/40 mb-1">AMOUNT</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={clampedValue}
            initial={{ y: 5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-2xl font-bold text-[--color-tertiary] font-mono"
          >
            {clampedValue.toLocaleString()}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-3 flex-1">
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-[--color-primary] h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
        />
        
        <div className="flex items-center gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => onChange(preset.value)}
              className="px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-headline font-bold uppercase tracking-wider hover:bg-white/10 transition-colors"
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={onAllIn}
            className="px-4 py-1.5 rounded-lg bg-[--color-primary]/10 border border-[--color-primary]/30 text-[10px] font-headline font-bold uppercase tracking-wider text-[--color-primary] hover:bg-[--color-primary]/20 transition-colors"
          >
            ALL-IN
          </button>
        </div>
      </div>

      <button
        onClick={onConfirm}
        disabled={disabled}
        className="px-8 py-4 rounded-xl bg-[--color-primary] text-black font-headline font-bold text-sm uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(255,100,255,0.4)] hover:brightness-110 active:scale-[0.95] transition-all"
      >
        CONFIRM
      </button>
    </motion.div>
  );
});
