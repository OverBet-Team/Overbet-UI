import type { FC } from "react";
import { memo } from "react";
import { motion } from 'framer-motion';
import PlayingCard from "./PlayingCard";

interface HeroHandProps {
  cards: string[];
  size?: "sm" | "md" | "lg";
}

/**
 * HeroHand displays player's own cards with overlap and rotation
 * Cards animate in with spring physics and lift on hover
 */
const HeroHand: FC<HeroHandProps> = ({ cards, size = "md" }) => {
  if (!cards || cards.length === 0) {
    return null;
  }

  return (
    <div className="flex -space-x-12 md:-space-x-16 items-end justify-center perspective-1000">
      {cards.map((card, i) => (
        <motion.div
          key={card}
          initial={{ y: 100, opacity: 0, rotateZ: i === 0 ? -15 : 15 }}
          animate={{ y: 0, opacity: 1, rotateZ: i === 0 ? -6 : 6 }}
          whileHover={{ 
            y: -20, 
            rotateZ: 0,
            scale: 1.1,
            zIndex: 100,
            transition: { type: "spring", stiffness: 400, damping: 15 }
          }}
          transition={{ 
            type: "spring", 
            stiffness: 200, 
            damping: 20,
            delay: i * 0.1 
          }}
          className="relative z-10"
        >
          <PlayingCard 
            card={card} 
            size={size === "sm" ? "md" : "lg"} 
            className="shadow-2xl ring-1 ring-white/10"
          />
        </motion.div>
      ))}
    </div>
  );
};

export default memo(HeroHand);
