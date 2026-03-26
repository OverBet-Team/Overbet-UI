/**
 * HandAnalysisWidget — Top-right overlay showing hand classification and win probability
 * Currently stubbed — backend does not provide hand analysis data yet
 * Hidden when props are undefined
 */

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface HandAnalysisWidgetProps {
  /** Hand classification (e.g., "Two Pair", "Flush", "High Card") */
  handType?: string;
  /** Hand strength / win probability from 0 to 1 */
  handStrength?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Floating panel component showing hand analysis
 * Renders classification + win probability bar
 * Hidden when props are undefined
 */
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

  // Determine color based on strength
  const strengthColor = (handStrength ?? 0) > 0.7
    ? 'bg-[--tertiary]'
    : (handStrength ?? 0) > 0.4
    ? 'bg-yellow-400'
    : 'bg-white/20';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20, y: -10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: 20, y: -10 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={cn(
          'glass-panel rounded-2xl px-4 py-3 min-w-[180px]',
          'border border-white/5',
          className
        )}
      >
        {/* Hand classification */}
        {handType && (
          <div className="mb-2">
            <div className="text-[0.6rem] uppercase tracking-widest text-[--on-surface-variant]/40 font-semibold mb-1">
              Hand
            </div>
            <div className="font-headline font-bold text-sm text-[--on-surface]">
              {handType}
            </div>
          </div>
        )}

        {/* Win probability */}
        {handStrength !== undefined && (
          <div>
            <div className="text-[0.6rem] uppercase tracking-widest text-[--on-surface-variant]/40 font-semibold mb-1">
              Win Probability
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${strengthPercent}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={cn('h-full rounded-full', strengthColor)}
                />
              </div>
              <span className="text-xs font-bold font-mono text-[--on-surface] min-w-[2.5rem] text-right">
                {strengthPercent}%
              </span>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
