/**
 * Card parsing utilities for converting engine card strings to display format
 */

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export interface ParsedCard {
  rank: string;
  suit: Suit;
  isRed: boolean;
}

// Engine uses single-char suit codes: s h d c
const SUIT_MAP: Record<string, Suit> = {
  s: 'spades',
  h: 'hearts',
  d: 'diamonds',
  c: 'clubs',
};

// Engine rank codes: 2-9, T, J, Q, K, A
const RANK_DISPLAY: Record<string, string> = {
  T: '10',
  J: 'J',
  Q: 'Q',
  K: 'K',
  A: 'A',
};

/**
 * Parse engine card string (e.g., "Ah", "Tc", "2d", "Ks") to display format
 */
export function parseCard(raw: string): ParsedCard | null {
  if (!raw || raw.length < 2) return null;
  
  const suitChar = raw[raw.length - 1].toLowerCase();
  const rankChar = raw.slice(0, raw.length - 1).toUpperCase();
  
  const suit = SUIT_MAP[suitChar];
  if (!suit) return null;
  
  const rank = RANK_DISPLAY[rankChar] ?? rankChar;
  const isRed = suit === 'hearts' || suit === 'diamonds';
  
  return { rank, suit, isRed };
}

/**
 * Suit color mapping for styling
 */
export const SUIT_COLORS: Record<Suit, string> = {
  spades: '#18181b',
  hearts: '#f43f5e',
  diamonds: '#f43f5e',
  clubs: '#18181b',
};
