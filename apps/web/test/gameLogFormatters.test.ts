import { describe, it, expect } from "vitest";
import { getActionLabel } from "../src/lib/gameLogFormatters";

describe("getActionLabel", () => {
  it("returns 'folds' for FOLD", () => {
    expect(getActionLabel("FOLD")).toBe("folds");
  });

  it("returns 'checks' for CHECK", () => {
    expect(getActionLabel("CHECK")).toBe("checks");
  });

  it("returns 'calls' for CALL", () => {
    expect(getActionLabel("CALL")).toBe("calls");
  });

  it("returns 'raises to' for RAISE", () => {
    expect(getActionLabel("RAISE")).toBe("raises to");
  });

  it("returns 'goes ALL-IN' for ALL_IN", () => {
    expect(getActionLabel("ALL_IN")).toBe("goes ALL-IN");
  });

  it("returns lowercase version for unknown action", () => {
    expect(getActionLabel("BET")).toBe("bet");
    expect(getActionLabel("UNKNOWN")).toBe("unknown");
  });
});
