import type { FC, ReactNode } from "react";
import { memo } from "react";
import { cn } from "@/lib/utils";

interface AvatarRingProps {
  name: string;
  size?: number;
  status: "active" | "inactive" | "folded";
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
 * - active: colored ring with matching glow (avatar-glow-active)
 * - inactive: same color at 30% opacity, subtle shadow
 * - folded: grayscale with minimal border (avatar-glow-inactive)
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
    borderWidth: status === 'active' ? 3 : 2,
    borderStyle: 'solid',
    borderColor: status === 'folded'
      ? 'rgba(255,255,255,0.05)'
      : status === 'active'
        ? ringColor
        : `color-mix(in srgb, ${ringColor} 30%, transparent)`,
    boxShadow: status === 'active'
      ? `0 0 20px color-mix(in srgb, ${ringColor} 40%, transparent)`
      : 'none',
  };

  const ringClasses = cn(
    'rounded-full p-1 bg-[--bg-base] transition-all duration-500 relative',
    status === 'active' && 'avatar-glow-active',
    status === 'folded' && 'avatar-glow-inactive'
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
        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-white/10 flex items-center justify-center text-[8px] font-bold bg-[--gold] text-black">
          D
        </div>
      ) : null}
    </div>
  );
};

export default memo(AvatarRing);
