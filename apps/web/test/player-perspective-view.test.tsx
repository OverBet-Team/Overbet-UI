// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayerPerspectiveView } from "../src/components/poker/PlayerPerspectiveView";

describe("PlayerPerspectiveView", () => {
  it("renders separate total-pot and current-round indicators", () => {
    render(
      <PlayerPerspectiveView
        viewState={{
          hero: {
            id: "u1",
            username: "Alice",
            chips: 1200,
            bet: 20,
            status: "ACTIVE",
            cards: ["As", "Kh"],
          },
          opponents: [
            {
              id: "u2",
              username: "Bob",
              chips: 980,
              bet: 30,
              status: "ACTIVE",
              seatIndex: 1,
              cards: [],
              isDealer: true,
              isActive: false,
              isSB: false,
              isBB: false,
            },
          ],
          board: ["2c", "7d", "Jh", null, null],
          totalPot: 240,
          currentRoundAmount: 50,
          dealerId: "u2",
          activePlayerId: "u1",
          sbPlayerId: "",
          bbPlayerId: "",
          phase: "TURN_BETTING",
        }}
      />,
    );

    expect(screen.getByText("Total Pot")).toBeDefined();
    expect(document.body.textContent).toContain("240");

    const roundIndicator = screen.getByTestId("current-round-indicator");
    expect(roundIndicator.textContent).toContain("Round");
    expect(roundIndicator.textContent).toContain("50");
  });
});
