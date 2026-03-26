import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUIVersion } from "../src/hooks/useUIVersion";

describe("useUIVersion", () => {
  beforeEach(() => {
    // Reset location search before each test
    Object.defineProperty(window, "location", {
      value: { search: "" },
      writable: true,
      configurable: true,
    });
  });

  it("returns v1 by default when no query param is present", async () => {
    const { result } = renderHook(() => useUIVersion());
    await act(async () => {});
    expect(result.current.uiVersion).toBe("v1");
  });

  it("returns v2 when ?ui=v2 is in the URL", async () => {
    Object.defineProperty(window, "location", {
      value: { search: "?ui=v2" },
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useUIVersion());
    await act(async () => {});
    expect(result.current.uiVersion).toBe("v2");
  });

  it("returns v1 for any other ?ui= value", async () => {
    Object.defineProperty(window, "location", {
      value: { search: "?ui=v3" },
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useUIVersion());
    await act(async () => {});
    expect(result.current.uiVersion).toBe("v1");
  });

  it("returns v1 when ?ui=v1 is explicitly set", async () => {
    Object.defineProperty(window, "location", {
      value: { search: "?ui=v1" },
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useUIVersion());
    await act(async () => {});
    expect(result.current.uiVersion).toBe("v1");
  });

  it("handles ?ui=v2 with additional query params", async () => {
    Object.defineProperty(window, "location", {
      value: { search: "?room=abc&ui=v2&debug=true" },
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useUIVersion());
    await act(async () => {});
    expect(result.current.uiVersion).toBe("v2");
  });
});
