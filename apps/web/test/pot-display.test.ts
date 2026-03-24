import { describe, it, expect } from "vitest";
import { getPotDisplayAmounts } from "../src/lib/pot-display";

describe("getPotDisplayAmounts", () => {
  it("handles null or undefined state", () => {
    expect(getPotDisplayAmounts(null)).toEqual({ totalPot: 0, currentRoundAmount: 0 });
    expect(getPotDisplayAmounts(undefined)).toEqual({ totalPot: 0, currentRoundAmount: 0 });
  });

  it("handles an empty state object", () => {
    expect(getPotDisplayAmounts({})).toEqual({ totalPot: 0, currentRoundAmount: 0 });
  });

  it("calculates totalPot with main pot only", () => {
    expect(getPotDisplayAmounts({ pot: 100 })).toEqual({ totalPot: 100, currentRoundAmount: 0 });
  });

  it("calculates totalPot with main pot and side pots", () => {
    const state = {
      pot: 100,
      sidePots: [{ amount: 50 }, { amount: 25 }],
    };
    expect(getPotDisplayAmounts(state)).toEqual({ totalPot: 175, currentRoundAmount: 0 });
  });

  it("calculates currentRoundAmount from player bets", () => {
    const state = {
      players: [{ bet: 10 }, { bet: 20 }, { bet: 0 }],
    };
    expect(getPotDisplayAmounts(state)).toEqual({ totalPot: 0, currentRoundAmount: 30 });
  });

  it("treats negative numbers as 0", () => {
    const state = {
      pot: -50,
      sidePots: [{ amount: -10 }, { amount: 20 }],
      players: [{ bet: -5 }, { bet: 15 }],
    };
    expect(getPotDisplayAmounts(state)).toEqual({ totalPot: 20, currentRoundAmount: 15 });
  });

  it("handles non-finite numbers (NaN, Infinity, -Infinity) by treating them as 0", () => {
    const state = {
      pot: NaN,
      sidePots: [{ amount: Infinity }, { amount: -Infinity }, { amount: 10 }],
      players: [{ bet: NaN }, { bet: Infinity }, { bet: 5 }],
    };
    expect(getPotDisplayAmounts(state)).toEqual({ totalPot: 10, currentRoundAmount: 5 });
  });

  it("handles array elements that are null, undefined, or missing values", () => {
    const state = {
      pot: null,
      sidePots: [null, undefined, {}, { amount: null }, { amount: undefined }, { amount: 10 }] as any,
      players: [null, undefined, {}, { bet: null }, { bet: undefined }, { bet: 10 }] as any,
    };
    expect(getPotDisplayAmounts(state)).toEqual({ totalPot: 10, currentRoundAmount: 10 });
  });

  it("calculates correctly with a full complex state", () => {
    const state = {
      pot: 100,
      sidePots: [{ amount: 50 }, { amount: 50 }],
      players: [{ bet: 10 }, { bet: 10 }, { bet: 20 }],
    };
    expect(getPotDisplayAmounts(state)).toEqual({ totalPot: 200, currentRoundAmount: 40 });
  });
});
