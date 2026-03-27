/**
 * HandAnalysisWidget — Top-right overlay showing hand classification and win probability
 * Glass-morphism design with animated progress bar
 */

import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HandAnalysisWidgetProps {
  /** Hand classification (e.g., "Two Pair", "Flush", "High Card") */
  handType?: string;
  /** Hand strength / win probability from 0 to 1 */
  handStrength?: number;
  /** Additional CSS classes */
  className?: string;
}

export default function HandAnalysisWidget({
  handType,
  handStrength,
  className,
}: HandAnalysisWidgetProps) {
  // Only show when we have data
  const hasData = handType !== undefined || handStrength !== undefined;
  
  if (!hasData) {
    return null;
  }

  const strengthPercent = handStrength !== undefined 
    ? Math.round(handStrength * 100) 
    : 0;

  // Determine color and gradient based on strength
  const isStrong = (handStrength ?? 0) > 0.7;
  const isMedium = (handStrength ?? 0) > 0.4 && (handStrength ?? 0) <= 0.7;
  
  const progressColor = isStrong
    ? 'bg-[--tertiary]'
    : isMedium
    ? 'bg-[--gold]'
    : 'bg-white/20';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 20, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={cn(
          'glass-panel p-4 min-w-[200px] flex flex-col gap-3',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={12} className="text-[--tertiary]" />
            <span className="text-[9px] font-black font-headline uppercase tracking-[0.2em] text-white/40">
              Analysis Engine
            </span>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-[--tertiary] animate-pulse shadow-[0_0_8px_var(--tertiary)]" />
        </div>

        {/* Hand Type */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] font-black font-headline uppercase tracking-widest text-white/20">
            Classification
          </span>
          <span className="text-xl font-black font-headline tracking-tighter text-white/90">
            {handType || "Calculating..."}
          </span>
        </div>

        {/* Strength Bar */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-black font-headline uppercase tracking-widest text-white/20">
              Win Probability
            </span>
            <span className={cn(
              "text-[10px] font-black font-mono",
              isStrong ? "text-[--tertiary]" : isMedium ? "text-[--gold]" : "text-white/40"
            )}>
              {strengthPercent}%
            </span>
          </div>
          
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden relative border border-white/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${strengthPercent}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
              className={cn(
                'h-full rounded-full relative z-10',
                progressColor,
                isStrong && 'shadow-[0_0_12px_var(--tertiary)]'
              )}
            />
            {/* Scanning Effect */}
            <motion.div 
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent w-1/2 z-20"
            />
          </div>
        </div>

        {/* Status Text */}
        <div className="flex items-center gap-1.5 justify-center mt-1">
          <Target size={10} className={cn(
            isStrong ? "text-[--tertiary]" : isMedium ? "text-[--gold]" : "text-white/20"
          )} />
          <span className={cn(
            "text-[8px] font-black font-headline uppercase tracking-[0.2em]",
            isStrong ? "text-[--tertiary]" : isMedium ? "text-[--gold]" : "text-white/20"
          )}>
            {isStrong ? "High Confidence" : isMedium ? "Moderate Risk" : "Low Probability"}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
