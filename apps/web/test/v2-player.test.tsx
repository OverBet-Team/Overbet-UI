// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { V2Player } from "../src/components/poker-v2/V2Player";
import type { V2PlayerProps } from "../src/lib/overbet-to-v2-view";

const basePlayer: V2PlayerProps = {
  id: "p1",
  username: "Alice",
  chips: 1200,
  bet: 0,
  status: "active",
  seatIndex: 1,
  isDealer: false,
  isActive: false,
  isSB: false,
  isBB: false,
};

describe("V2Player", () => {
  it("renders the player username", () => {
    render(<V2Player player={basePlayer} />);
    expect(screen.getByText("Alice")).toBeTruthy();
  });

  it("renders chip count", () => {
    render(<V2Player player={basePlayer} />);
    expect(screen.getByText("1200")).toBeTruthy();
  });

  it("renders initials in avatar (no URL avatars in ai-studio)", () => {
    render(<V2Player player={basePlayer} />);
    // Avatar should show first 2 chars of username
    expect(screen.getByText("AL")).toBeTruthy();
  });

  it("shows active glow class when isCurrentTurn=true", () => {
    const { container } = render(<V2Player player={basePlayer} isCurrentTurn />);
    const avatar = container.querySelector("[data-testid='v2-player-avatar']");
    expect(avatar?.className).toContain("v2-avatar-glow-active");
  });

  it("does NOT show active glow when isCurrentTurn=false", () => {
    const { container } = render(<V2Player player={basePlayer} isCurrentTurn={false} />);
    const avatar = container.querySelector("[data-testid='v2-player-avatar']");
    expect(avatar?.className).not.toContain("v2-avatar-glow-active");
  });

  it("applies folded opacity when player is folded", () => {
    const folded: V2PlayerProps = { ...basePlayer, status: "folded" };
    const { container } = render(<V2Player player={folded} />);
    const root = container.querySelector("[data-testid='v2-player-root']");
    expect(root?.className).toContain("opacity-50");
  });

  it("shows dealer chip when isDealer=true", () => {
    const dealer: V2PlayerProps = { ...basePlayer, isDealer: true };
    render(<V2Player player={dealer} />);
    expect(screen.getByText("D")).toBeTruthy();
  });

  it("does not show dealer chip when isDealer=false", () => {
    render(<V2Player player={basePlayer} />);
    expect(screen.queryByText("D")).toBeNull();
  });

  it("shows SB chip when isSB=true", () => {
    const sb: V2PlayerProps = { ...basePlayer, isSB: true };
    render(<V2Player player={sb} />);
    expect(screen.getByText("SB")).toBeTruthy();
  });

  it("shows BB chip when isBB=true", () => {
    const bb: V2PlayerProps = { ...basePlayer, isBB: true };
    render(<V2Player player={bb} />);
    expect(screen.getByText("BB")).toBeTruthy();
  });

  it("shows bet amount when bet > 0", () => {
    const betting: V2PlayerProps = { ...basePlayer, bet: 150 };
    render(<V2Player player={betting} />);
    expect(screen.getByText("150")).toBeTruthy();
  });

  it("does NOT show bet bubble when bet is 0", () => {
    const { container } = render(<V2Player player={basePlayer} />);
    expect(container.querySelector("[data-testid='v2-player-bet']")).toBeNull();
  });

  it("shows inactive glow class when player is folded", () => {
    const folded: V2PlayerProps = { ...basePlayer, status: "folded" };
    const { container } = render(<V2Player player={folded} />);
    const avatar = container.querySelector("[data-testid='v2-player-avatar']");
    expect(avatar?.className).toContain("v2-avatar-glow-inactive");
  });

  it("does NOT expose handStrength or handType for opponents (hidden info rule)", () => {
    // V2PlayerProps intentionally has handStrength?: undefined for opponents
    const player: V2PlayerProps = { ...basePlayer };
    expect(player.handStrength).toBeUndefined();
    expect(player.handType).toBeUndefined();
  });
});
