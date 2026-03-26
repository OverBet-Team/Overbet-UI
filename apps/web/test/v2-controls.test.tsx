// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { V2Controls } from "../src/components/poker-v2/V2Controls";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("V2Controls — inactive state", () => {
  it("renders inactive placeholder when isActive=false", () => {
    const onAction = vi.fn();
    const { container } = render(
      <V2Controls
        isActive={false}
        stack={1000}
        currentBet={0}
        playerBet={0}
        minRaise={20}
        onAction={onAction}
      />
    );
    expect(container.querySelector("[data-testid='v2-controls-inactive']")).toBeTruthy();
  });

  it("does NOT render action buttons when inactive", () => {
    const onAction = vi.fn();
    render(
      <V2Controls
        isActive={false}
        stack={1000}
        currentBet={0}
        playerBet={0}
        minRaise={20}
        onAction={onAction}
      />
    );
    expect(screen.queryByTestId("v2-action-fold")).toBeNull();
  });
});

describe("V2Controls — active state", () => {
  const defaultProps = {
    isActive: true,
    stack: 1000,
    currentBet: 100,
    playerBet: 0,
    minRaise: 200,
    onAction: vi.fn(),
  };

  it("renders action buttons when isActive=true", () => {
    render(<V2Controls {...defaultProps} />);
    expect(screen.getByTestId("v2-action-fold")).toBeTruthy();
    expect(screen.getByTestId("v2-action-check-call")).toBeTruthy();
  });

  it("shows 'Call' label when currentBet > playerBet", () => {
    render(<V2Controls {...defaultProps} currentBet={100} playerBet={0} />);
    expect(screen.getByText(/call/i)).toBeTruthy();
  });

  it("shows 'Check' label when currentBet equals playerBet", () => {
    render(<V2Controls {...defaultProps} currentBet={100} playerBet={100} />);
    expect(screen.getByText(/check/i)).toBeTruthy();
  });

  it("emits FOLD when fold button is clicked", () => {
    const onAction = vi.fn();
    render(<V2Controls {...defaultProps} onAction={onAction} />);
    fireEvent.click(screen.getByTestId("v2-action-fold"));
    expect(onAction).toHaveBeenCalledWith("FOLD");
  });

  it("emits CALL when call button is clicked with outstanding bet", () => {
    const onAction = vi.fn();
    render(<V2Controls {...defaultProps} onAction={onAction} currentBet={100} playerBet={0} />);
    fireEvent.click(screen.getByTestId("v2-action-check-call"));
    expect(onAction).toHaveBeenCalledWith("CALL");
  });

  it("emits CHECK when check button is clicked (no outstanding bet)", () => {
    const onAction = vi.fn();
    render(<V2Controls {...defaultProps} onAction={onAction} currentBet={100} playerBet={100} />);
    fireEvent.click(screen.getByTestId("v2-action-check-call"));
    expect(onAction).toHaveBeenCalledWith("CHECK");
  });

  it("shows raise controls", () => {
    render(<V2Controls {...defaultProps} />);
    expect(screen.getByTestId("v2-action-raise")).toBeTruthy();
  });

  it("emits ALL_IN when all-in button is clicked", () => {
    const onAction = vi.fn();
    render(<V2Controls {...defaultProps} onAction={onAction} />);
    fireEvent.click(screen.getByTestId("v2-action-all-in"));
    expect(onAction).toHaveBeenCalledWith("ALL_IN");
  });

  it("displays current stack", () => {
    render(<V2Controls {...defaultProps} stack={1500} />);
    expect(screen.getByText("1500")).toBeTruthy();
  });
});

describe("V2Controls — keyboard shortcuts", () => {
  it("triggers FOLD on 'f' key", () => {
    const onAction = vi.fn();
    render(
      <V2Controls
        isActive
        stack={1000}
        currentBet={100}
        playerBet={0}
        minRaise={200}
        onAction={onAction}
      />
    );
    fireEvent.keyDown(document, { key: "f" });
    expect(onAction).toHaveBeenCalledWith("FOLD");
  });

  it("triggers CALL/CHECK on 'c' key", () => {
    const onAction = vi.fn();
    render(
      <V2Controls
        isActive
        stack={1000}
        currentBet={100}
        playerBet={0}
        minRaise={200}
        onAction={onAction}
      />
    );
    fireEvent.keyDown(document, { key: "c" });
    expect(onAction).toHaveBeenCalledWith("CALL");
  });

  it("does NOT fire actions on keydown when not active", () => {
    const onAction = vi.fn();
    render(
      <V2Controls
        isActive={false}
        stack={1000}
        currentBet={0}
        playerBet={0}
        minRaise={20}
        onAction={onAction}
      />
    );
    fireEvent.keyDown(document, { key: "f" });
    expect(onAction).not.toHaveBeenCalled();
  });
});
