// @vitest-environment jsdom

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* ── Mocks ─────────────────────────────────────────────────────────────── */

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockAuth = {
  getUser: vi.fn(),
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithOAuth: vi.fn(),
  updateUser: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onAuthStateChange: vi.fn((_cb: (event: string, session: unknown) => void) => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: mockAuth }),
}));

/* ── Subject ────────────────────────────────────────────────────────────── */

import UpdatePasswordPage from "@/app/auth/update-password/page";

/* ── Helpers ────────────────────────────────────────────────────────────── */

// Filled in beforeEach once onAuthStateChange is captured.
let authChangeCallback: (event: string, session: unknown) => void;

/* ── Tests ──────────────────────────────────────────────────────────────── */

describe("UpdatePasswordPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // Capture the onAuthStateChange callback so individual tests can fire it.
    mockAuth.onAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      authChangeCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing until session check completes", () => {
    // Neither the timeout nor the auth callback has fired — component returns null.
    const { container } = render(<UpdatePasswordPage />);
    expect(container.innerHTML).toBe('');
  });

  it("shows invalid link when no recovery event arrives before the timeout", () => {
    render(<UpdatePasswordPage />);

    // Advance past the 1500ms fallback; no PASSWORD_RECOVERY was fired.
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText("Invalid or expired link")).toBeTruthy();
  });

  it("shows form when PASSWORD_RECOVERY event is received", () => {
    render(<UpdatePasswordPage />);

    act(() => {
      authChangeCallback("PASSWORD_RECOVERY", null);
    });

    expect(screen.getByPlaceholderText("New password")).toBeTruthy();
    expect(screen.getByPlaceholderText("Confirm new password")).toBeTruthy();
    expect(screen.getByRole("button", { name: /update password/i })).toBeTruthy();
  });

  it("shows error when passwords do not match", async () => {
    render(<UpdatePasswordPage />);

    act(() => {
      authChangeCallback("PASSWORD_RECOVERY", null);
    });

    fireEvent.change(screen.getByPlaceholderText("New password"), {
      target: { value: "abc123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirm new password"), {
      target: { value: "xyz789" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    });

    expect(screen.getByText("Passwords do not match.")).toBeTruthy();
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });

  it("calls updateUser with the new password on valid submit", async () => {
    mockAuth.updateUser.mockResolvedValue({ error: null });
    render(<UpdatePasswordPage />);

    act(() => {
      authChangeCallback("PASSWORD_RECOVERY", null);
    });

    fireEvent.change(screen.getByPlaceholderText("New password"), {
      target: { value: "securePass1" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirm new password"), {
      target: { value: "securePass1" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    });

    expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: "securePass1" });
  });
});
