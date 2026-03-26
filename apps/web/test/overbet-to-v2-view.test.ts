import { describe, it, expect } from "vitest";
import {
  parseCard,
  toV2Player,
  toV2Hero,
  toV2TableProps,
} from "../src/lib/overbet-to-v2-view";
import type { PlayerViewState } from "../src/lib/overbet-to-player-view";
import type { TurnTimer } from "../src/components/poker/Seat";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockOpponent = {
  id: "p2",
  username: "Bob",
  chips: 800,
  bet: 50,
  status: "ACTIVE",
  seatIndex: 1,
  isDealer: true,
  isActive: false,
  isSB: true,
  isBB: false,
  cards: ["Ah", "Kh"],
};

const mockHero = {
  id: "u1",
  username: "Hero",
  chips: 900,
  bet: 100,
  status: "ACTIVE",
  cards: ["Qd", "Js"],
};

const mockViewState: PlayerViewState = {
  hero: mockHero,
  opponents: [mockOpponent],
  board: ["As", "Kd", "Qc", null, null],
  totalPot: 300,
  currentRoundAmount: 50,
  dealerId: "p2",
  activePlayerId: "u1",
  sbPlayerId: "p2",
  bbPlayerId: "u1",
  phase: "FLOP_BETTING",
};

// ── parseCard ─────────────────────────────────────────────────────────────────

describe("parseCard", () => {
  it("parses ace of hearts", () => {
    expect(parseCard("Ah")).toEqual({ rank: "A", suit: "h", displayRank: "A" });
  });

  it("parses ten as displayRank '10'", () => {
    expect(parseCard("Tc")).toEqual({ rank: "T", suit: "c", displayRank: "10" });
    expect(parseCard("Td")).toEqual({ rank: "T", suit: "d", displayRank: "10" });
  });

  it("parses all suits", () => {
    expect(parseCard("2h")?.suit).toBe("h");
    expect(parseCard("3d")?.suit).toBe("d");
    expect(parseCard("4s")?.suit).toBe("s");
    expect(parseCard("5c")?.suit).toBe("c");
  });

  it("parses all face card ranks", () => {
    expect(parseCard("Js")?.rank).toBe("J");
    expect(parseCard("Qh")?.rank).toBe("Q");
    expect(parseCard("Kd")?.rank).toBe("K");
    expect(parseCard("As")?.rank).toBe("A");
  });

  it("returns null for empty string", () => {
    expect(parseCard("")).toBeNull();
  });

  it("returns null for single character", () => {
    expect(parseCard("A")).toBeNull();
  });
});

// ── toV2Player ────────────────────────────────────────────────────────────────

describe("toV2Player", () => {
  it("normalises ACTIVE status to lowercase", () => {
    expect(toV2Player(mockOpponent).status).toBe("active");
  });

  it("normalises FOLDED status to lowercase", () => {
    expect(toV2Player({ ...mockOpponent, status: "FOLDED" }).status).toBe("folded");
  });

  it("normalises CALLED status", () => {
    expect(toV2Player({ ...mockOpponent, status: "CALLED" }).status).toBe("called");
  });

  it("normalises RAISED status", () => {
    expect(toV2Player({ ...mockOpponent, status: "RAISED" }).status).toBe("raised");
  });

  it("normalises ALL_IN status", () => {
    expect(toV2Player({ ...mockOpponent, status: "ALL_IN" }).status).toBe("all_in");
  });

  it("maps core fields correctly", () => {
    const v2 = toV2Player(mockOpponent);
    expect(v2.id).toBe("p2");
    expect(v2.username).toBe("Bob");
    expect(v2.chips).toBe(800);
    expect(v2.bet).toBe(50);
    expect(v2.seatIndex).toBe(1);
    expect(v2.isDealer).toBe(true);
    expect(v2.isActive).toBe(false);
    expect(v2.isSB).toBe(true);
    expect(v2.isBB).toBe(false);
  });

  it("does NOT expose handStrength for opponents (hidden information rule)", () => {
    const v2 = toV2Player(mockOpponent);
    expect(v2.handStrength).toBeUndefined();
  });

  it("does NOT expose handType for opponents", () => {
    const v2 = toV2Player(mockOpponent);
    expect(v2.handType).toBeUndefined();
  });

  it("returns a new object (immutable — no mutation of input)", () => {
    const v2 = toV2Player(mockOpponent);
    expect(v2).not.toBe(mockOpponent);
  });

  it("handles opponent with no cards (pre-deal)", () => {
    const v2 = toV2Player({ ...mockOpponent, cards: undefined });
    expect(v2.cards).toBeUndefined();
  });

  it("handles zero chips edge case", () => {
    expect(toV2Player({ ...mockOpponent, chips: 0 }).chips).toBe(0);
  });

  it("handles zero bet edge case", () => {
    expect(toV2Player({ ...mockOpponent, bet: 0 }).bet).toBe(0);
  });

  it("falls back to 'active' for unknown status", () => {
    expect(toV2Player({ ...mockOpponent, status: "UNKNOWN_STATE" }).status).toBe("active");
  });
});

// ── toV2Hero ──────────────────────────────────────────────────────────────────

describe("toV2Hero", () => {
  it("maps core fields", () => {
    const v2 = toV2Hero(mockHero);
    expect(v2.id).toBe("u1");
    expect(v2.username).toBe("Hero");
    expect(v2.chips).toBe(900);
    expect(v2.bet).toBe(100);
    expect(v2.cards).toEqual(["Qd", "Js"]);
  });

  it("normalises hero status to lowercase", () => {
    expect(toV2Hero(mockHero).status).toBe("active");
    expect(toV2Hero({ ...mockHero, status: "ALL_IN" }).status).toBe("all_in");
  });

  it("returns a new object (immutable)", () => {
    expect(toV2Hero(mockHero)).not.toBe(mockHero);
  });
});

// ── toV2TableProps ────────────────────────────────────────────────────────────

describe("toV2TableProps", () => {
  it("builds full v2 table props from PlayerViewState", () => {
    const props = toV2TableProps(mockViewState);
    expect(props.hero.id).toBe("u1");
    expect(props.opponents).toHaveLength(1);
    expect(props.board).toHaveLength(5);
    expect(props.totalPot).toBe(300);
    expect(props.currentRoundAmount).toBe(50);
    expect(props.phase).toBe("FLOP_BETTING");
  });

  it("derives hero isActive from viewState.activePlayerId", () => {
    const props = toV2TableProps(mockViewState);
    expect(props.hero.isActive).toBe(true); // activePlayerId === hero.id
  });

  it("derives hero isBB from viewState.bbPlayerId", () => {
    const props = toV2TableProps(mockViewState);
    expect(props.hero.isBB).toBe(true); // bbPlayerId === hero.id
  });

  it("derives hero isDealer=false when dealerId != hero.id", () => {
    const props = toV2TableProps(mockViewState);
    expect(props.hero.isDealer).toBe(false); // dealerId === "p2"
  });

  it("derives hero isSB=false when sbPlayerId != hero.id", () => {
    const props = toV2TableProps(mockViewState);
    expect(props.hero.isSB).toBe(false); // sbPlayerId === "p2"
  });

  it("normalises all opponent statuses to lowercase", () => {
    const props = toV2TableProps(mockViewState);
    expect(props.opponents[0].status).toBe("active");
  });

  it("passes through turnTimer when provided", () => {
    const timer: TurnTimer = {
      playerId: "u1",
      expiresAt: Date.now() + 10000,
      total: 30000,
      phase: "base",
      timeBankMs: 5000,
    };
    const props = toV2TableProps(mockViewState, timer);
    expect(props.turnTimer).toBe(timer);
  });

  it("defaults turnTimer to undefined when not provided", () => {
    const props = toV2TableProps(mockViewState);
    expect(props.turnTimer).toBeUndefined();
  });

  it("preserves board nulls for unrevealed card slots", () => {
    const props = toV2TableProps(mockViewState);
    expect(props.board[3]).toBeNull();
    expect(props.board[4]).toBeNull();
  });

  it("handles empty opponents array", () => {
    const props = toV2TableProps({ ...mockViewState, opponents: [] });
    expect(props.opponents).toHaveLength(0);
  });

  it("returns a new object (immutable)", () => {
    const props = toV2TableProps(mockViewState);
    expect(props).not.toBe(mockViewState);
    expect(props.opponents).not.toBe(mockViewState.opponents);
  });
});
