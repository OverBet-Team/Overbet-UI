import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock references ──────────────────────────────────────────────────
// vi.mock factories are hoisted above imports; vi.hoisted ensures these refs
// are available inside the factory closures.

const mockRedirect = vi.hoisted(() => vi.fn());
const mockExchangeCodeForSession = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() => vi.fn());

// ── next/server mock ─────────────────────────────────────────────────────────
// NextRequest and NextResponse are Next.js edge-runtime constructs unavailable
// in a plain vitest/node environment. We provide just enough surface area to
// exercise the route handler logic.
vi.mock("next/server", () => {
  // Extends URL so pathname and searchParams are natively mutable.
  class MockNextUrl extends URL {
    clone(): MockNextUrl {
      return new MockNextUrl(this.toString());
    }
  }

  class MockNextRequest {
    nextUrl: MockNextUrl;
    constructor(url: string | URL) {
      this.nextUrl = new MockNextUrl(
        typeof url === "string" ? url : url.toString(),
      );
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: { redirect: mockRedirect },
  };
});

// ── Supabase server mock ──────────────────────────────────────────────────────
vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

// Import after mocks are registered so the route handler picks up the mocks.
import { GET } from "@/app/auth/callback/route";
import { NextRequest } from "next/server";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3000/auth/callback");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  // Cast: our mock satisfies the interface the route handler needs.
  return new NextRequest(url) as unknown as NextRequest;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: exchange succeeds with no error.
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    mockCreateClient.mockResolvedValue({
      auth: { exchangeCodeForSession: mockExchangeCodeForSession },
    });
    // NextResponse.redirect returns a sentinel so tests can inspect the URL.
    mockRedirect.mockImplementation((url: URL) => ({
      type: "redirect",
      url: url.toString(),
    }));
  });

  it("exchanges code and redirects to the next param", async () => {
    const req = makeRequest({ code: "abc", next: "/room/xyz" });
    await GET(req);

    expect(mockExchangeCodeForSession).toHaveBeenCalledOnce();
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("abc");

    expect(mockRedirect).toHaveBeenCalledOnce();
    const redirectArg: URL = mockRedirect.mock.calls[0][0];
    expect(redirectArg.pathname).toBe("/room/xyz");
    // code and next must be stripped from the redirect URL
    expect(redirectArg.searchParams.has("code")).toBe(false);
    expect(redirectArg.searchParams.has("next")).toBe(false);
  });

  it("redirects to / when no next param is provided", async () => {
    const req = makeRequest({ code: "abc" });
    await GET(req);

    expect(mockExchangeCodeForSession).toHaveBeenCalledOnce();

    expect(mockRedirect).toHaveBeenCalledOnce();
    const redirectArg: URL = mockRedirect.mock.calls[0][0];
    expect(redirectArg.pathname).toBe("/");
    expect(redirectArg.searchParams.has("code")).toBe(false);
  });

  it("redirects to /auth/login when no code param is present", async () => {
    const req = makeRequest({});
    await GET(req);

    // No exchange attempt without a code
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();

    expect(mockRedirect).toHaveBeenCalledOnce();
    const redirectArg: URL = mockRedirect.mock.calls[0][0];
    expect(redirectArg.pathname).toBe("/auth/login");
    expect(redirectArg.searchParams.has("code")).toBe(false);
    expect(redirectArg.searchParams.has("next")).toBe(false);
  });

  it("redirects to /auth/login when the code exchange fails", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: "invalid code" },
    });

    const req = makeRequest({ code: "bad", next: "/room/xyz" });
    await GET(req);

    expect(mockExchangeCodeForSession).toHaveBeenCalledOnce();
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("bad");

    expect(mockRedirect).toHaveBeenCalledOnce();
    const redirectArg: URL = mockRedirect.mock.calls[0][0];
    expect(redirectArg.pathname).toBe("/auth/login");
    expect(redirectArg.searchParams.has("code")).toBe(false);
    expect(redirectArg.searchParams.has("next")).toBe(false);
  });
});
