import { describe, it, expect } from 'vitest';
import { DeckUtility } from '../src/utils/Deck';

describe('DeckUtility', () => {
    describe('generateStandardDeck', () => {
        it('should generate a standard 52 card deck', () => {
            const deck = DeckUtility.generateStandardDeck();
            expect(deck).toHaveLength(52);
        });

        it('should contain all unique cards', () => {
            const deck = DeckUtility.generateStandardDeck();
            const uniqueCards = new Set(deck);
            expect(uniqueCards.size).toBe(52);
        });

        it('should contain expected cards (e.g. As, 2c, Kh)', () => {
            const deck = DeckUtility.generateStandardDeck();
            expect(deck).toContain('As');
            expect(deck).toContain('2c');
            expect(deck).toContain('Kh');
            expect(deck).toContain('Td');
        });

        it('should only contain valid suits and ranks', () => {
            const deck = DeckUtility.generateStandardDeck();
            const validSuits = ['c', 'd', 'h', 's'];
            const validRanks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

            for (const card of deck) {
                expect(card).toHaveLength(2);
                const rank = card[0];
                const suit = card[1];
                expect(validRanks).toContain(rank);
                expect(validSuits).toContain(suit);
            }
        });
    });

    describe('shuffle', () => {
        it('should preserve the length of the deck', () => {
            const deck = DeckUtility.generateStandardDeck();
            DeckUtility.shuffle(deck, 12345);
            expect(deck).toHaveLength(52);
        });

        it('should contain all original cards after shuffling', () => {
            const originalDeck = DeckUtility.generateStandardDeck();
            const deck = [...originalDeck];
            DeckUtility.shuffle(deck, 12345);

            const originalSet = new Set(originalDeck);
            const shuffledSet = new Set(deck);

            expect(shuffledSet.size).toBe(52);
            for (const card of deck) {
                expect(originalSet.has(card)).toBe(true);
            }
        });

        it('should be deterministic given the same seed', () => {
            const deck1 = DeckUtility.generateStandardDeck();
            const deck2 = DeckUtility.generateStandardDeck();

            DeckUtility.shuffle(deck1, 12345);
            DeckUtility.shuffle(deck2, 12345);

            expect(deck1).toEqual(deck2);
        });

        it('should produce a different order for different seeds', () => {
            const deck1 = DeckUtility.generateStandardDeck();
            const deck2 = DeckUtility.generateStandardDeck();

            DeckUtility.shuffle(deck1, 12345);
            DeckUtility.shuffle(deck2, 54321);

            expect(deck1).not.toEqual(deck2);
        });

        it('should produce a different order from an unshuffled deck', () => {
            const unshuffled = DeckUtility.generateStandardDeck();
            const deckToShuffle = [...unshuffled];

            DeckUtility.shuffle(deckToShuffle, 999);

            expect(deckToShuffle).not.toEqual(unshuffled);
        });
    });
});
