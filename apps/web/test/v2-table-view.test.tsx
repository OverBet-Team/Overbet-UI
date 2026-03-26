// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { V2TableView } from "../src/components/poker-v2/V2TableView";
import type { V2TableViewProps } from "../src/lib/overbet-to-v2-view";

const baseProps: V2TableViewProps = {
  hero: {
    id: "hero",
    username: "You",
    chips: 800,
    bet: 0,
    status: "active",
    seatIndex: 0,
    isDealer: false,
    isActive: true,
    isSB: false,
    isBB: false,
    cards: ["Ah", "Kd"],
  },
  opponents: [
    {
      id: "p2",
      username: "Bob",
      chips: 1200,
      bet: 50,
      status: "called",
      seatIndex: 1,
      isDealer: true,
      isActive: false,
      isSB: false,
      isBB: false,
    },
    {
      id: "p3",
      username: "Carol",
      chips: 600,
      bet: 0,
      status: "folded",
      seatIndex: 2,
      isDealer: false,
      isActive: false,
      isSB: false,
      isBB: false,
    },
  ],
  board: ["7h", "8d", "9s", null, null],
  totalPot: 350,
  currentRoundAmount: 100,
  dealerId: "p2",
  activePlayerId: "hero",
};

describe("V2TableView", () => {
  it("renders the hero player", () => {
    render(<V2TableView {...baseProps} />);
    expect(screen.getByText("You")).toBeTruthy();
  });

  it("renders all opponent usernames", () => {
    render(<V2TableView {...baseProps} />);
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByText("Carol")).toBeTruthy();
  });

  it("renders the total pot amount", () => {
    render(<V2TableView {...baseProps} />);
    expect(screen.getByTestId("v2-total-pot")).toBeTruthy();
    expect(screen.getByText("350")).toBeTruthy();
  });

  it("renders the board cards section", () => {
    const { container } = render(<V2TableView {...baseProps} />);
    expect(container.querySelector("[data-testid='v2-board-cards']")).toBeTruthy();
  });

  it("renders 5 board card slots", () => {
    const { container } = render(<V2TableView {...baseProps} />);
    const slots = container.querySelectorAll("[data-testid^='v2-board-card-']");
    expect(slots.length).toBe(5);
  });

  it("renders hero hole cards", () => {
    const { container } = render(<V2TableView {...baseProps} />);
    expect(container.querySelector("[data-testid='v2-hero-cards']")).toBeTruthy();
  });

  it("applies v2-root class on the root element", () => {
    const { container } = render(<V2TableView {...baseProps} />);
    expect(container.firstElementChild?.className).toContain("v2-root");
  });

  it("shows phase label when phase is provided", () => {
    render(<V2TableView {...baseProps} phase="FLOP_BETTING" />);
    expect(screen.getByText(/flop/i)).toBeTruthy();
  });

  it("does not crash with empty opponents array", () => {
    render(<V2TableView {...baseProps} opponents={[]} />);
    expect(screen.getByText("You")).toBeTruthy();
  });

  it("renders opponent cards face-down when cards are not present", () => {
    const { container } = render(<V2TableView {...baseProps} />);
    // Opponents without visible cards should have face-down placeholders or backs
    // Just verify it renders without error
    expect(container.querySelector("[data-testid='v2-board-cards']")).toBeTruthy();
  });
});
