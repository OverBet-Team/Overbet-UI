"use client";

import React, { useState, useEffect } from "react";
import type { TurnTimer } from "./types";

interface TimerRingProps {
  timer: TurnTimer;
  size?: number;
  strokeWidth?: number;
}

export const TimerRing = React.memo(function TimerRing({
  timer,
  size = 40,
  strokeWidth = 2.5,
}: TimerRingProps) {
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, timer.expiresAt - Date.now()));

  useEffect(() => {
    const iv = setInterval(() => {
      setTimeLeft(Math.max(0, timer.expiresAt - Date.now()));
    }, 100);
    return () => clearInterval(iv);
  }, [timer.expiresAt]);

  const secs = Math.ceil(timeLeft / 1000);
  const progress = timer.total > 0 ? timeLeft / timer.total : 0;
  const radius = size / 2 - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);
  
  // Color transitions: <20% red, 20-50% amber, >50% cyan
  const color = progress < 0.2 
    ? "var(--danger)" 
    : progress < 0.5 
    ? "var(--gold)" 
    : "var(--tertiary)";
  
  const isTimebank = timer.phase === "timebank";
  const center = size / 2;

  return (
    <div className="flex items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg 
          className="-rotate-90" 
          width={size} 
          height={size} 
          viewBox={`0 0 ${size} ${size}`}
          role="timer"
          aria-label={`Turn timer: ${secs} seconds remaining`}
        >
          <circle 
            cx={center} 
            cy={center} 
            r={radius} 
            fill="none" 
            stroke="rgba(255,255,255,0.08)" 
            strokeWidth={strokeWidth} 
          />
          <circle 
            cx={center} 
            cy={center} 
            r={radius} 
            fill="none" 
            stroke={color} 
            strokeWidth={strokeWidth}
            strokeDasharray={circumference} 
            strokeDashoffset={offset}
            strokeLinecap="round" 
            style={{ transition: "stroke 0.2s" }} 
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white tabular-nums">
          {secs}
        </span>
      </div>
      {isTimebank && (
        <div className="flex flex-col">
          <span className="text-[8px] font-bold uppercase tracking-wider text-white/50">TIME BANK</span>
          <span className="text-[8px] font-bold uppercase tracking-wider text-[--tertiary]">ACTIVE</span>
        </div>
      )}
    </div>
  );
});
