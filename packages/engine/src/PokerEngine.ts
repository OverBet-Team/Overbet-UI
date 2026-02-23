import { GameState, PokerAction, HandEvent } from "./types";

export interface PokerEngine {
    /**
     * Initialize a new hand with the given settings
     */
    startHand(settings?: any): HandEvent[];

    /**
     * Process a player action
     */
    handleAction(playerId: string, action: PokerAction): HandEvent[];

    /**
     * End the hand and calculate payouts
     */
    endHand(): HandEvent[];

    /**
     * Returns current game state 
     */
    getState(): GameState;

    /**
     * Hydrate engine state from past events
     */
    loadEvents(events: HandEvent[]): void;
}
