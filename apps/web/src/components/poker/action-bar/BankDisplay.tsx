"use client";

import React, { useState, useEffect } from "react";
import { Coins } from "lucide-react";
import type { TurnTimer } from "./types";

interface BankDisplayProps {
  amount: number;
  className?: string;
  timer?: TurnTimer | null;
}

export const BankDisplay = React.memo(function BankDisplay({
  amount,
  className = "",
  timer,
}: BankDisplayProps) {
  const [timeLeft, setTimeLeft] = useState(() => 
    timer ? Math.max(0, timer.expiresAt - Date.now()) : 0
  );

  useEffect(() => {
    if (!timer) return;
    const iv = setInterval(() => {
      setTimeLeft(Math.max(0, timer.expiresAt - Date.now()));
    }, 100);
    return () => clearInterval(iv);
  }, [timer]);

  const secs = Math.ceil(timeLeft / 1000);
  const progress = timer && timer.total > 0 ? timeLeft / timer.total : 0;
  
  // Timer ring dimensions
  const size = 56;
  const strokeWidth = 3.5;
  const radius = size / 2 - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);
  
  // Color transitions: <20% red, 20-50% amber, >50% cyan
  const timerColor = progress < 0.2 
    ? "var(--danger)" 
    : progress < 0.5 
    ? "var(--gold)" 
    : "var(--tertiary)";

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Time Bank: Radial SVG Timer */}
      {timer && (
        <div 
          className={`relative shrink-0 ${progress < 0.2 ? 'animate-pulse' : ''}`}
          style={{ width: size, height: size }}
        >
          <svg 
            className="-rotate-90" 
            width={size} 
            height={size} 
            viewBox={`0 0 ${size} ${size}`}
            role="timer"
            aria-label={`Time bank: ${secs} seconds remaining`}
          >
            <circle 
              cx={size / 2} 
              cy={size / 2} 
              r={radius} 
              fill="none" 
              stroke="rgba(255,255,255,0.05)" 
              strokeWidth={strokeWidth} 
            />
            <circle 
              cx={size / 2} 
              cy={size / 2} 
              r={radius} 
              fill="none" 
              stroke={timerColor} 
              strokeWidth={strokeWidth}
              strokeDasharray={circumference} 
              strokeDashoffset={offset}
              strokeLinecap="round" 
              style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s ease" }} 
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-white tabular-nums font-mono leading-none">
              {secs}
            </span>
          </div>
        </div>
      )}
      
      {/* Financial: Bank Balance */}
      <div className="flex flex-col">
        <span className="text-[10px] font-headline font-bold uppercase tracking-[0.2em] text-white/40 mb-1">
          BANK
        </span>
        <div 
          className="flex items-center gap-2"
          aria-label={`Your bank: ${amount} chips`}
        >
          <div className="w-2 h-2 rounded-full bg-[--color-tertiary] shadow-[0_0_8px_rgba(129,236,255,0.5)]" />
          <span className="text-2xl font-bold text-white tabular-nums font-mono">
            {amount.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
});
