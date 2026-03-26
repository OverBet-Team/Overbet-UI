// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

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

const mockUpdateUser = vi.fn();
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
    signInAnonymously: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signInWithOAuth: vi.fn(),
    updateUser: mockUpdateUser,
    resetPasswordForEmail: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  },
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

// Mutable auth value so each test can override it.
let mockAuthValue: {
  isReady: boolean;
  user: { id: string; email?: string; is_anonymous?: boolean } | null;
  userId: string;
  accessToken: string | null;
};

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => mockAuthValue,
}));

/* ── Subject ────────────────────────────────────────────────────────────── */

import UpgradePage from "@/app/auth/upgrade/page";

/* ── Helpers ────────────────────────────────────────────────────────────── */

const anonymousUser = { id: "anon-uuid-1234", is_anonymous: true };
const permanentUser = { id: "perm-uuid-5678", email: "alice@example.com", is_anonymous: false };

function renderPage() {
  return render(<UpgradePage />);
}

/* ── Tests ──────────────────────────────────────────────────────────────── */

describe("UpgradePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: not ready, no user.
    mockAuthValue = { isReady: false, user: null, userId: "", accessToken: null };
  });

  it("renders nothing when isReady is false", () => {
    mockAuthValue = { isReady: false, user: null, userId: "", accessToken: null };
    const { container } = renderPage();
    expect(container.innerHTML).toBe("");
  });

  it("redirects to /auth/login when there is no user", () => {
    mockAuthValue = { isReady: true, user: null, userId: "", accessToken: null };
    const { container } = renderPage();
    expect(mockReplace).toHaveBeenCalledWith("/auth/login");
    expect(container.innerHTML).toBe("");    
  });

  it("shows already-have-account message for non-anonymous user", () => {
    mockAuthValue = {
      isReady: true,
      user: permanentUser,
      userId: permanentUser.id,
      accessToken: "tok",
    };
    renderPage();
    expect(screen.getByText(/you already have an account/i)).toBeTruthy();
  });

  it("renders the upgrade form for an anonymous user", () => {
    mockAuthValue = {
      isReady: true,
      user: anonymousUser,
      userId: anonymousUser.id,
      accessToken: "tok",
    };
    renderPage();
    expect(screen.getByPlaceholderText(/email/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/^password/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/confirm password/i)).toBeTruthy();
  });

  it("shows an error when passwords do not match", async () => {
    mockAuthValue = {
      isReady: true,
      user: anonymousUser,
      userId: anonymousUser.id,
      accessToken: "tok",
    };
    renderPage();

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^password/i), {
      target: { value: "password1" },
    });
    fireEvent.change(screen.getByPlaceholderText(/confirm password/i), {
      target: { value: "password2" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeTruthy();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("calls updateUser with email and password on valid submit", async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    mockAuthValue = {
      isReady: true,
      user: anonymousUser,
      userId: anonymousUser.id,
      accessToken: "tok",
    };
    renderPage();

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^password/i), {
      target: { value: "secret123" },
    });
    fireEvent.change(screen.getByPlaceholderText(/confirm password/i), {
      target: { value: "secret123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "secret123",
      });
    });

    expect(screen.getByText(/account created!/i)).toBeTruthy();
  });
});
