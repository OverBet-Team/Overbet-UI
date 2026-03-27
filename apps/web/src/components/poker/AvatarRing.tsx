import type { FC, ReactNode } from "react";
import { memo } from "react";
import { cn } from "@/lib/utils";

interface AvatarRingProps {
  name: string;
  size?: number;
  status: "active" | "inactive" | "folded" | "thinking";
  isDealer?: boolean;
  children?: ReactNode;
  /** Optional hand strength for future ring integration (0-1) */
  handStrength?: number;
  /** Determines ring border color via RING_COLORS palette */
  seatIndex?: number;
}

const RING_COLORS = [
  'var(--ring-cyan)',
  'var(--ring-gold)',
  'var(--ring-magenta)',
  'var(--ring-purple)',
  'var(--ring-green)',
  'var(--ring-orange)',
];

function getRingColor(seatIndex?: number): string {
  if (seatIndex === undefined) return 'var(--ring-cyan)';
  return RING_COLORS[seatIndex % RING_COLORS.length];
}

/**
 * AvatarRing wraps avatar content with per-seat colored ring based on player status.
 */
const AvatarRing: FC<AvatarRingProps> = ({
  name,
  size = 80,
  status,
  isDealer = false,
  children,
  handStrength,
  seatIndex,
}) => {
  const ringColor = getRingColor(seatIndex);

  const ringStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderWidth: (status === 'active' || status === 'thinking') ? 3 : 2,
    borderStyle: 'solid',
    borderColor: status === 'folded'
      ? 'rgba(255,255,255,0.05)'
      : (status === 'active' || status === 'thinking')
        ? ringColor
        : `color-mix(in srgb, ${ringColor} 30%, transparent)`,
    boxShadow: (status === 'active' || status === 'thinking')
      ? `0 0 20px color-mix(in srgb, ${ringColor} 40%, transparent)`
      : 'none',
  };

  const ringClasses = cn(
    'rounded-full p-1 bg-[--bg-base] transition-all duration-500 relative flex items-center justify-center overflow-hidden',
    status === 'thinking' && 'animate-pulse',
    status === 'folded' && 'grayscale opacity-40'
  );

  return (
    <div className="relative">
      {/* Avatar ring with status-based styling */}
      <div className={ringClasses} style={ringStyle}>
        {children ? (
          children
        ) : (
          <div className="w-full h-full rounded-full bg-[--surface-container-high] flex items-center justify-center">
            <span
              className="font-headline font-bold text-[--on-surface]"
              style={{ fontSize: size * 0.35 }}
            >
              {name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Dealer chip */}
      {isDealer ? (
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border border-white/20 flex items-center justify-center text-[9px] font-black bg-[--gold] text-black shadow-lg z-10">
          D
        </div>
      ) : null}
    </div>
  );
};

export default memo(AvatarRing);
