export interface LedgerEntry {
    playerId: string;
    amount: number;      // positive means bought in or added chips
    type: "BUY_IN" | "CASH_OUT";
}

export interface PlayerFinalStack {
    playerId: string;
    finalStack: number;
}

export interface SettlementTransfer {
    from: string; // Debtors
    to: string;   // Creditor
    amount: number;
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

        // 1. Calculate net investments (Total Buy-Ins - Total Cashouts)
        for (const entry of entries) {
            if (!pnl[entry.playerId]) {
                pnl[entry.playerId] = 0;
            }
            if (entry.type === "BUY_IN") {
                pnl[entry.playerId] -= entry.amount; // Invested, so negative PnL initially
            } else if (entry.type === "CASH_OUT") {
                pnl[entry.playerId] += entry.amount; // Cashing out adds to PnL
            }
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

        // Sort descending to match largest debts to largest credits first
        debtors.sort((a, b) => b.amount - a.amount);
        creditors.sort((a, b) => b.amount - a.amount);

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
