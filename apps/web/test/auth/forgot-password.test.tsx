// @vitest-environment jsdom

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── Mocks ─────────────────────────────────────────────────────────────── */

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
  onAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: mockAuth }),
}));

/* ── Subject ────────────────────────────────────────────────────────────── */

import ForgotPasswordPage from "@/app/auth/forgot-password/page";

/* ── Tests ──────────────────────────────────────────────────────────────── */

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email input and submit button", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByPlaceholderText("Email")).toBeTruthy();
    expect(screen.getByRole("button", { name: /send reset link/i })).toBeTruthy();
  });

  it("calls resetPasswordForEmail on submit with correct email and redirectTo", async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith(
        "test@example.com",
        { redirectTo: expect.stringContaining("/auth/update-password") },
      );
    });
  });

  it("shows success state after sending", async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "user@test.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeTruthy();
    });
    // The submitted email address must appear in the success message.
    expect(screen.getByText("user@test.com")).toBeTruthy();
  });

  it("shows error on failure", async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({
      error: { message: "User not found" },
    });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "bad@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText("User not found")).toBeTruthy();
    });
  });
});
