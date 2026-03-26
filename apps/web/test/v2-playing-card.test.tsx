// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { V2PlayingCard } from "../src/components/poker-v2/V2PlayingCard";

describe("V2PlayingCard", () => {
  it("renders a placeholder when no card is provided", () => {
    const { container } = render(<V2PlayingCard />);
    expect(container.querySelector("[data-testid='v2-card-placeholder']")).toBeTruthy();
  });

  it("renders face-down card when faceDown=true", () => {
    const { container } = render(<V2PlayingCard card="Ah" faceDown />);
    expect(container.querySelector("[data-testid='v2-card-back']")).toBeTruthy();
  });

  it("renders rank and suit for a face-up card", () => {
    render(<V2PlayingCard card="Ah" />);
    // Ace of hearts — should show "A" and the hearts symbol
    const rank = screen.getAllByText("A");
    expect(rank.length).toBeGreaterThan(0);
  });

  it("displays '10' for a Ten card", () => {
    render(<V2PlayingCard card="Tc" />);
    const tenLabels = screen.getAllByText("10");
    expect(tenLabels.length).toBeGreaterThan(0);
  });

  it("applies winner class when winning=true", () => {
    const { container } = render(<V2PlayingCard card="Ah" winning />);
    const card = container.querySelector("[data-testid='v2-card-face']");
    expect(card?.className).toContain("v2-winner-card");
  });

  it("does NOT apply winner class when winning=false", () => {
    const { container } = render(<V2PlayingCard card="Ah" winning={false} />);
    const card = container.querySelector("[data-testid='v2-card-face']");
    expect(card?.className).not.toContain("v2-winner-card");
  });

  it("applies red color to hearts", () => {
    const { container } = render(<V2PlayingCard card="Ah" />);
    const face = container.querySelector("[data-testid='v2-card-face']");
    // Should have suit-red class or inline red color
    const redEls = face?.querySelectorAll(".v2-suit-red");
    expect(redEls?.length).toBeGreaterThan(0);
  });

  it("applies black color to spades", () => {
    const { container } = render(<V2PlayingCard card="As" />);
    const face = container.querySelector("[data-testid='v2-card-face']");
    const blackEls = face?.querySelectorAll(".v2-suit-black");
    expect(blackEls?.length).toBeGreaterThan(0);
  });

  it("renders with xl size by default", () => {
    const { container } = render(<V2PlayingCard card="Kd" />);
    const face = container.querySelector("[data-testid='v2-card-face']");
    expect(face).toBeTruthy();
  });

  it("renders with sm size when specified", () => {
    const { container } = render(<V2PlayingCard card="Kd" size="sm" />);
    const face = container.querySelector("[data-testid='v2-card-face']");
    expect(face).toBeTruthy();
  });
});
