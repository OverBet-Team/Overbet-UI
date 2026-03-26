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
    ? 'from-[--tertiary] to-cyan-400'
    : isMedium
    ? 'from-yellow-400 to-yellow-500'
    : 'from-white/30 to-white/20';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
        exit={{ opacity: 0, x: 20, y: -10, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={cn(
          'glass-panel rounded-2xl p-5 min-w-[220px]',
          'border border-white/10',
          'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
          'backdrop-blur-xl bg-[--surface-container-low]/60',
          className
        )}
      >
        {/* Header with icon */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-[--tertiary]/10 flex items-center justify-center">
            <TrendingUp size={16} className="text-[--tertiary]" />
          </div>
          <div className="text-[0.65rem] uppercase tracking-[0.15em] text-[--on-surface-variant]/50 font-bold font-headline">
            Hand Analysis
          </div>
        </div>

        {/* Hand classification */}
        {handType && (
          <div className="mb-4">
            <div className="text-[0.55rem] uppercase tracking-[0.2em] text-[--on-surface-variant]/40 font-semibold mb-1.5 font-headline">
              Classification
            </div>
            <div className="font-headline font-bold text-lg text-[--on-surface] tracking-tight">
              {handType}
            </div>
          </div>
        )}

        {/* Win probability */}
        {handStrength !== undefined && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[0.55rem] uppercase tracking-[0.2em] text-[--on-surface-variant]/40 font-semibold font-headline">
                Win Probability
              </div>
              <div className="flex items-center gap-1">
                <Target size={12} className="text-[--tertiary]" />
                <span className="text-sm font-bold font-mono text-[--tertiary] tabular-nums">
                  {strengthPercent}%
                </span>
              </div>
            </div>
            
            {/* Animated progress bar */}
            <div className="relative h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${strengthPercent}%` }}
                transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
                className={cn(
                  'h-full rounded-full',
                  `bg-gradient-to-r ${progressColor}`,
                  'shadow-[0_0_12px_rgba(0,229,255,0.4)]'
                )}
              />
              {/* Glow effect */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                style={{ transform: 'translateX(-100%)' }}
              />
            </div>

            {/* Strength label */}
            <div className="mt-2 text-center">
              <span className={cn(
                'text-[0.6rem] uppercase tracking-widest font-bold',
                isStrong ? 'text-[--tertiary]' : isMedium ? 'text-yellow-400' : 'text-white/40'
              )}>
                {isStrong ? 'Strong Hand' : isMedium ? 'Medium Hand' : 'Weak Hand'}
              </span>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
