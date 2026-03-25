export interface LedgerEntry {
    playerId: string;
    amount: number;      // positive means bought in, added chips, or cashed out
    type: "BUY_IN" | "ADD_ON" | "CASH_OUT" | "ADJUSTMENT" | "VOID";
    parentId?: string;   // for ADJUSTMENT/VOID: references the entry being corrected
    id?: string;         // optional stable ID, used for ADJUSTMENT/VOID resolution
    timestamp?: number;  // unix ms; optional, for ordering
}

export interface PlayerFinalStack {
    playerId: string;
    finalStack: number;
}

export interface SettlementTransfer {
    from: string; // Debtor
    to: string;   // Creditor
    amount: number;
}

export interface LedgerSnapshot {
    /** Net chip P&L per player. Positive = winner, negative = loser. */
    pnl: Record<string, number>;
    settlement: SettlementTransfer[];
    /**
     * true = game in progress; currentStacks contains "unrealized" positions.
     * false = game over; all positions captured in CASH_OUT entries.
     */
    isRunning: boolean;
    /**
     * Present only when chip conservation is violated (|sum of pnl| > 1).
     * Callers must surface this — do not swallow silently.
     */
    zeroSumError?: number;
}

export class LedgerMath {
    /**
     * Parse explicitly logged buy-ins, cash-outs, and final table values
     * to determine the absolute net PnL for each player.
     *
     * Positive PnL = Player won money
     * Negative PnL = Player lost money
     */
    static calculateSessionPnL(
        entries: LedgerEntry[],
        finalStacks: PlayerFinalStack[]
    ): Record<string, number> {
        const pnl: Record<string, number> = {};

        // 1. Calculate net investments (Total Buy-Ins/Add-Ons - Total Cashouts)
        for (const entry of entries) {
            if (!pnl[entry.playerId]) {
                pnl[entry.playerId] = 0;
            }
            if (entry.type === "BUY_IN" || entry.type === "ADD_ON") {
                // Both buy-ins and add-ons are chip investments — negative initial impact
                pnl[entry.playerId] -= entry.amount;
            } else if (entry.type === "CASH_OUT") {
                pnl[entry.playerId] += entry.amount;
            }
            // ADJUSTMENT and VOID are resolved upstream in computeLedgerSnapshot
        }

        // 2. Add final chips left on table to PnL
        for (const stack of finalStacks) {
            if (pnl[stack.playerId] === undefined) {
                pnl[stack.playerId] = 0;
            }
            pnl[stack.playerId] += stack.finalStack;
        }

        return pnl;
    }

    /**
     * Generate the settlement matrix (who owes whom) with a greedy algorithm
     * to minimize the total number of transactions.
     */
    static generateSettlementMatrix(pnlMap: Record<string, number>): SettlementTransfer[] {
        const transfers: SettlementTransfer[] = [];

        // Separate into debtors (negative PnL) and creditors (positive PnL)
        const debtors: { id: string, amount: number }[] = [];
        const creditors: { id: string, amount: number }[] = [];

        for (const [id, net] of Object.entries(pnlMap)) {
            if (net < 0) debtors.push({ id, amount: Math.abs(net) }); // make debt positive for processing
            else if (net > 0) creditors.push({ id, amount: net });
        }

        // Sort descending by amount; break ties by id for deterministic output
        debtors.sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
        creditors.sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));

        let dIdx = 0;
        let cIdx = 0;

        while (dIdx < debtors.length && cIdx < creditors.length) {
            const debtor = debtors[dIdx];
            const creditor = creditors[cIdx];

            const settlementAmount = Math.min(debtor.amount, creditor.amount);

            if (settlementAmount > 0) {
                transfers.push({
                    from: debtor.id,
                    to: creditor.id,
                    amount: settlementAmount
                });
            }

            debtor.amount -= settlementAmount;
            creditor.amount -= settlementAmount;

            if (debtor.amount === 0) dIdx++;
            if (creditor.amount === 0) cIdx++;
        }

        return transfers;
    }
}

/**
 * Resolve ADJUSTMENT and VOID entries by walking parentId chains.
 *
 * Returns a new array of entries where:
 * - VOID entries zero out the parent's effective amount
 * - ADJUSTMENT entries replace the parent's effective amount
 * - Original ADJUSTMENT/VOID entries are removed from the output
 *
 * Only BUY_IN, ADD_ON, and CASH_OUT entries appear in the result
 * (with amounts potentially modified by adjustments).
 *
 * Invariants enforced:
 * - Circular parentId references are detected and skipped with a warning.
 * - Only the last ADJUSTMENT per parent takes effect (last-write-wins).
 * - ADJUSTMENT/VOID targeting a non-existent parentId is skipped.
 */
function resolveEntries(entries: LedgerEntry[]): LedgerEntry[] {
    // Build an id-keyed map for O(1) parent lookup.
    // Entries without IDs cannot be targeted by ADJUSTMENT/VOID — treat as resolved.
    const byId = new Map<string, LedgerEntry>();
    for (const e of entries) {
        if (e.id) byId.set(e.id, e);
    }

    // Track effective amounts per entry id. Start with original amounts.
    const effectiveAmount = new Map<string, number>();
    for (const [id, e] of byId.entries()) {
        effectiveAmount.set(id, e.amount);
    }

    // Apply ADJUSTMENT and VOID in chronological order (insertion order preserved).
    // Invariants: skip entries with missing parentId targets or circular references;
    // last-write-wins for multiple adjustments on the same parent.
    for (const entry of entries) {
        if ((entry.type === "VOID" || entry.type === "ADJUSTMENT") && entry.parentId) {
            // Guard: parentId must reference a known entry
            if (!byId.has(entry.parentId)) {
                console.warn(
                    `[resolveEntries] ${entry.type} entry ${entry.id ?? '(no id)'} references unknown parentId ${entry.parentId} — skipped`
                );
                continue;
            }

            // Guard: detect circular reference (ADJUSTMENT/VOID pointing at another ADJUSTMENT/VOID)
            const parent = byId.get(entry.parentId)!;
            if (parent.type === "ADJUSTMENT" || parent.type === "VOID") {
                console.warn(
                    `[resolveEntries] ${entry.type} entry ${entry.id ?? '(no id)'} targets ${parent.type} entry ${entry.parentId} — circular reference skipped`
                );
                continue;
            }

            // Apply: VOID zeroes the parent; ADJUSTMENT replaces its effective amount.
            // Multiple adjustments on the same parent: last-write-wins (chronological order).
            if (entry.type === "VOID") {
                effectiveAmount.set(entry.parentId, 0);
            } else {
                effectiveAmount.set(entry.parentId, entry.amount);
            }
        }
    }

    // Reconstruct: only base entry types, with effective amounts.
    const resolved: LedgerEntry[] = [];
    for (const entry of entries) {
        if (entry.type === "ADJUSTMENT" || entry.type === "VOID") continue;
        const effective = entry.id ? (effectiveAmount.get(entry.id) ?? entry.amount) : entry.amount;
        if (effective === 0) continue; // voided — exclude
        resolved.push({ ...entry, amount: effective });
    }

    return resolved;
}

/**
 * Compute ledger P&L and settlement from persisted entries plus current engine stacks.
 *
 * @param entries    - All ledger entries for the room (including ADJUSTMENT/VOID).
 * @param currentStacks - Map of playerId → current chip count from the engine.
 *   Running mode:  pass actual engine stacks (unrealized position).
 *   Final mode:    pass all zeros (stacks captured in CASH_OUT entries).
 * @param isRunning  - true = mid-game; false = session finished.
 *
 * ADD_ON entries are treated identically to BUY_IN (both are investments).
 * ADJUSTMENT entries override the effective amount of the referenced parent.
 * VOID entries zero out the referenced parent entry.
 * Zero-sum is validated; violation is surfaced as zeroSumError (never swallowed).
 */
export function computeLedgerSnapshot(
    entries: LedgerEntry[],
    currentStacks: Record<string, number>,
    isRunning: boolean
): LedgerSnapshot {
    const resolved = resolveEntries(entries);

    // Convert currentStacks to PlayerFinalStack for calculateSessionPnL.
    // In running mode these represent "chips still on the table" (unrealized P&L).
    // In final mode these are all zero (every player's exit was recorded as CASH_OUT).
    const finalStacks: PlayerFinalStack[] = Object.entries(currentStacks).map(
        ([playerId, finalStack]) => ({ playerId, finalStack })
    );

    const pnl = LedgerMath.calculateSessionPnL(resolved, finalStacks);
    const settlement = LedgerMath.generateSettlementMatrix(pnl);

    // Zero-sum check: chip conservation requires all P&L values sum to exactly 0.
    const sum = Object.values(pnl).reduce((acc, v) => acc + v, 0);
    const zeroSumError = Math.abs(sum) > 0 ? sum : undefined;
    if (zeroSumError !== undefined) {
        console.warn(`[computeLedgerSnapshot] Zero-sum violation: Σ PnL = ${sum}`);
    }

    return { pnl, settlement, isRunning, zeroSumError };
}
