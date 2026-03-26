// @vitest-environment jsdom

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider, useAuth } from "@/components/providers/AuthProvider";

// ---------------------------------------------------------------------------
// Module-level mock — must be hoisted before any import that touches the module
// ---------------------------------------------------------------------------

const mockUnsubscribe = vi.fn();

const mockAuth = {
  getUser: vi.fn(),
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onAuthStateChange: vi.fn((_cb: (event: string, session: unknown) => void) => ({
    data: { subscription: { unsubscribe: mockUnsubscribe } },
  })),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: mockAuth }),
}));

// ---------------------------------------------------------------------------
// Test consumer — renders context values as data-testid spans
// ---------------------------------------------------------------------------

function AuthConsumer() {
  const { userId, accessToken, isReady, user } = useAuth();
  return (
    <div>
      <span data-testid="user-id">{userId}</span>
      <span data-testid="access-token">{accessToken ?? "null"}</span>
      <span data-testid="is-ready">{String(isReady)}</span>
      <span data-testid="user-json">{user ? "present" : "absent"}</span>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Always provide a valid subscription object so cleanup never throws.
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });
  });

  it("reuses existing verified session", async () => {
    // getUser() returns a verified user → getSession() supplies the session.
    // signInAnonymously must NOT be called.
    const user = { id: "user-abc", email: "test@example.com" };
    const session = {
      user,
      access_token: "jwt-abc",
      refresh_token: "ref-abc",
    };

    mockAuth.getUser.mockResolvedValue({ data: { user } });
    mockAuth.getSession.mockResolvedValue({ data: { session } });

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("is-ready").textContent).toBe("true"),
    );

    expect(screen.getByTestId("user-id").textContent).toBe("user-abc");
    expect(screen.getByTestId("access-token").textContent).toBe("jwt-abc");
    expect(screen.getByTestId("user-json").textContent).toBe("present");
    expect(mockAuth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("falls back to anonymous sign-in when no user", async () => {
    // getUser() returns null → provider calls signInAnonymously().
    // getSession() must NOT be called.
    const anonUser = { id: "anon-xyz" };
    const anonSession = {
      user: anonUser,
      access_token: "anon-token",
      refresh_token: "anon-ref",
    };

    mockAuth.getUser.mockResolvedValue({ data: { user: null } });
    mockAuth.signInAnonymously.mockResolvedValue({
      data: { session: anonSession },
      error: null,
    });

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("is-ready").textContent).toBe("true"),
    );

    expect(screen.getByTestId("user-id").textContent).toBe("anon-xyz");
    expect(screen.getByTestId("access-token").textContent).toBe("anon-token");
    expect(mockAuth.signInAnonymously).toHaveBeenCalledOnce();
    expect(mockAuth.getSession).not.toHaveBeenCalled();
  });

  it("handles anonymous sign-in failure gracefully", async () => {
    // Even when signInAnonymously errors, isReady must become true so the app
    // doesn't hang. The error is surfaced via console.error.
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const error = { message: "network error" };

    mockAuth.getUser.mockResolvedValue({ data: { user: null } });
    mockAuth.signInAnonymously.mockResolvedValue({
      data: { session: null },
      error,
    });

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("is-ready").textContent).toBe("true"),
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      "[AuthProvider] Anonymous sign-in failed:",
      error.message,
    );
    // No session means empty userId and null accessToken.
    expect(screen.getByTestId("user-id").textContent).toBe("");
    expect(screen.getByTestId("access-token").textContent).toBe("null");

    consoleSpy.mockRestore();
  });

  it("handles getUser success but getSession returning null", async () => {
    // Server verified the user but the local session cookie is missing.
    // The provider hits the defensive else-branch and marks isReady without
    // a session — no anonymous sign-in should be attempted.
    const user = { id: "user-def" };

    mockAuth.getUser.mockResolvedValue({ data: { user } });
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("is-ready").textContent).toBe("true"),
    );

    expect(screen.getByTestId("user-id").textContent).toBe("");
    expect(screen.getByTestId("access-token").textContent).toBe("null");
    expect(screen.getByTestId("user-json").textContent).toBe("absent");
    expect(mockAuth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("exposes userId from session user", async () => {
    const user = { id: "abc-123" };
    const session = { user, access_token: "some-token" };

    mockAuth.getUser.mockResolvedValue({ data: { user } });
    mockAuth.getSession.mockResolvedValue({ data: { session } });

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("is-ready").textContent).toBe("true"),
    );

    expect(screen.getByTestId("user-id").textContent).toBe("abc-123");
  });

  it("exposes accessToken from session", async () => {
    const user = { id: "user-tok" };
    const session = { user, access_token: "jwt-token-xyz" };

    mockAuth.getUser.mockResolvedValue({ data: { user } });
    mockAuth.getSession.mockResolvedValue({ data: { session } });

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("is-ready").textContent).toBe("true"),
    );

    expect(screen.getByTestId("access-token").textContent).toBe(
      "jwt-token-xyz",
    );
  });

  it("updates session on onAuthStateChange", async () => {
    // Start with an anonymous session, then simulate a live auth event
    // (e.g. TOKEN_REFRESHED or SIGNED_IN after identity linking).
    const anonUser = { id: "anon-1" };
    const anonSession = { user: anonUser, access_token: "anon-jwt" };

    mockAuth.getUser.mockResolvedValue({ data: { user: null } });
    mockAuth.signInAnonymously.mockResolvedValue({
      data: { session: anonSession },
      error: null,
    });

    // Capture the callback so we can invoke it later.
    let authStateCallback: (event: string, session: unknown) => void =
      () => {};
    mockAuth.onAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      authStateCallback = cb;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("is-ready").textContent).toBe("true"),
    );

    // Baseline: anonymous session values are present.
    expect(screen.getByTestId("user-id").textContent).toBe("anon-1");

    // Fire a new session through the live subscription.
    const newUser = { id: "linked-user-99" };
    const newSession = { user: newUser, access_token: "new-jwt-999" };

    act(() => {
      authStateCallback("TOKEN_REFRESHED", newSession);
    });

    await waitFor(() =>
      expect(screen.getByTestId("user-id").textContent).toBe("linked-user-99"),
    );

    expect(screen.getByTestId("access-token").textContent).toBe("new-jwt-999");
  });
});
