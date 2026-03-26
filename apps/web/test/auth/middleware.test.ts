import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures mock objects are available before vi.mock factories run.
const { mockNextResponse, mockGetUser, mockSupabaseClient } = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  return {
    mockGetUser,
    mockNextResponse: { cookies: { set: vi.fn(), getAll: vi.fn(() => []) } },
    mockSupabaseClient: { auth: { getUser: mockGetUser } },
  };
});

vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn(() => mockNextResponse),
  },
}));

// Mock @supabase/ssr so createServerClient returns a controllable client.
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
}));

// Import after mocks are registered.
import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse } from "next/server";

// Minimal NextRequest stub — only the surface updateSession touches.
function makeRequest() {
  return {
    cookies: {
      getAll: () => [],
      set: vi.fn(),
    },
    url: "http://localhost:3000/",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal stub for NextRequest
  } as any;
}

describe("updateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-arm NextResponse.next after clearAllMocks resets return values.
    (NextResponse.next as ReturnType<typeof vi.fn>).mockReturnValue(mockNextResponse);
  });

  it("returns response and user when session exists", async () => {
    const fakeUser = { id: "user-1", email: "user@example.com" };
    mockGetUser.mockResolvedValueOnce({ data: { user: fakeUser }, error: null });

    const result = await updateSession(makeRequest());

    expect(result.user).toBe(fakeUser);
    expect(result.response).toBe(mockNextResponse);
  });

  it("returns user as null when no session", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const result = await updateSession(makeRequest());

    expect(result.user).toBeNull();
  });

  it("calls getUser for verification, not getSession", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    await updateSession(makeRequest());

    expect(mockGetUser).toHaveBeenCalledTimes(1);
    // Confirm only getUser is wired — getSession must not be on the mock.
    expect(mockSupabaseClient.auth).not.toHaveProperty("getSession");
  });
});
