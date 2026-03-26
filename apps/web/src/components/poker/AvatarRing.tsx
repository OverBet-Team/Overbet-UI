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
}

/**
 * AvatarRing wraps avatar content with colored ring based on player status
 * - active: cyan ring with glow (avatar-glow-active)
 * - inactive: subtle border
 * - folded: grayscale with reduced opacity (avatar-glow-inactive)
 */
const AvatarRing: FC<AvatarRingProps> = ({
  name,
  size = 96,
  status,
  isDealer = false,
  children,
  handStrength,
}) => {
  const ringClasses = cn(
    "w-24 h-24 rounded-full p-1 bg-[--bg-base] transition-all duration-500 relative",
    status === "active" && "avatar-glow-active",
    status === "inactive" && "border-2 border-white/5",
    status === "folded" && "avatar-glow-inactive"
  );

  return (
    <div className="relative">
      {/* Avatar ring with status-based styling */}
      <div className={ringClasses} style={{ width: size, height: size }}>
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
