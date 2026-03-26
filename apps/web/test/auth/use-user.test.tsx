// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useUser } from "../../src/hooks/useUser";

let mockAuthReturn: { userId: string; accessToken: string | null; isReady: boolean; user: null } = { userId: "", accessToken: null, isReady: false, user: null };

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => mockAuthReturn,
}));

describe("useUser", () => {
  beforeEach(() => {
    mockAuthReturn = { userId: "", accessToken: null, isReady: false, user: null };
  });

  it("returns userId from auth context", () => {
    mockAuthReturn = { userId: "test-uuid-123", accessToken: null, isReady: true, user: null };
    const { result } = renderHook(() => useUser());
    expect(result.current.userId).toBe("test-uuid-123");
  });

  it("returns accessToken from auth context", () => {
    mockAuthReturn = { userId: "some-user", accessToken: "jwt-abc", isReady: true, user: null };
    const { result } = renderHook(() => useUser());
    expect(result.current.accessToken).toBe("jwt-abc");
  });

  it("returns empty userId when not authenticated", () => {
    mockAuthReturn = { userId: "", accessToken: null, isReady: false, user: null };
    const { result } = renderHook(() => useUser());
    expect(result.current.userId).toBe("");
  });
});
