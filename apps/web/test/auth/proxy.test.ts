import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures these are available before vi.mock factories run.
const { mockUpdateSession, mockRedirect } = vi.hoisted(() => ({
  mockUpdateSession: vi.fn(),
  mockRedirect: vi.fn((url: URL) => ({ redirected: true, url: url.toString() })),
}));

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: mockUpdateSession,
}));

vi.mock("next/server", () => ({
  NextResponse: {
    redirect: mockRedirect,
    next: vi.fn(() => ({ cookies: { set: vi.fn() } })),
  },
}));

import proxy from "@/proxy";

// Minimal NextRequest stub — only the surface proxy touches.
function makeRequest(pathname: string) {
  const url = new URL(`http://localhost:3000${pathname}`);
  return {
    nextUrl: { pathname, clone: () => new URL(url) },
    url: url.toString(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal stub for NextRequest
  } as any;
}

const passthroughResponse = { cookies: { set: vi.fn() } };
const authenticatedUser = { id: "user-1", email: "user@example.com" };

describe("proxy middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes through non-room routes regardless of auth", async () => {
    mockUpdateSession.mockResolvedValueOnce({ response: passthroughResponse, user: null });

    const request = makeRequest("/");
    const result = await proxy(request);

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBe(passthroughResponse);
  });

  it("passes through /room/* when user is authenticated", async () => {
    mockUpdateSession.mockResolvedValueOnce({
      response: passthroughResponse,
      user: authenticatedUser,
    });

    const request = makeRequest("/room/abc");
    const result = await proxy(request);

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBe(passthroughResponse);
  });

  it("redirects /room/* to /auth/login when no user", async () => {
    mockUpdateSession.mockResolvedValueOnce({ response: passthroughResponse, user: null });

    const request = makeRequest("/room/abc");
    await proxy(request);

    expect(mockRedirect).toHaveBeenCalledTimes(1);
    const redirectUrl: URL = mockRedirect.mock.calls[0][0];
    expect(redirectUrl.pathname).toBe("/auth/login");
    expect(redirectUrl.searchParams.get("next")).toBe("/room/abc");
  });

  it("preserves the full path in the next query parameter", async () => {
    mockUpdateSession.mockResolvedValueOnce({ response: passthroughResponse, user: null });

    const request = makeRequest("/room/xyz123/settings");
    await proxy(request);

    expect(mockRedirect).toHaveBeenCalledTimes(1);
    const redirectUrl: URL = mockRedirect.mock.calls[0][0];
    expect(redirectUrl.searchParams.get("next")).toBe("/room/xyz123/settings");
  });
});
