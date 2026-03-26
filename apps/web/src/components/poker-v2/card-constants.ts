/**
 * card-constants.ts — V2 card rendering constants.
 *
 * SUIT_SYMBOLS is imported from lib/gameLogFormatters (AGENTS.md: don't redefine).
 * This file owns card-size dimensions and rank display mapping.
 */

export { SUIT_SYMBOLS } from "@/lib/gameLogFormatters";

export type CardSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface CardSizeDef {
  w: number;    // px width
  h: number;    // px height
  rank: number; // px font-size for center rank
  corner: number; // px font-size for corner labels
  suit: number;  // px font-size for center suit
}

export const CARD_SIZES: Record<CardSize, CardSizeDef> = {
  xs: { w: 32,  h: 44,  rank: 12, corner: 7,  suit: 10 },
  sm: { w: 40,  h: 56,  rank: 16, corner: 8,  suit: 12 },
  md: { w: 56,  h: 80,  rank: 22, corner: 10, suit: 18 },
  lg: { w: 80,  h: 112, rank: 30, corner: 12, suit: 24 },
  xl: { w: 96,  h: 144, rank: 36, corner: 14, suit: 30 },
};

/** Maps engine rank (T → "10", others unchanged). */
export const RANK_DISPLAY: Record<string, string> = {
  A: "A", K: "K", Q: "Q", J: "J", T: "10",
  "2": "2", "3": "3", "4": "4", "5": "5",
  "6": "6", "7": "7", "8": "8", "9": "9",
};
