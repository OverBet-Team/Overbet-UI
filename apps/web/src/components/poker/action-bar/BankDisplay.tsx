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
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Timer Ring */}
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
            aria-label={`Turn timer: ${secs} seconds remaining`}
          >
            <circle 
              cx={size / 2} 
              cy={size / 2} 
              r={radius} 
              fill="none" 
              stroke="rgba(255,255,255,0.08)" 
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
              style={{ transition: "stroke 0.2s" }} 
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-base font-extrabold text-white tabular-nums drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {secs}
          </span>
        </div>
      )}
      
      {/* Bank Amount */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">
          YOUR BANK
        </span>
        <div 
          className="flex items-center gap-1.5"
          aria-label={`Your bank: ${amount} chips`}
        >
          <Coins size={14} className="text-[--gold]" />
          <span className="text-2xl font-bold text-[--on-surface] tabular-nums font-headline">
            {amount}
          </span>
        </div>
      </div>
    </div>
  );
});
