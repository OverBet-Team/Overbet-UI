"use client";

import React from "react";
import { Coins } from "lucide-react";

interface BankDisplayProps {
  amount: number;
  className?: string;
}

export const BankDisplay = React.memo(function BankDisplay({
  amount,
  className = "",
}: BankDisplayProps) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
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
  );
});
