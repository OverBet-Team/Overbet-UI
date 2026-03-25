import type { FC } from "react";
import { memo } from "react";

interface HeroHandProps {
  cards: string[];
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: { container: "w-20 h-32", text: "text-lg" },
  md: { container: "w-24 h-36", text: "text-xl" },
  lg: { container: "w-32 h-48", text: "text-2xl" },
};

/**
 * HeroHand displays player's own cards with overlap and rotation
 * Cards float above action bar with hover lift effect
 */
const HeroHand: FC<HeroHandProps> = ({ cards, size = "md" }) => {
  const { container, text } = sizeClasses[size];

  if (!cards || cards.length === 0) {
    return null;
  }

  // Parse card strings (e.g., "9♥", "9♠")
  const parseCard = (card: string) => {
    const rank = card.slice(0, -1);
    const suit = card.slice(-1);
    const isRed = suit === "♥" || suit === "♦";
    return { rank, suit, isRed };
  };

  const card1 = parseCard(cards[0] || "");
  const card2 = parseCard(cards[1] || "");

  return (
    <div className="flex -space-x-8">
      {/* Card 1 - rotated left */}
      <div
        className={`
          ${container}
          poker-card-premium flex flex-col p-3 justify-between shadow-2xl
          -rotate-6 transition-transform duration-300 hover:-translate-y-4
          z-10
        `}
        aria-label={`Card 1: ${cards[0]}`}
      >
        <div className={`flex flex-col leading-none ${card1.isRed ? "suit-red" : "suit-black"}`}>
          <span className={`${text} font-bold font-headline`}>{card1.rank}</span>
          <span className="text-[14px]">{card1.suit}</span>
        </div>
        <div className="self-center">
          <span className={`text-4xl ${card1.isRed ? "suit-red" : "suit-black"}`}>
            {card1.suit}
          </span>
        </div>
        <div
          className={`flex flex-col leading-none ${card1.isRed ? "suit-red" : "suit-black"} self-end rotate-180`}
        >
          <span className={`${text} font-bold font-headline`}>{card1.rank}</span>
          <span className="text-[14px]">{card1.suit}</span>
        </div>
      </div>

      {/* Card 2 - rotated right */}
      {cards[1] ? (
        <div
          className={`
            ${container}
            poker-card-premium flex flex-col p-3 justify-between shadow-2xl
            rotate-6 transition-transform duration-300 hover:-translate-y-4
            z-0
          `}
          aria-label={`Card 2: ${cards[1]}`}
        >
          <div className={`flex flex-col leading-none ${card2.isRed ? "suit-red" : "suit-black"}`}>
            <span className={`${text} font-bold font-headline`}>{card2.rank}</span>
            <span className="text-[14px]">{card2.suit}</span>
          </div>
          <div className="self-center">
            <span className={`text-4xl ${card2.isRed ? "suit-red" : "suit-black"}`}>
              {card2.suit}
            </span>
          </div>
          <div
            className={`flex flex-col leading-none ${card2.isRed ? "suit-red" : "suit-black"} self-end rotate-180`}
          >
            <span className={`${text} font-bold font-headline`}>{card2.rank}</span>
            <span className="text-[14px]">{card2.suit}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default memo(HeroHand);
