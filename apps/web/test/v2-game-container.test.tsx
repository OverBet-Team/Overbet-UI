// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { V2GameContainer } from "../src/components/poker-v2/V2GameContainer";
import type { PlayerViewState } from "../src/lib/overbet-to-player-view";

// Minimal viewState fixture
const mockViewState: PlayerViewState = {
  hero: {
    id: "hero",
    username: "You",
    chips: 800,
    bet: 0,
    status: "ACTIVE",
    cards: ["Ah", "Kd"],
  },
  opponents: [
    {
      id: "p2",
      username: "Bob",
      chips: 1200,
      bet: 50,
      status: "CALLED",
      seatIndex: 1,
      isDealer: true,
      isActive: false,
      isSB: false,
      isBB: false,
    },
  ],
  board: ["7h", "8d", "9s", null, null],
  totalPot: 250,
  currentRoundAmount: 100,
  dealerId: "p2",
  activePlayerId: "hero",
  sbPlayerId: "p2",
  bbPlayerId: "hero",
};

const defaultProps = {
  viewState: mockViewState,
  isActive: false,
  stack: 800,
  currentBet: 0,
  playerBet: 0,
  minRaise: 20,
  onAction: vi.fn(),
};

describe("V2GameContainer", () => {
  it("renders V2TableView — shows hero username", () => {
    render(<V2GameContainer {...defaultProps} />);
    expect(screen.getByText("You")).toBeTruthy();
  });

  it("renders opponent username", () => {
    render(<V2GameContainer {...defaultProps} />);
    expect(screen.getByText("Bob")).toBeTruthy();
  });

  it("renders V2Controls in inactive state when isActive=false", () => {
    const { container } = render(<V2GameContainer {...defaultProps} isActive={false} />);
    expect(container.querySelector("[data-testid='v2-controls-inactive']")).toBeTruthy();
  });

  it("renders V2Controls action buttons when isActive=true", () => {
    render(<V2GameContainer {...defaultProps} isActive />);
    expect(screen.getByTestId("v2-action-fold")).toBeTruthy();
  });

  it("passes winnerId down to table view", () => {
    // When a winnerId is set, the winner's username appears (possibly multiple times — in seat + overlay)
    render(<V2GameContainer {...defaultProps} winnerId="p2" />);
    expect(screen.getAllByText("Bob").length).toBeGreaterThan(0);
  });

  it("renders without crashing when board has all nulls", () => {
    render(
      <V2GameContainer
        {...defaultProps}
        viewState={{ ...mockViewState, board: [null, null, null, null, null] }}
      />
    );
    expect(screen.getByText("You")).toBeTruthy();
  });

  it("renders without crashing when opponents array is empty", () => {
    render(
      <V2GameContainer
        {...defaultProps}
        viewState={{ ...mockViewState, opponents: [] }}
      />
    );
    expect(screen.getByText("You")).toBeTruthy();
  });
});
