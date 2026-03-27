/**
 * HandStrengthRing — SVG circular progress indicator around avatar
 * Shows hand strength from 0-1 with color thresholds
 * Currently stubbed — backend does not provide handStrength data yet
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface HandStrengthRingProps {
  /** Hand strength value from 0 to 1 */
  strength: number;
  /** Size of the ring in pixels */
  size?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SVG circular progress ring component
 * Color thresholds: >0.7 = tertiary, >0.4 = yellow, else white/20%
 */
export default function HandStrengthRing({
  strength,
  size = 96,
  className,
}: HandStrengthRingProps) {
  // Clamp strength between 0 and 1
  const clampedStrength = Math.max(0, Math.min(1, strength));
  
  // Calculate stroke dash array for SVG circle progress
  // Circle circumference = 2π * radius, we use radius of 48 for a 100x100 viewBox
  const circumference = 2 * Math.PI * 48;
  const strokeDasharray = `${clampedStrength * circumference} ${circumference}`;
  
  // Determine color based on strength thresholds
  const colorClass = clampedStrength > 0.7 
    ? 'text-[--tertiary]'
    : clampedStrength > 0.4
    ? 'text-yellow-400'
    : 'text-white/20';

  return (
    <div 
      className={cn('absolute -inset-1 rounded-full pointer-events-none', className)}
      style={{ width: size + 2, height: size + 2 }}
    >
      <svg 
        className="w-full h-full -rotate-90" 
        viewBox="0 0 100 100"
      >
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray={strokeDasharray}
          className={cn(
            'transition-all duration-1000',
            colorClass
          )}
        />
      </svg>
    </div>
  );
}
