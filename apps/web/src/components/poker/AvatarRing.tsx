import type { FC, ReactNode } from "react";
import { memo } from "react";

interface AvatarRingProps {
  name: string;
  size?: number;
  status: "active" | "inactive" | "folded";
  isDealer?: boolean;
  children?: ReactNode;
}

/**
 * AvatarRing wraps avatar content with colored ring based on player status
 * - active: cyan ring with radial glow
 * - inactive: outline-variant ring
 * - folded: secondary ring with grayscale filter
 */
const AvatarRing: FC<AvatarRingProps> = ({
  name,
  size = 96,
  status,
  isDealer = false,
  children,
}) => {
  const ringClasses = {
    active: "border-2 border-[--tertiary] shadow-[0_0_15px_rgba(129,236,255,0.3)]",
    inactive: "border-2 border-[--outline-variant]/50",
    folded: "border-2 border-[--secondary]/40 grayscale opacity-60",
  };

  const containerClasses = status === "folded" ? "opacity-60 grayscale" : "";

  return (
    <div className={`relative ${containerClasses}`}>
      {/* Radial glow behind active player */}
      {status === "active" ? (
        <div className="absolute -inset-4 radial-glow pointer-events-none" />
      ) : null}

      {/* Avatar ring */}
      <div
        className={`rounded-full p-0.5 bg-[--bg-base] ${ringClasses[status]}`}
        style={{ width: size, height: size }}
      >
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
