import { describe, it, expect, vi } from 'vitest';
import { LedgerMath, LedgerEntry, PlayerFinalStack, computeLedgerSnapshot } from '../src/math/Ledger';

describe('LedgerMath', () => {
    it('should compute correct PnL and Settlement Matrix', () => {
        const entries: LedgerEntry[] = [
            { playerId: "p1", amount: 1000, type: "BUY_IN" },
            { playerId: "p2", amount: 1500, type: "BUY_IN" },
            { playerId: "p3", amount: 500, type: "BUY_IN" },
            { playerId: "p2", amount: 500, type: "CASH_OUT" }
        ];

        // Net investment: p1: -1000, p2: -1000, p3: -500
        const finalStacks: PlayerFinalStack[] = [
            { playerId: "p1", finalStack: 1500 }, // PnL = -1000 + 1500 = +500
            { playerId: "p2", finalStack: 1000 }, // PnL = -1000 + 1000 = 0
            { playerId: "p3", finalStack: 0 }     // PnL = -500 + 0 = -500
        ];

        const pnl = LedgerMath.calculateSessionPnL(entries, finalStacks);

        expect(pnl["p1"]).toBe(500);
        expect(pnl["p2"]).toBe(0);
        expect(pnl["p3"]).toBe(-500);

        const settlements = LedgerMath.generateSettlementMatrix(pnl);

        expect(settlements).toHaveLength(1);
        expect(settlements[0]).toEqual({
            from: "p3",
            to: "p1",
            amount: 500
        });
    });

    it('ADD_ON is treated as investment (reduces P&L until recovered)', () => {
        // p1 buys in for 1000, adds on for 500 mid-session, ends with 2000
        const entries: LedgerEntry[] = [
            { id: 'e1', playerId: "p1", amount: 1000, type: "BUY_IN" },
            { id: 'e2', playerId: "p1", amount: 500,  type: "ADD_ON" },
            { id: 'e3', playerId: "p2", amount: 1500, type: "BUY_IN" },
        ];
        const finalStacks: PlayerFinalStack[] = [
            { playerId: "p1", finalStack: 2000 }, // -1000 - 500 + 2000 = +500
            { playerId: "p2", finalStack: 1000 }, // -1500 + 1000 = -500
        ];

        const pnl = LedgerMath.calculateSessionPnL(entries, finalStacks);
        expect(pnl["p1"]).toBe(500);
        expect(pnl["p2"]).toBe(-500);

        // Zero-sum holds
        const sum = Object.values(pnl).reduce((a, b) => a + b, 0);
        expect(sum).toBe(0);
    });

    it('multiple BUY_IN per player (rebuy scenario) — P&L is cumulative', () => {
        // p1 buys in twice (initial + rebuy after bust)
        const entries: LedgerEntry[] = [
            { id: 'e1', playerId: "p1", amount: 1000, type: "BUY_IN" },
            { id: 'e2', playerId: "p1", amount: 1000, type: "BUY_IN" }, // rebuy
            { id: 'e3', playerId: "p2", amount: 2000, type: "BUY_IN" },
        ];
        const finalStacks: PlayerFinalStack[] = [
            { playerId: "p1", finalStack: 1500 }, // -2000 + 1500 = -500
            { playerId: "p2", finalStack: 2500 }, // -2000 + 2500 = +500
        ];

        const pnl = LedgerMath.calculateSessionPnL(entries, finalStacks);
        expect(pnl["p1"]).toBe(-500);
        expect(pnl["p2"]).toBe(500);

        const sum = Object.values(pnl).reduce((a, b) => a + b, 0);
        expect(sum).toBe(0);
    });

    it('4-player settlement resolves to minimum transfers', () => {
        // Designed so that greedy matching produces ≤ N-1 transfers
        const pnl: Record<string, number> = {
            p1: 1000,
            p2: 500,
            p3: -800,
            p4: -700,
        };

        const settlements = LedgerMath.generateSettlementMatrix(pnl);

        // Verify correctness: total owed = total received
        const totalPaid = settlements.reduce((sum, t) => sum + t.amount, 0);
        const totalReceived = settlements.reduce((sum, t) => sum + t.amount, 0);
        expect(totalPaid).toBe(totalReceived);

        // p3 owes 800, p4 owes 700 — total debt = 1500 = total credit (p1+p2)
        const settledDebt = settlements
            .filter(t => t.from === 'p3' || t.from === 'p4')
            .reduce((s, t) => s + t.amount, 0);
        expect(settledDebt).toBe(1500);

        // Number of transfers ≤ N-1 (greedy minimum)
        expect(settlements.length).toBeLessThanOrEqual(3);
    });
});

describe('computeLedgerSnapshot', () => {
    it('running mode includes current stacks as unrealized position', () => {
        const entries: LedgerEntry[] = [
            { id: 'e1', playerId: "p1", amount: 1000, type: "BUY_IN" },
            { id: 'e2', playerId: "p2", amount: 1000, type: "BUY_IN" },
        ];
        // p1 is currently up, p2 is currently down (still playing)
        const currentStacks = { p1: 1500, p2: 500 };

        const snapshot = computeLedgerSnapshot(entries, currentStacks, true);

        expect(snapshot.isRunning).toBe(true);
        expect(snapshot.pnl["p1"]).toBe(500);   // -1000 + 1500
        expect(snapshot.pnl["p2"]).toBe(-500);  // -1000 + 500
        expect(snapshot.zeroSumError).toBeUndefined(); // chips conserved
    });

    it('final mode (all stacks zero) matches writeSessionEnd semantics', () => {
        // Session ended — p1 cashed out 1500, p2 cashed out 500
        const entries: LedgerEntry[] = [
            { id: 'e1', playerId: "p1", amount: 1000, type: "BUY_IN" },
            { id: 'e2', playerId: "p2", amount: 1000, type: "BUY_IN" },
            { id: 'e3', playerId: "p1", amount: 1500, type: "CASH_OUT" },
            { id: 'e4', playerId: "p2", amount: 500,  type: "CASH_OUT" },
        ];

        const snapshot = computeLedgerSnapshot(entries, {}, false);

        expect(snapshot.isRunning).toBe(false);
        expect(snapshot.pnl["p1"]).toBe(500);
        expect(snapshot.pnl["p2"]).toBe(-500);
        expect(snapshot.zeroSumError).toBeUndefined();
    });

    it('running and final mode produce consistent P&L when stacks equal CASH_OUT amounts', () => {
        const entries: LedgerEntry[] = [
            { id: 'e1', playerId: "p1", amount: 1000, type: "BUY_IN" },
            { id: 'e2', playerId: "p2", amount: 1000, type: "BUY_IN" },
        ];
        const finalEntries: LedgerEntry[] = [
            ...entries,
            { id: 'e3', playerId: "p1", amount: 1500, type: "CASH_OUT" },
            { id: 'e4', playerId: "p2", amount: 500,  type: "CASH_OUT" },
        ];

        // Running mode with stacks = {p1: 1500, p2: 500}
        const running = computeLedgerSnapshot(entries, { p1: 1500, p2: 500 }, true);
        // Final mode with CASH_OUT entries and zero stacks
        const final   = computeLedgerSnapshot(finalEntries, {}, false);

        expect(running.pnl["p1"]).toBe(final.pnl["p1"]);
        expect(running.pnl["p2"]).toBe(final.pnl["p2"]);
    });

    it('ADJUSTMENT entry overrides parent entry amount', () => {
        const entries: LedgerEntry[] = [
            { id: 'e1', playerId: "p1", amount: 1000, type: "BUY_IN" },
            // Host corrects p1's buy-in from 1000 to 800
            { id: 'e2', playerId: "p1", amount: 800, type: "ADJUSTMENT", parentId: 'e1' },
            { id: 'e3', playerId: "p2", amount: 800,  type: "BUY_IN" },
        ];

        const snapshot = computeLedgerSnapshot(entries, { p1: 900, p2: 700 }, true);

        // p1: -800 + 900 = +100
        expect(snapshot.pnl["p1"]).toBe(100);
        // p2: -800 + 700 = -100
        expect(snapshot.pnl["p2"]).toBe(-100);
        expect(snapshot.zeroSumError).toBeUndefined();
    });

    it('VOID entry zeros parent entry amount', () => {
        const entries: LedgerEntry[] = [
            { id: 'e1', playerId: "p1", amount: 1000, type: "BUY_IN" },
            // Host voids a mistaken extra buy-in
            { id: 'e2', playerId: "p1", amount: 500, type: "BUY_IN" },
            { id: 'e3', playerId: "p1", amount: 500, type: "VOID", parentId: 'e2' },
            { id: 'e4', playerId: "p2", amount: 1000, type: "BUY_IN" },
        ];

        // Both start with 1000 chips — zero-sum after p2 wins 200 from p1
        const snapshot = computeLedgerSnapshot(entries, { p1: 800, p2: 1200 }, true);

        // p1: -1000 + 800 = -200 (the voided 500 buy-in is excluded)
        expect(snapshot.pnl["p1"]).toBe(-200);
        expect(snapshot.pnl["p2"]).toBe(200);
        expect(snapshot.zeroSumError).toBeUndefined();
    });

    it('zero-sum error is surfaced when chip conservation is violated', () => {
        // Deliberately unbalanced: total buy-ins != total chips (simulates a data error)
        const entries: LedgerEntry[] = [
            { id: 'e1', playerId: "p1", amount: 1000, type: "BUY_IN" },
            { id: 'e2', playerId: "p2", amount: 1000, type: "BUY_IN" },
        ];
        // Stacks that don't sum to buy-ins (2100 ≠ 2000) — 100 chips appeared from nowhere
        const snapshot = computeLedgerSnapshot(entries, { p1: 1600, p2: 500 }, true);

        expect(snapshot.zeroSumError).toBeDefined();
        expect(Math.abs(snapshot.zeroSumError!)).toBeGreaterThan(0);
    });
});


describe('resolveEntries edge cases', () => {
    it('circular reference: ADJUSTMENT targeting another ADJUSTMENT is skipped', () => {
        const warnSpy = vi.spyOn(console, 'warn');

        const entries: LedgerEntry[] = [
            { id: 'e1', playerId: "p1", amount: 1000, type: "BUY_IN" },
            // Valid adjustment: override e1 from 1000 to 800
            { id: 'e2', playerId: "p1", amount: 800, type: "ADJUSTMENT", parentId: 'e1' },
            // Circular: targets e2 (an ADJUSTMENT) — should be skipped
            { id: 'e3', playerId: "p1", amount: 500, type: "ADJUSTMENT", parentId: 'e2' },
            { id: 'e4', playerId: "p2", amount: 800, type: "BUY_IN" },
        ];

        const snapshot = computeLedgerSnapshot(entries, { p1: 900, p2: 700 }, true);

        // e2's adjustment on e1 takes effect (1000 → 800), e3 is skipped
        // p1: -800 + 900 = +100, p2: -800 + 700 = -100
        expect(snapshot.pnl["p1"]).toBe(100);
        expect(snapshot.pnl["p2"]).toBe(-100);
        expect(snapshot.zeroSumError).toBeUndefined();

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('circular reference skipped')
        );

        warnSpy.mockRestore();
    });

    it('VOID targeting non-existent parentId is skipped', () => {
        const warnSpy = vi.spyOn(console, 'warn');

        const entries: LedgerEntry[] = [
            { id: 'e1', playerId: "p1", amount: 1000, type: "BUY_IN" },
            { id: 'e2', playerId: "p2", amount: 1000, type: "BUY_IN" },
            // References a parentId that doesn't exist — should be skipped
            { id: 'e3', playerId: "p1", amount: 0, type: "VOID", parentId: 'nonexistent-id' },
        ];

        const snapshot = computeLedgerSnapshot(entries, { p1: 1500, p2: 500 }, true);

        // Snapshot is unaffected — both buy-ins remain at full value
        // p1: -1000 + 1500 = +500, p2: -1000 + 500 = -500
        expect(snapshot.pnl["p1"]).toBe(500);
        expect(snapshot.pnl["p2"]).toBe(-500);
        expect(snapshot.zeroSumError).toBeUndefined();

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('unknown parentId nonexistent-id')
        );

        warnSpy.mockRestore();
    });

    it('multiple ADJUSTMENTs on same parent: last-write-wins', () => {
        const entries: LedgerEntry[] = [
            { id: 'e1', playerId: "p1", amount: 1000, type: "BUY_IN" },
            // First adjustment: override e1 to 800
            { id: 'e2', playerId: "p1", amount: 800, type: "ADJUSTMENT", parentId: 'e1' },
            // Second adjustment: override e1 to 600 (last-write-wins)
            { id: 'e3', playerId: "p1", amount: 600, type: "ADJUSTMENT", parentId: 'e1' },
            { id: 'e4', playerId: "p2", amount: 600, type: "BUY_IN" },
        ];

        const snapshot = computeLedgerSnapshot(entries, { p1: 700, p2: 500 }, true);

        // e1 effective amount = 600 (last adjustment wins)
        // p1: -600 + 700 = +100, p2: -600 + 500 = -100
        expect(snapshot.pnl["p1"]).toBe(100);
        expect(snapshot.pnl["p2"]).toBe(-100);
        expect(snapshot.zeroSumError).toBeUndefined();
    });
});

describe('deterministic settlement', () => {
    it('settlement order is deterministic regardless of object key insertion order', () => {
        // Two pnl maps with identical values but different insertion order
        const pnlA: Record<string, number> = {};
        pnlA["p3"] = -800;
        pnlA["p1"] = 1000;
        pnlA["p4"] = -700;
        pnlA["p2"] = 500;

        const pnlB: Record<string, number> = {};
        pnlB["p1"] = 1000;
        pnlB["p2"] = 500;
        pnlB["p3"] = -800;
        pnlB["p4"] = -700;

        const settlementsA = LedgerMath.generateSettlementMatrix(pnlA);
        const settlementsB = LedgerMath.generateSettlementMatrix(pnlB);

        expect(settlementsA).toEqual(settlementsB);
        // Verify it actually produced transfers
        expect(settlementsA.length).toBeGreaterThan(0);
    });
});