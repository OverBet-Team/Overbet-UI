import { PokerEngine } from "../PokerEngine";
import { GameState, PokerAction, HandEvent, Player } from "../types";
import { DeckUtility } from "../utils/Deck";
import * as crypto from "crypto";
import * as PokerEvaluator from 'poker-evaluator';

export class NLHMachine implements PokerEngine {
    private state: GameState;
    private eventSequence: number = 0;

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

        // Ensure we have active players
        const activePlayers = this.state.players.filter(p => ["ACTIVE", "ALL_IN"].includes(p.status));
        if (activePlayers.length < 2) {
            throw new Error("Not enough active players to start a hand");
        }

        // HAND_INIT
        const seedBuffer = crypto.randomBytes(4);
        const seed = seedBuffer.readUInt32BE(0);

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
            if (p.status !== "SITTING_OUT" && p.status !== "BUSTED") {
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
            seed,
            dealerIndex: this.state.dealerIndex,
            players: this.state.players.map(p => ({ id: p.id, status: p.status, stack: p.stack }))
        }));

        // POST_BLINDS_ANTES
        this.state.phase = "POST_BLINDS_ANTES";
        let sbIndex = (this.state.dealerIndex + 1) % this.state.players.length;
        // In heads up, dealer is SB.
        if (activePlayers.length === 2) {
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
                if (!action.amount || action.amount <= 0) {
                    throw new Error("Must specify amount to raise");
                }
                amountAdded = action.amount;
                if (amountAdded > player.stack) {
                    amountAdded = player.stack; // auto convert to all in
                }

                // Has to be at least min raise
                const totalNewBet = player.bet + amountAdded;
                if (totalNewBet < this.state.currentBet + this.state.minRaise && amountAdded < player.stack) {
                    throw new Error(`Raise must be at least ${this.state.minRaise}`);
                }

                if (totalNewBet > this.state.currentBet) {
                    const raiseAmount = totalNewBet - this.state.currentBet;
                    if (raiseAmount > this.state.minRaise) {
                        this.state.minRaise = raiseAmount;
                    }
                    this.state.currentBet = totalNewBet;
                    // Reset hasActed for everyone else
                    this.state.players.forEach(p => {
                        if (p.id !== player.id && p.status === "ACTIVE") {
                            p.hasActed = false;
                        }
                    });
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
            events.push(this.createEvent("EARLY_WIN", { winnerId: activeOrAllIn[0].id, amount: this.state.pot }));
            this.state.players.forEach(p => {
                if (p.id === activeOrAllIn[0].id) {
                    p.stack += this.state.pot;
                }
            });
            this.endHand(events);
            return;
        }

        // Is round over?
        // Everyone active has acted AND their bet == currentBet (or they are all in)
        const roundOver = activeOnly.every(p => p.hasActed && p.bet === this.state.currentBet) || activeOnly.length <= 1;

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
        // Collect bets into pots (skip side pot math for basic MVP, assume single pot)
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
            this.handleRoundEnd(events);
            return;
        }

        // Active player is first active after dealer
        let nextInd = (this.state.dealerIndex + 1) % this.state.players.length;
        while (this.state.players[nextInd].status !== "ACTIVE") {
            nextInd = (nextInd + 1) % this.state.players.length;
        }
        this.state.activePlayerIndex = nextInd;

        events.push(this.createEvent("PHASE_CHANGE", { phase: this.state.phase, activePlayerIndex: this.state.activePlayerIndex }));
    }

    private dealCards(events: HandEvent[], phaseName: string, count: number) {
        this.state.phase = phaseName as any; // Temporary transition to log dealing event
        const dealt = [];
        for (let i = 0; i < count; i++) {
            const c = this.state.deck.pop();
            if (c) dealt.push(c);
        }
        this.state.board.push(...dealt);
        events.push(this.createEvent(phaseName, { cards: dealt }));
    }

    private evaluateShowdown(events: HandEvent[]) {
        this.state.phase = "SHOWDOWN";
        events.push(this.createEvent("SHOWDOWN", { board: [...this.state.board] }));

        const showdownPlayers = this.state.players.filter(p => ["ACTIVE", "ALL_IN"].includes(p.status));

        let bestValue = -1;
        let winners: Player[] = [];

        showdownPlayers.forEach(p => {
            const handCards = [...p.holeCards, ...this.state.board];
            const evaluation = PokerEvaluator.evalHand(handCards);
            if (evaluation.value > bestValue) {
                bestValue = evaluation.value;
                winners = [p];
            } else if (evaluation.value === bestValue) {
                winners.push(p);
            }
        });

        // Simplified Split Pot logic (single pot assumption for MVP)
        const winAmount = Math.floor(this.state.pot / winners.length);
        const remainder = this.state.pot % winners.length;

        winners.forEach((w, idx) => {
            const amount = winAmount + (idx === 0 ? remainder : 0);
            w.stack += amount;

            const handCards = [...w.holeCards, ...this.state.board];
            const evaluation = PokerEvaluator.evalHand(handCards);

            events.push(this.createEvent("WIN", {
                playerId: w.id,
                amount,
                handName: evaluation.handName
            }));
        });
        this.endHand(events);
    }

    endHand(eventsArray?: HandEvent[]): HandEvent[] {
        const events: HandEvent[] = eventsArray || [];
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
            // Replay events to hydrate state (e.g. for reconnects or engine spins)
            this.eventSequence = Math.max(this.eventSequence, ev.sequence);
            // TODO: Reducer logic to update this.state based on ev.type
        }
    }

    // Helper for tests/init
    addPlayer(player: Player) {
        this.state.players.push(player);
    }
}
