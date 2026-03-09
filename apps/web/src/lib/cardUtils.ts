/**
 * OverBet card format adapter.
 * OverBet uses RankSuit (e.g. As, Tc, 2h, Kd).
 * This module parses to display-ready { rank, suit } for PlayingCard.
 */

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface ParsedCard {
  rank: Rank;
  suit: Suit;
}

const SUIT_MAP: Record<string, Suit> = {
  s: 'spades',
  h: 'hearts',
  d: 'diamonds',
  c: 'clubs',
};

const RANK_MAP: Record<string, Rank> = {
  A: 'A',
  K: 'K',
  Q: 'Q',
  J: 'J',
  T: '10',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const SUIT_COLORS: Record<Suit, string> = {
  spades: '#111827',
  hearts: '#dc2626',
  diamonds: '#dc2626',
  clubs: '#111827',
};

/**
 * Parse OverBet card string (e.g. "As", "Tc", "2h") to { rank, suit }.
 */
export function parseOverBetCard(card: string): ParsedCard | null {
  if (!card || card.length < 2) return null;
  const rankChar = card[0];
  const suitChar = card[1].toLowerCase();
  const rank = RANK_MAP[rankChar.toUpperCase()];
  const suit = SUIT_MAP[suitChar];
  if (!rank || !suit) return null;
  return { rank, suit };
}
