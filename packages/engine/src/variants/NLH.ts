import { PokerEngine } from "../PokerEngine";
import { GameState, PokerAction, HandEvent, Player } from "../types";
import { DeckUtility } from "../utils/Deck";
import * as crypto from "crypto";
import * as PokerEvaluator from 'poker-evaluator';

export class NLHMachine implements PokerEngine {
    private state: GameState;
    private eventSequence: number = 0;
    private currentHandSeed: number = 0;
    private currentHandCommitment: string = "";

    constructor() {
        this.state = {
            phase: "LOBBY",
            pot: 0,
            sidePots: [],
            board: [],
            deck: [],
            players: [],
            dealerIndex: 0,
            activePlayerIndex: 0,
            sbIndex: 0,
            bbIndex: 0,
            currentBet: 0,
            minRaise: 0,
            smallBlind: 10,
            bigBlind: 20,
            ante: 0,
        };
    }

    private createEvent(type: string, payload: any): HandEvent {
        return {
            type,
            sequence: ++this.eventSequence,
            payload
        };
    }

    startHand(settings?: any): HandEvent[] {
        const events: HandEvent[] = [];
        this.eventSequence = 0;

        if (Number.isFinite(settings?.smallBlind)) {
            this.state.smallBlind = Math.max(0, Math.trunc(settings.smallBlind));
        }
        if (Number.isFinite(settings?.bigBlind)) {
            this.state.bigBlind = Math.max(0, Math.trunc(settings.bigBlind));
        }
        if (Number.isFinite(settings?.ante)) {
            this.state.ante = Math.max(0, Math.trunc(settings.ante));
        }

        // Determine next-hand eligible players from bankroll/status before per-hand status reset.
        // Folded players with chips must be allowed back into the next hand.
        const startEligiblePlayers = this.state.players.filter(
            p => p.stack > 0 && p.status !== "SITTING_OUT" && p.status !== "BUSTED"
        );
        if (startEligiblePlayers.length < 2) {
            throw new Error("Not enough active players to start a hand");
        }

        // HAND_INIT
        const seed = settings?.seed ?? crypto.randomBytes(4).readUInt32BE(0);
        const commitment = crypto.createHash('sha256').update(seed.toString()).digest('hex');

        this.currentHandSeed = seed;
        this.currentHandCommitment = commitment;

        this.state.phase = "HAND_INIT";
        this.state.deck = DeckUtility.generateStandardDeck();
        DeckUtility.shuffle(this.state.deck, seed);

        this.state.pot = 0;
        this.state.sidePots = [];
        this.state.board = [];
        this.state.currentBet = 0;
        this.state.players.forEach(p => {
            p.holeCards = [];
            p.bet = 0;
            p.hasActed = false;
            if (p.status === "SITTING_OUT") {
                return;
            }
            if (p.stack <= 0) {
                p.status = "BUSTED";
                return;
            }
            if (p.status !== "BUSTED") {
                p.status = "ACTIVE";
            }
        });

        // Advance dealer button (simple implementation: increment modulo players length,
        // realistically needs to find next active player)
        let nextDealer = (this.state.dealerIndex + 1) % this.state.players.length;
        while (this.state.players[nextDealer].status !== "ACTIVE") {
            nextDealer = (nextDealer + 1) % this.state.players.length;
            if (nextDealer === this.state.dealerIndex) break; // emergency exit
        }
        this.state.dealerIndex = nextDealer;

        events.push(this.createEvent("HAND_INIT", {
            commitment,
            dealerIndex: this.state.dealerIndex,
            players: this.state.players.map(p => ({ id: p.id, status: p.status, stack: p.stack }))
        }));

        // POST_BLINDS_ANTES
        this.state.phase = "POST_BLINDS_ANTES";
        let sbIndex = (this.state.dealerIndex + 1) % this.state.players.length;
        // In heads up, dealer is SB.
        if (startEligiblePlayers.length === 2) {
            sbIndex = this.state.dealerIndex;
        } else {
            while (this.state.players[sbIndex].status !== "ACTIVE") {
                sbIndex = (sbIndex + 1) % this.state.players.length;
            }
        }

        let bbIndex = (sbIndex + 1) % this.state.players.length;
        while (this.state.players[bbIndex].status !== "ACTIVE") {
            bbIndex = (bbIndex + 1) % this.state.players.length;
        }

        // Persist blind seat indices so the gateway can expose sbPlayerId/bbPlayerId.
        this.state.sbIndex = sbIndex;
        this.state.bbIndex = bbIndex;

        // Apply Antes (if any)
        if (this.state.ante > 0) {
            this.state.players.forEach(p => {
                if (p.status === "ACTIVE") {
                    const anteAmount = Math.min(p.stack, this.state.ante);
                    p.stack -= anteAmount;
                    this.state.pot += anteAmount;
                }
            });
        }

        // Apply SB
        const sbPlayer = this.state.players[sbIndex];
        const sbAmount = Math.min(sbPlayer.stack, this.state.smallBlind);
        sbPlayer.stack -= sbAmount;
        sbPlayer.bet = sbAmount;
        if (sbPlayer.stack === 0) sbPlayer.status = "ALL_IN";

        // Apply BB
        const bbPlayer = this.state.players[bbIndex];
        const bbAmount = Math.min(bbPlayer.stack, this.state.bigBlind);
        bbPlayer.stack -= bbAmount;
        bbPlayer.bet = bbAmount;
        if (bbPlayer.stack === 0) bbPlayer.status = "ALL_IN";

        this.state.pot += (sbAmount + bbAmount);
        this.state.currentBet = this.state.bigBlind;
        this.state.minRaise = this.state.bigBlind;

        events.push(this.createEvent("POST_BLINDS_ANTES", {
            smallBlind: { playerId: sbPlayer.id, amount: sbAmount },
            bigBlind: { playerId: bbPlayer.id, amount: bbAmount },
            ante: this.state.ante
        }));

        // DEAL_PRIVATE
        this.state.phase = "DEAL_PRIVATE";
        const dealtCards: Record<string, string[]> = {};
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < this.state.players.length; j++) {
                const p = this.state.players[j];
                if (p.status === "ACTIVE" || p.status === "ALL_IN") {
                    const card = this.state.deck.pop();
                    if (card) {
                        p.holeCards.push(card);
                        if (!dealtCards[p.id]) dealtCards[p.id] = [];
                        dealtCards[p.id].push(card);
                    }
                }
            }
        }

        events.push(this.createEvent("DEAL_PRIVATE", {
            dealtCards
        }));

        // Transition to first betting round
        this.state.phase = "PRE_FLOP_BETTING";
        // UTG (player after BB) is next to act
        let utgIndex = (bbIndex + 1) % this.state.players.length;
        while (this.state.players[utgIndex].status !== "ACTIVE") {
            utgIndex = (utgIndex + 1) % this.state.players.length;
            if (utgIndex === bbIndex) break; // everyone all-in
        }
        this.state.activePlayerIndex = utgIndex;

        events.push(this.createEvent("PHASE_CHANGE", {
            phase: this.state.phase,
            activePlayerIndex: this.state.activePlayerIndex
        }));

        return events;
    }

    handleAction(playerId: string, action: PokerAction): HandEvent[] {
        const events: HandEvent[] = [];

        if (!this.state.phase.endsWith("BETTING")) {
            // Check if we are in CLEANUP or SHOWDOWN and ignore the action rather than throwing
            if (this.state.phase === "CLEANUP" || this.state.phase === "SHOWDOWN") {
                console.warn(`Action ignored: Player tried to act during ${this.state.phase}`);
                return [];
            }
            throw new Error(`Cannot perform action in non-betting phase ${this.state.phase}`);
        }

        const pInd = this.state.activePlayerIndex;
        const player = this.state.players[pInd];

        if (player.id !== playerId) {
            throw new Error(`Not player ${playerId}'s turn (it is ${player.id}'s turn)`);
        }

        let amountAdded = 0;

        switch (action.type) {
            case "FOLD":
                player.status = "FOLDED";
                break;
            case "CHECK":
                if (player.bet < this.state.currentBet) {
                    throw new Error("Cannot check, must call or raise");
                }
                break;
            case "CALL":
                const amountToCall = this.state.currentBet - player.bet;
                amountAdded = Math.min(amountToCall, player.stack);
                player.stack -= amountAdded;
                player.bet += amountAdded;
                this.state.pot += amountAdded;
                if (player.stack === 0) player.status = "ALL_IN";
                break;
            case "RAISE":
            case "ALL_IN":
                if (action.type === "RAISE" && (!action.amount || action.amount <= 0)) {
                    throw new Error("Must specify amount to raise");
                }
                
                // For RAISE, action.amount is the target total bet for this round.
                // For ALL_IN, we ignore amount and use the full stack.
                if (action.type === "ALL_IN") {
                    amountAdded = player.stack;
                } else {
                    const targetTotalBet = action.amount || 0;
                    amountAdded = targetTotalBet - player.bet;
                }

                if (amountAdded > player.stack) {
                    amountAdded = player.stack;
                }

                const totalNewBet = player.bet + amountAdded;

                // Validation: Must be at least currentBet + minRaise, unless it's an all-in
                if (totalNewBet < this.state.currentBet + this.state.minRaise && amountAdded < player.stack) {
                    throw new Error(`Raise must be at least ${this.state.currentBet + this.state.minRaise}`);
                }

                if (totalNewBet > this.state.currentBet) {
                    const raiseAmount = totalNewBet - this.state.currentBet;
                    const isFullRaise = raiseAmount >= this.state.minRaise;

                    if (isFullRaise) {
                        this.state.minRaise = raiseAmount;
                        // Reset hasActed for everyone else who is still ACTIVE
                        this.state.players.forEach(p => {
                            if (p.id !== player.id && p.status === "ACTIVE") {
                                p.hasActed = false;
                            }
                        });
                    }
                    this.state.currentBet = totalNewBet;
                }

                player.stack -= amountAdded;
                player.bet += amountAdded;
                this.state.pot += amountAdded;
                if (player.stack === 0) player.status = "ALL_IN";
                break;
        }

        player.hasActed = true;

        events.push(this.createEvent("PLAYER_ACTION", {
            playerId: player.id,
            action: action.type,
            amount: amountAdded
        }));

        this.advanceTurnOrPhase(events);

        return events;
    }

    private advanceTurnOrPhase(events: HandEvent[]) {
        const activeOrAllIn = this.state.players.filter(p => ["ACTIVE", "ALL_IN"].includes(p.status));
        const activeOnly = this.state.players.filter(p => p.status === "ACTIVE");

        // If everyone folded but one
        if (activeOrAllIn.length === 1) {
            const winAmount = this.state.pot;
            events.push(this.createEvent("EARLY_WIN", { winnerId: activeOrAllIn[0].id, amount: winAmount }));
            this.state.players.forEach(p => {
                if (p.id === activeOrAllIn[0].id) {
                    p.stack += winAmount;
                }
            });
            this.state.pot = 0; // Conserve chips: pot awarded to winner
            this.endHand(events);
            return;
        }

        // Is round over?
        // A round is over if everyone who CAN act has matched the current bet and has had a chance to act.
        const roundOver = activeOnly.every(p => p.hasActed && p.bet === this.state.currentBet);

        if (roundOver) {
            this.handleRoundEnd(events);
        } else {
            // Find next active player
            let nextInd = (this.state.activePlayerIndex + 1) % this.state.players.length;
            while (this.state.players[nextInd].status !== "ACTIVE") {
                nextInd = (nextInd + 1) % this.state.players.length;
            }
            this.state.activePlayerIndex = nextInd;

            events.push(this.createEvent("TURN_ADVANCED", {
                activePlayerIndex: this.state.activePlayerIndex
            }));
        }
    }

    private handleRoundEnd(events: HandEvent[]) {
        // Collect bets and calculate side pots using commitment iteration
        const playersWithBets = this.state.players.filter(p => p.bet > 0);

        if (playersWithBets.length > 0) {
            // Get unique, sorted bet amounts
            const distinctBets = [...new Set(playersWithBets.map(p => p.bet))].sort((a, b) => a - b);

            let previousBet = 0;

            for (const currentBet of distinctBets) {
                const slice = currentBet - previousBet;
                if (slice <= 0) continue;

                let slicePot = 0;
                const eligiblePlayers: string[] = [];

                for (const p of this.state.players) {
                    if (p.bet >= currentBet) {
                        slicePot += slice;
                        if (p.status === "ACTIVE" || p.status === "ALL_IN") {
                            eligiblePlayers.push(p.id);
                        }
                    }
                }

                // If only one player contributed to this slice (uncalled bet), refund them
                if (eligiblePlayers.length === 1 && slicePot === slice) {
                    const refundedPlayer = this.state.players.find(p => p.id === eligiblePlayers[0]);
                    if (refundedPlayer) {
                        refundedPlayer.stack += slice;
                        this.state.pot -= slice; // Conserve chips: refund comes from pot
                        events.push(this.createEvent("UNCALLED_BET_RETURNED", {
                            playerId: refundedPlayer.id,
                            amount: slice
                        }));
                    }
                } else {
                    // Move chips from pot to side pot (conserve total chips)
                    this.state.pot -= slicePot;
                    const existingSidePot = this.state.sidePots.find(sp =>
                        sp.eligiblePlayers.length === eligiblePlayers.length &&
                        sp.eligiblePlayers.every(id => eligiblePlayers.includes(id))
                    );
                    if (existingSidePot) {
                        existingSidePot.amount += slicePot;
                    } else {
                        this.state.sidePots.push({
                            amount: slicePot,
                            eligiblePlayers
                        });
                    }
                }

                previousBet = currentBet;
            }
        }

        this.state.players.forEach(p => {
            p.bet = 0;
            p.hasActed = false;
        });

        this.state.currentBet = 0;
        this.state.minRaise = this.state.bigBlind;

        if (this.state.phase === "PRE_FLOP_BETTING") {
            this.dealCards(events, "DEAL_FLOP", 3);
            this.state.phase = "FLOP_BETTING";
        } else if (this.state.phase === "FLOP_BETTING") {
            this.dealCards(events, "DEAL_TURN", 1);
            this.state.phase = "TURN_BETTING";
        } else if (this.state.phase === "TURN_BETTING") {
            this.dealCards(events, "DEAL_RIVER", 1);
            this.state.phase = "RIVER_BETTING";
        } else {
            this.evaluateShowdown(events);
            return;
        }

        const activeOnly = this.state.players.filter(p => p.status === "ACTIVE");
        if (activeOnly.length <= 1) {
            // Everyone is all-in or folded, run out the board immediately
            // But first emit the phase change so the UI sees the cards dealt
            events.push(this.createEvent("PHASE_CHANGE", {
                phase: this.state.phase,
                activePlayerIndex: this.state.activePlayerIndex,
                pot: this.state.pot,
                sidePots: JSON.parse(JSON.stringify(this.state.sidePots))
            }));
            
            // Recurse to deal next phase or showdown
            this.handleRoundEnd(events);
            return;
        }

        // Active player is first active after dealer
        let nextInd = (this.state.dealerIndex + 1) % this.state.players.length;
        while (this.state.players[nextInd].status !== "ACTIVE") {
            nextInd = (nextInd + 1) % this.state.players.length;
        }
        this.state.activePlayerIndex = nextInd;

        events.push(this.createEvent("PHASE_CHANGE", {
            phase: this.state.phase,
            activePlayerIndex: this.state.activePlayerIndex,
            pot: this.state.pot,
            sidePots: JSON.parse(JSON.stringify(this.state.sidePots))
        }));
    }

    private dealCards(events: HandEvent[], phaseName: string, count: number) {
        const available = this.state.deck?.length ?? 0;
        if (available < count) {
            throw new Error(
                `Insufficient deck for ${phaseName}: need ${count} cards, deck has ${available}`
            );
        }
        this.state.phase = phaseName as any; // Temporary transition to log dealing event
        const dealt: string[] = [];
        for (let i = 0; i < count; i++) {
            const c = this.state.deck.pop();
            if (!c) throw new Error(`${phaseName}: deck.pop() returned undefined at index ${i}`);
            dealt.push(c);
        }
        this.state.board.push(...dealt);
        const expectedBoardLen = phaseName === "DEAL_FLOP" ? 3 : phaseName === "DEAL_TURN" ? 4 : 5;
        if (this.state.board.length !== expectedBoardLen) {
            throw new Error(
                `Board length mismatch after ${phaseName}: expected ${expectedBoardLen}, got ${this.state.board.length}`
            );
        }
        events.push(this.createEvent(phaseName, { cards: dealt }));
    }

    private evaluateShowdown(events: HandEvent[]) {
        this.state.phase = "SHOWDOWN";
        events.push(this.createEvent("SHOWDOWN", { board: [...this.state.board] }));

        // If there are no side pots (e.g. simple hand without all-ins), convert main pot to a side pot for unified evaluation
        if (this.state.pot > 0 && this.state.sidePots.length === 0) {
            const activeOrAllIn = this.state.players.filter(p => ["ACTIVE", "ALL_IN"].includes(p.status) && p.holeCards.length > 0);
            this.state.sidePots.push({
                amount: this.state.pot,
                eligiblePlayers: activeOrAllIn.map(p => p.id)
            });
            this.state.pot = 0;
        }

        // Evaluate each side pot independently
        for (const splitPot of this.state.sidePots) {
            if (splitPot.amount === 0) continue;

            let bestValue = -1;
            let winners: Player[] = [];

            splitPot.eligiblePlayers.forEach(pid => {
                const p = this.state.players.find(player => player.id === pid);
                if (!p || !["ACTIVE", "ALL_IN"].includes(p.status)) return;

                const handCards = [...p.holeCards, ...this.state.board];
                const evaluation = PokerEvaluator.evalHand(handCards);

                if (evaluation.value > bestValue) {
                    bestValue = evaluation.value;
                    winners = [p];
                } else if (evaluation.value === bestValue) {
                    winners.push(p);
                }
            });

            if (winners.length > 0) {
                const winAmount = Math.floor(splitPot.amount / winners.length);
                const remainder = splitPot.amount % winners.length;

                winners.forEach((w, idx) => {
                    const amount = winAmount + (idx === 0 ? remainder : 0);
                    w.stack += amount;

                    const handCards = [...w.holeCards, ...this.state.board];
                    const evaluation = PokerEvaluator.evalHand(handCards);

                    events.push(this.createEvent("WIN", {
                        playerId: w.id,
                        amount,
                        potType: this.state.sidePots.indexOf(splitPot) === 0 ? "MAIN" : "SIDE",
                        handName: evaluation.handName
                    }));
                });
            }
        }

        this.state.sidePots = [];
        this.state.pot = 0;
        
        // Final move: set phase to CLEANUP before ending
        this.state.phase = "CLEANUP";
        this.endHand(events);
    }

    endHand(eventsArray?: HandEvent[]): HandEvent[] {
        const events: HandEvent[] = eventsArray || [];

        // Emit REVEAL before CLEANUP
        events.push(this.createEvent("HAND_REVEAL", {
            seed: this.currentHandSeed,
            commitment: this.currentHandCommitment
        }));

        this.state.lastHandReveal = {
            seed: this.currentHandSeed,
            commitment: this.currentHandCommitment
        };

        this.state.phase = "CLEANUP";
        events.push(this.createEvent("CLEANUP", {}));
        return events;
    }

    getState(): GameState {
        return this.state;
    }

    loadEvents(events: HandEvent[]): void {
        events.sort((a, b) => a.sequence - b.sequence);
        for (const ev of events) {
            this.eventSequence = Math.max(this.eventSequence, ev.sequence);
            const p = ev.payload;
            switch (ev.type) {
                case "HAND_INIT":
                    this.state.phase = "HAND_INIT";
                    this.state.dealerIndex = p.dealerIndex;
                    if (p.seed) {
                        // For historical reasons/replayers
                        this.currentHandSeed = p.seed;
                    }
                    if (p.commitment) {
                        this.currentHandCommitment = p.commitment;
                    }
                    if (p.players) {
                        p.players.forEach((pp: any) => {
                            const existing = this.state.players.find(x => x.id === pp.id);
                            if (existing) {
                                existing.status = pp.status;
                                existing.stack = pp.stack;
                            } else {
                                this.state.players.push({
                                    id: pp.id, status: pp.status, stack: pp.stack, seatIndex: -1, holeCards: [], bet: 0, hasActed: false
                                });
                            }
                        });
                    }
                    this.state.pot = 0;
                    this.state.sidePots = [];
                    this.state.board = [];
                    this.state.currentBet = 0;
                    break;
                case "POST_BLINDS_ANTES":
                    this.state.phase = "POST_BLINDS_ANTES";
                    this.state.ante = p.ante || 0;
                    if (p.ante > 0) {
                        this.state.players.forEach(pl => {
                            if (pl.status === "ACTIVE") {
                                pl.stack -= p.ante;
                                this.state.pot += p.ante;
                            }
                        });
                    }
                    [p.smallBlind, p.bigBlind].forEach(b => {
                        const pl = this.state.players.find(x => x.id === b.playerId);
                        if (pl) {
                            pl.stack -= b.amount;
                            pl.bet = b.amount;
                            this.state.pot += b.amount;
                            if (pl.stack === 0) pl.status = "ALL_IN";
                        }
                    });
                    if (p.bigBlind) this.state.currentBet = p.bigBlind.amount;
                    break;
                case "DEAL_PRIVATE":
                    this.state.phase = "DEAL_PRIVATE";
                    if (p.dealtCards) {
                        Object.keys(p.dealtCards).forEach(pid => {
                            const pl = this.state.players.find(x => x.id === pid);
                            if (pl) pl.holeCards = p.dealtCards[pid];
                        });
                    }
                    break;
                case "PHASE_CHANGE":
                    this.state.phase = p.phase;
                    this.state.activePlayerIndex = p.activePlayerIndex;
                    if (p.pot !== undefined) this.state.pot = p.pot;
                    if (p.sidePots !== undefined) this.state.sidePots = p.sidePots;
                    if (p.phase.endsWith("BETTING") || p.phase === "SHOWDOWN") {
                        this.state.players.forEach(pl => { pl.bet = 0; pl.hasActed = false; });
                        this.state.currentBet = 0;
                    }
                    break;
                case "TURN_ADVANCED":
                    this.state.activePlayerIndex = p.activePlayerIndex;
                    break;
                case "PLAYER_ACTION":
                    const plAction = this.state.players.find(x => x.id === p.playerId);
                    if (plAction) {
                        plAction.hasActed = true;
                        if (p.action === "FOLD") plAction.status = "FOLDED";
                        else if (p.action === "CALL" || p.action === "RAISE" || p.action === "ALL_IN") {
                            plAction.stack -= p.amount;
                            plAction.bet += p.amount;
                            this.state.pot += p.amount;
                            if (plAction.stack === 0) plAction.status = "ALL_IN";
                            if (plAction.bet > this.state.currentBet) {
                                this.state.currentBet = plAction.bet;
                                this.state.players.forEach(other => {
                                    if (other.id !== plAction.id && other.status === "ACTIVE") other.hasActed = false;
                                });
                            }
                        }
                    }
                    break;
                case "DEAL_FLOP":
                case "DEAL_TURN":
                case "DEAL_RIVER":
                    if (p.cards) this.state.board.push(...p.cards);
                    break;
                case "UNCALLED_BET_RETURNED":
                    const plRefund = this.state.players.find(x => x.id === p.playerId);
                    if (plRefund) plRefund.stack += p.amount;
                    break;
                case "WIN":
                case "EARLY_WIN":
                    const plWin = this.state.players.find(x => x.id === p.playerId || (p.winnerId && x.id === p.winnerId));
                    if (plWin) plWin.stack += p.amount;
                    break;
                case "SHOWDOWN":
                    this.state.phase = "SHOWDOWN";
                    break;
                case "HAND_REVEAL":
                    this.state.lastHandReveal = {
                        seed: p.seed,
                        commitment: p.commitment
                    };
                    break;
                case "CLEANUP":
                    this.state.phase = "CLEANUP";
                    break;
            }
        }
    }

    // Helper for tests/init
    addPlayer(player: Player) {
        this.state.players.push(player);
    }
}
