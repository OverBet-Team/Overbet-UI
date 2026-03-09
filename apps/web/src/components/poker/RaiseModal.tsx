"use client";

import { useState } from "react";

interface RaiseModalProps {
  minRaise: number;
  maxRaise: number;
  currentBet: number;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}

export default function RaiseModal({ minRaise, maxRaise, currentBet, onConfirm, onCancel }: RaiseModalProps) {
  const safeMax = Math.max(minRaise, maxRaise);
  const [amount, setAmount] = useState(Math.min(minRaise * 2, safeMax));

  const presets = [
    { label: "Min", value: minRaise },
    { label: "2x", value: Math.min(minRaise * 2, safeMax) },
    { label: "Pot", value: Math.min(currentBet, safeMax) },
    { label: "All-In", value: safeMax },
  ].filter((p) => p.value >= minRaise);

  const rangePct = safeMax > minRaise ? ((amount - minRaise) / (safeMax - minRaise)) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onCancel}
    >
      <div
        className="relative w-80 rounded-2xl overflow-hidden"
        style={{
          background: "rgba(22, 18, 40, 0.95)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.7)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-3 border-b border-white/5">
          <h3 className="text-white font-bold text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>
            Raise Amount
          </h3>
          <p className="text-white/40 text-xs mt-0.5">Current bet: {currentBet}</p>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="text-center">
            <span className="text-5xl font-bold text-white" style={{ fontFamily: "Outfit, sans-serif" }}>
              {amount}
            </span>
            <div className="flex items-center justify-center gap-1 mt-1 text-white/40 text-xs">
              <ChipStackIcon className="w-3.5 h-3.5" />
              <span>chips</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => setAmount(p.value)}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  amount === p.value
                    ? "bg-purple-600 text-white"
                    : "bg-white/8 text-white/60 hover:bg-white/12 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <input
              type="range"
              min={minRaise}
              max={safeMax}
              step={Math.max(1, Math.floor(minRaise / 2))}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-transparent"
              style={{
                background: `linear-gradient(to right, #7c3aed ${rangePct}%, rgba(255,255,255,0.1) 0%)`,
              }}
            />
            <div className="flex justify-between text-white/30 text-xs">
              <span>{minRaise}</span>
              <span>{safeMax}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAmount(Math.max(minRaise, amount - Math.max(1, Math.floor(minRaise / 2))))}
              className="flex-1 py-2 rounded-xl bg-white/8 text-white/70 font-bold text-lg hover:bg-white/12 transition-all"
            >
              −
            </button>
            <button
              onClick={() => setAmount(Math.min(safeMax, amount + Math.max(1, Math.floor(minRaise / 2))))}
              className="flex-1 py-2 rounded-xl bg-white/8 text-white/70 font-bold text-lg hover:bg-white/12 transition-all"
            >
              +
            </button>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl text-white/60 font-semibold text-sm hover:bg-white/8 transition-all border border-white/8"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(amount)}
              className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all"
              style={{ boxShadow: "0 4px 20px rgba(16, 185, 129, 0.3)" }}
            >
              Raise {amount}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChipStackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <ellipse cx="8" cy="12" rx="6" ry="2.5" opacity="0.6" />
      <ellipse cx="8" cy="9.5" rx="6" ry="2.5" opacity="0.8" />
      <ellipse cx="8" cy="7" rx="6" ry="2.5" />
    </svg>
  );
}
