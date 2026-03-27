import { describe, it, expect } from 'vitest';
import { NLHMachine } from '../src/variants/NLH';

describe('NLHMachine Engine', () => {
    it('should run a basic hand with pre-flop, flop, turn, and river checks/bets', () => {
        const engine = new NLHMachine();

        // Add players
        engine.addPlayer({ id: "p1", stack: 1000, status: "ACTIVE", seatIndex: 0, holeCards: [], bet: 0, hasActed: false });
        engine.addPlayer({ id: "p2", stack: 1000, status: "ACTIVE", seatIndex: 1, holeCards: [], bet: 0, hasActed: false });
        engine.addPlayer({ id: "p3", stack: 1000, status: "ACTIVE", seatIndex: 2, holeCards: [], bet: 0, hasActed: false });

        let events = engine.startHand({ seed: 42 });
        let state = engine.getState();

        expect(state.phase).toBe('PRE_FLOP_BETTING');
        expect(state.players).toHaveLength(3);

        // Pre-Flop (p1 calls, p2 calls, p3 checks)
        // Assume p1 is first to act after big blind (if p3 is dealer, p1 sb, p2 bb, p3 UTG? Let's trace it)
        // actually activePlayerIndex is managed internally. Just call to match the old test script.
        engine.handleAction(state.players[state.activePlayerIndex].id, { type: "CALL" });
        state = engine.getState();
        engine.handleAction(state.players[state.activePlayerIndex].id, { type: "CALL" });
        state = engine.getState();
        engine.handleAction(state.players[state.activePlayerIndex].id, { type: "CHECK" });
        state = engine.getState();

        expect(state.phase).toBe('FLOP_BETTING');
        expect(state.board).toHaveLength(3);

        // Flop checks
        engine.handleAction(state.players[state.activePlayerIndex].id, { type: "CHECK" });
        state = engine.getState();
        engine.handleAction(state.players[state.activePlayerIndex].id, { type: "CHECK" });
        state = engine.getState();
        engine.handleAction(state.players[state.activePlayerIndex].id, { type: "CHECK" });
        state = engine.getState();

        expect(state.phase).toBe('TURN_BETTING');
        expect(state.board).toHaveLength(4);

        // Turn checks
        engine.handleAction(state.players[state.activePlayerIndex].id, { type: "CHECK" });
        state = engine.getState();
        engine.handleAction(state.players[state.activePlayerIndex].id, { type: "CHECK" });
        state = engine.getState();
        engine.handleAction(state.players[state.activePlayerIndex].id, { type: "CHECK" });
        state = engine.getState();

        expect(state.phase).toBe('RIVER_BETTING');
        expect(state.board).toHaveLength(5);

        // River checks and single bet/fold/call
        engine.handleAction(state.players[state.activePlayerIndex].id, { type: "CHECK" });
        state = engine.getState();
        engine.handleAction(state.players[state.activePlayerIndex].id, { type: "CHECK" });
        state = engine.getState();

        engine.handleAction(state.players[state.activePlayerIndex].id, { type: "RAISE", amount: 100 });
        state = engine.getState();

        events = engine.handleAction(state.players[state.activePlayerIndex].id, { type: "FOLD" });
        state = engine.getState();

        events = engine.handleAction(state.players[state.activePlayerIndex].id, { type: "CALL" });

        state = engine.getState();
        expect(state.phase).toBe('CLEANUP');

        const winEvents = events.filter(e => e.type === "WIN");
        expect(winEvents.length).toBeGreaterThan(0);
    });

    it('applies configured blinds when a hand starts', () => {
        const engine = new NLHMachine();
        engine.addPlayer({ id: "p1", stack: 1000, status: "ACTIVE", seatIndex: 0, holeCards: [], bet: 0, hasActed: false });
        engine.addPlayer({ id: "p2", stack: 1000, status: "ACTIVE", seatIndex: 1, holeCards: [], bet: 0, hasActed: false });

        const events = engine.startHand({ seed: 99, smallBlind: 5, bigBlind: 10 });
        const blindsEvent = events.find((event) => event.type === "POST_BLINDS_ANTES");
        const state = engine.getState();

        expect(state.smallBlind).toBe(5);
        expect(state.bigBlind).toBe(10);
        expect(state.currentBet).toBe(10);
        expect(blindsEvent?.payload.smallBlind.amount).toBe(5);
        expect(blindsEvent?.payload.bigBlind.amount).toBe(10);
    });

    it('should have board length 3 after pre-flop, 4 after flop, 5 after turn (heads-up)', () => {
        const engine = new NLHMachine();
        engine.addPlayer({ id: "p1", stack: 1000, status: "ACTIVE", seatIndex: 0, holeCards: [], bet: 0, hasActed: false });
        engine.addPlayer({ id: "p2", stack: 1000, status: "ACTIVE", seatIndex: 1, holeCards: [], bet: 0, hasActed: false });

        engine.startHand({ seed: 123 });
        let state = engine.getState();
        expect(state.phase).toBe('PRE_FLOP_BETTING');

        engine.handleAction(state.players[state.activePlayerIndex].id, { type: "CALL" });
        state = engine.getState();
        engine.handleAction(state.players[state.activePlayerIndex].id, { type: "CHECK" });
        state = engine.getState();

        expect(state.phase).toBe('FLOP_BETTING');
        expect(state.board).toHaveLength(3);
        expect(state.board.every(c => typeof c === 'string' && c.length >= 2)).toBe(true);

        engine.handleAction(state.players[state.activePlayerIndex].id, { type: "CHECK" });
        state = engine.getState();
        engine.handleAction(state.players[state.activePlayerIndex].id, { type: "CHECK" });
        state = engine.getState();

        expect(state.phase).toBe('TURN_BETTING');
        expect(state.board).toHaveLength(4);

        engine.handleAction(state.players[state.activePlayerIndex].id, { type: "CHECK" });
        state = engine.getState();
        engine.handleAction(state.players[state.activePlayerIndex].id, { type: "CHECK" });
        state = engine.getState();

        expect(state.phase).toBe('RIVER_BETTING');
        expect(state.board).toHaveLength(5);
    });

    it('should throw when deck has insufficient cards for flop (25 players exhaust deck)', () => {
        const engine = new NLHMachine();
        for (let i = 0; i < 25; i++) {
            engine.addPlayer({ id: `p${i}`, stack: 1000, status: "ACTIVE", seatIndex: i, holeCards: [], bet: 0, hasActed: false });
        }
        engine.startHand({ seed: 1 });
        let state = engine.getState();
        expect(state.phase).toBe('PRE_FLOP_BETTING');
        const act = () => {
            const pid = state.players[state.activePlayerIndex].id;
            const toCall = state.currentBet - (state.players[state.activePlayerIndex].bet || 0);
            if (toCall === 0) engine.handleAction(pid, { type: "CHECK" });
            else engine.handleAction(pid, { type: "CALL" });
            state = engine.getState();
        };
        expect(() => {
            while (state.phase === 'PRE_FLOP_BETTING') act();
        }).toThrow(/Insufficient deck/);
    });

    it('payout + cleanup: winner receives pot and reaches CLEANUP', () => {
        const engine = new NLHMachine();
        engine.addPlayer({ id: "p1", stack: 1000, status: "ACTIVE", seatIndex: 0, holeCards: [], bet: 0, hasActed: false });
        engine.addPlayer({ id: "p2", stack: 1000, status: "ACTIVE", seatIndex: 1, holeCards: [], bet: 0, hasActed: false });
        engine.addPlayer({ id: "p3", stack: 1000, status: "ACTIVE", seatIndex: 2, holeCards: [], bet: 0, hasActed: false });

        const totalBefore = 3000;
        engine.startHand({ seed: 42 });
        let state = engine.getState();

        // Fold p1 and p2, p3 wins (early win)
        engine.handleAction(state.players[state.activePlayerIndex].id, { type: "FOLD" });
        state = engine.getState();
        engine.handleAction(state.players[state.activePlayerIndex].id, { type: "FOLD" });
        state = engine.getState();

        expect(state.phase).toBe('CLEANUP');
        const totalAfter = state.players.reduce((s: number, p: any) => s + p.stack, 0);
        expect(totalAfter).toBe(totalBefore);
        const winner = state.players.find((p: any) => p.stack > 1000);
        expect(winner).toBeDefined();
    });

    it('startHand allows folded players with chips to re-enter next hand', () => {
        const engine = new NLHMachine();
        engine.addPlayer({ id: "p1", stack: 1000, status: "ACTIVE", seatIndex: 0, holeCards: [], bet: 0, hasActed: false });
        engine.addPlayer({ id: "p2", stack: 1000, status: "FOLDED", seatIndex: 1, holeCards: [], bet: 0, hasActed: true });
        expect(() => engine.startHand()).not.toThrow();
    });

    it('startHand throws when fewer than 2 bankroll-eligible players remain', () => {
        const engine = new NLHMachine();
        engine.addPlayer({ id: "p1", stack: 1000, status: "ACTIVE", seatIndex: 0, holeCards: [], bet: 0, hasActed: false });
        engine.addPlayer({ id: "p2", stack: 0, status: "BUSTED", seatIndex: 1, holeCards: [], bet: 0, hasActed: true });
        expect(() => engine.startHand()).toThrow(/Not enough active players/);
    });

    it('chip conservation: EARLY_WIN zeros pot after award', () => {
        const engine = new NLHMachine();
        engine.addPlayer({ id: "p1", stack: 1000, status: "ACTIVE", seatIndex: 0, holeCards: [], bet: 0, hasActed: false });
        engine.addPlayer({ id: "p2", stack: 1000, status: "ACTIVE", seatIndex: 1, holeCards: [], bet: 0, hasActed: false });
        engine.startHand({ seed: 1 });
        const state = engine.getState();
        const activeId = state.players[state.activePlayerIndex].id;
        engine.handleAction(activeId, { type: "FOLD" });
        const stateAfter = engine.getState();
        expect(stateAfter.phase).toBe('CLEANUP');
        expect(stateAfter.pot).toBe(0);
        const total = stateAfter.players.reduce((s: number, p: any) => s + p.stack, 0);
        expect(total).toBe(2000);
    });

    it('invalid action (wrong player) throws and does not corrupt state', () => {
        const engine = new NLHMachine();
        engine.addPlayer({ id: "p1", stack: 1000, status: "ACTIVE", seatIndex: 0, holeCards: [], bet: 0, hasActed: false });
        engine.addPlayer({ id: "p2", stack: 1000, status: "ACTIVE", seatIndex: 1, holeCards: [], bet: 0, hasActed: false });
        engine.startHand({ seed: 1 });
        const state = engine.getState();
        const activeId = state.players[state.activePlayerIndex].id;
        const wrongId = activeId === 'p1' ? 'p2' : 'p1';
        const phaseBefore = state.phase;
        expect(() => engine.handleAction(wrongId, { type: "CHECK" })).toThrow();
        const stateAfter = engine.getState();
        expect(stateAfter.phase).toBe(phaseBefore);
    });
});
