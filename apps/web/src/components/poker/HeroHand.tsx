import type { FC } from "react";
import { memo } from "react";
import { Heart, Diamond, Spade, Club } from 'lucide-react';
import { motion } from 'framer-motion';
import { parseCard } from '@/lib/card-utils';

interface HeroHandProps {
  cards: string[];
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: { container: "w-20 h-32", text: "text-lg", suitCorner: 14, suitCenter: 36 },
  md: { container: "w-24 h-36", text: "text-xl", suitCorner: 16, suitCenter: 44 },
  lg: { container: "w-32 h-48", text: "text-2xl", suitCorner: 20, suitCenter: 56 },
};

const SUIT_ICONS = {
  hearts: Heart,
  diamonds: Diamond,
  spades: Spade,
  clubs: Club,
};

/**
 * HeroHand displays player's own cards with overlap and rotation
 * Cards animate in with spring physics and lift on hover
 */
const HeroHand: FC<HeroHandProps> = ({ cards, size = "md" }) => {
  const { container, text, suitCorner, suitCenter } = sizeClasses[size];

  if (!cards || cards.length === 0) {
    return null;
  }

  const card1Data = parseCard(cards[0] || "");
  const card2Data = parseCard(cards[1] || "");

  if (!card1Data) return null;

  const Card1Icon = SUIT_ICONS[card1Data.suit];
  const Card2Icon = card2Data ? SUIT_ICONS[card2Data.suit] : null;

  return (
    <div className="flex -space-x-8">
      {/* Card 1 - rotated left with staggered entry */}
      <motion.div
        initial={{ opacity: 0, y: 60, rotateZ: -12, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, rotateZ: -6, scale: 1 }}
        transition={{ 
          type: "spring", 
          stiffness: 200, 
          damping: 15,
          delay: 0.05 
        }}
        whileHover={{ 
          y: -16, 
          rotateZ: -8,
          scale: 1.05,
          transition: { type: "spring", stiffness: 400, damping: 12 }
        }}
        className={`
          ${container}
          poker-card-premium flex flex-col p-3 justify-between shadow-2xl
          cursor-pointer z-10
        `}
        aria-label={`Card 1: ${cards[0]}`}
      >
        <div className={`flex flex-col leading-none ${card1Data.isRed ? "suit-red" : "suit-black"}`}>
          <span className={`${text} font-bold font-headline`}>{card1Data.rank}</span>
          <Card1Icon size={suitCorner} fill="currentColor" strokeWidth={0} />
        </div>
        <div className="self-center">
          <Card1Icon size={suitCenter} fill="currentColor" strokeWidth={0} />
        </div>
        <div
          className={`flex flex-col leading-none ${card1Data.isRed ? "suit-red" : "suit-black"} self-end rotate-180`}
        >
          <span className={`${text} font-bold font-headline`}>{card1Data.rank}</span>
          <Card1Icon size={suitCorner} fill="currentColor" strokeWidth={0} />
        </div>
      </motion.div>

      {/* Card 2 - rotated right with staggered entry */}
      {cards[1] && card2Data && Card2Icon ? (
        <motion.div
          initial={{ opacity: 0, y: 60, rotateZ: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, rotateZ: 6, scale: 1 }}
          transition={{ 
            type: "spring", 
            stiffness: 200, 
            damping: 15,
            delay: 0.15 
          }}
          whileHover={{ 
            y: -16, 
            rotateZ: 8,
            scale: 1.05,
            transition: { type: "spring", stiffness: 400, damping: 12 }
          }}
          className={`
            ${container}
            poker-card-premium flex flex-col p-3 justify-between shadow-2xl
            cursor-pointer z-0
          `}
          aria-label={`Card 2: ${cards[1]}`}
        >
          <div className={`flex flex-col leading-none ${card2Data.isRed ? "suit-red" : "suit-black"}`}>
            <span className={`${text} font-bold font-headline`}>{card2Data.rank}</span>
            <Card2Icon size={suitCorner} fill="currentColor" strokeWidth={0} />
          </div>
          <div className="self-center">
            <Card2Icon size={suitCenter} fill="currentColor" strokeWidth={0} />
          </div>
          <div
            className={`flex flex-col leading-none ${card2Data.isRed ? "suit-red" : "suit-black"} self-end rotate-180`}
          >
            <span className={`${text} font-bold font-headline`}>{card2Data.rank}</span>
            <Card2Icon size={suitCorner} fill="currentColor" strokeWidth={0} />
          </div>
        </motion.div>
      ) : null}
    </div>
  );
};

export default memo(HeroHand);
