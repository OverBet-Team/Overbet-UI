import { describe, it, expect } from 'vitest';
import { toPlayerViewState } from '../src/lib/overbet-to-player-view';

describe('toPlayerViewState', () => {
  it('includes phase in viewState for cleanup Show All support', () => {
    const players = [
      { id: 'u1', username: 'Alice', chips: 1000, seatIndex: 0, status: 'ACTIVE', cards: [] },
      { id: 'u2', username: 'Bob', chips: 1000, seatIndex: 1, status: 'ACTIVE', cards: [] },
    ];
    const gameState = {
      phase: 'CLEANUP',
      board: ['As', 'Kh', 'Qd', 'Js', '10c'],
      pot: 0,
      dealerId: 'u1',
      activePlayerId: 'u2',
      players: [{ id: 'u1', stack: 1000 }, { id: 'u2', stack: 1000 }],
    };
    const view = toPlayerViewState(players as any, gameState, 'u1');
    expect(view).not.toBeNull();
    expect(view!.phase).toBe('CLEANUP');
    expect(view!.board).toHaveLength(5);
    expect(view!.board.every((c) => c !== undefined)).toBe(true);
  });

  it('resets board to 5 slots with nulls for missing cards', () => {
    const players = [
      { id: 'u1', username: 'Alice', chips: 1000, seatIndex: 0, status: 'ACTIVE', cards: [] },
    ];
    const gameState = { phase: 'FLOP_BETTING', board: ['As', 'Kh', 'Qd'], pot: 100 };
    const view = toPlayerViewState(players as any, gameState, 'u1');
    expect(view).not.toBeNull();
    expect(view!.board).toHaveLength(5);
    expect(view!.board[0]).toBe('As');
    expect(view!.board[3]).toBeNull();
  });
});
