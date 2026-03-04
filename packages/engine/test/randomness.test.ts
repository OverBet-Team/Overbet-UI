import { describe, it, expect } from 'vitest';
import { NLHMachine } from '../src/variants/NLH';

describe('Commit-Reveal Randomness', () => {
    it('should NOT leak the seed in HAND_INIT and reveal it in HAND_REVEAL', () => {
        const engine = new NLHMachine();
        engine.addPlayer({ id: "p1", stack: 1000, status: "ACTIVE", seatIndex: 0, holeCards: [], bet: 0, hasActed: false });
        engine.addPlayer({ id: "p2", stack: 1000, status: "ACTIVE", seatIndex: 1, holeCards: [], bet: 0, hasActed: false });

        const events = engine.startHand();
        const initEvent = events.find(e => e.type === "HAND_INIT");

        expect(initEvent).toBeDefined();
        expect(initEvent?.payload.commitment).toBeDefined();
        expect(initEvent?.payload.seed).toBeUndefined(); // CRITICAL: Seed must be hidden

        // Play the hand to completion (simulate endHand)
        const endEvents = engine.endHand();
        const revealEvent = endEvents.find(e => e.type === "HAND_REVEAL");

        expect(revealEvent).toBeDefined();
        expect(revealEvent?.payload.seed).toBeDefined();
        expect(revealEvent?.payload.commitment).toBe(initEvent?.payload.commitment);

        const state = engine.getState();
        expect(state.lastHandReveal).toBeDefined();
        expect(state.lastHandReveal?.seed).toBe(revealEvent?.payload.seed);
    });
});
