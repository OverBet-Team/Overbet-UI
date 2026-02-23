import MersenneTwister from "mersenne-twister";

const SUITS = ["c", "d", "h", "s"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];

export class DeckUtility {
    /**
     * Generates a standard 52 card deck
     */
    static generateStandardDeck(): string[] {
        const deck: string[] = [];
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                deck.push(`${rank}${suit}`);
            }
        }
        return deck;
    }

    /**
     * Shuffles an array in-place using the Fisher-Yates algorithm
     * bounded by a seeded Mersenne Twister PRNG.
     */
    static shuffle(deck: string[], seed: number): void {
        const prng = new MersenneTwister(seed);
        for (let i = deck.length - 1; i > 0; i--) {
            // prng.random() returns a float in [0, 1)
            const j = Math.floor(prng.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }
}
