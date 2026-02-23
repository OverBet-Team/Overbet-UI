import { describe, it, expect } from 'vitest';
import { LedgerMath, LedgerEntry, PlayerFinalStack } from '../src/math/Ledger';

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
});
