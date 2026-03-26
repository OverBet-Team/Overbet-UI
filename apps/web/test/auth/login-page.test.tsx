// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import LoginPage from "@/app/auth/login/page";

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
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
const mockSupabase = { auth: mockAuth };

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

// ---------------------------------------------------------------------------
// OAuthButtons mock — renders identifiable text without real OAuth logic
// ---------------------------------------------------------------------------
vi.mock("@/components/auth/OAuthButtons", () => ({
  default: () => (
    <div data-testid="oauth-buttons">Continue with Google Continue with Discord</div>
  ),
}));

// ---------------------------------------------------------------------------
// window.location mock — allows asserting href assignments
// ---------------------------------------------------------------------------
Object.defineProperty(window, "location", {
  value: { href: "" },
  writable: true,
  configurable: true,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getForm() {
  return screen.getByPlaceholderText("Email").closest("form")!;
}

function fillForm(email: string, password: string) {
  fireEvent.change(screen.getByPlaceholderText("Email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByPlaceholderText("Password"), {
    target: { value: password },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.href = "";
    // Default happy-path responses; individual tests override as needed.
    mockAuth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockAuth.signUp.mockResolvedValue({ data: {}, error: null });
  });

  it("renders login form by default", () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeDefined();
    expect(screen.getByPlaceholderText("Email")).toBeDefined();
    expect(screen.getByPlaceholderText("Password")).toBeDefined();
    // In login mode the submit button says "Sign in"
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDefined();
  });

  it("toggles to signup mode on toggle button click", async () => {
    render(<LoginPage />);

    // In login mode the toggle button says "Sign up" (submit says "Sign in")
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Create account" })).toBeDefined();
    });
    // In signup mode the submit button says "Sign up"
    expect(screen.getByRole("button", { name: "Sign up" })).toBeDefined();
  });

  it("calls signInWithPassword on login submit", async () => {
    render(<LoginPage />);

    fillForm("user@example.com", "secret123");
    fireEvent.submit(getForm());

    await waitFor(() => {
      expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "secret123",
      });
    });
  });

  it("calls signUp with emailRedirectTo ending in /auth/callback?next=/ on signup submit", async () => {
    render(<LoginPage />);

    // Switch to signup mode
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    await waitFor(() => screen.getByRole("heading", { name: "Create account" }));

    fillForm("new@example.com", "newpass123");
    fireEvent.submit(getForm());

    await waitFor(() => {
      expect(mockAuth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "new@example.com",
          password: "newpass123",
          options: expect.objectContaining({
            emailRedirectTo: expect.stringMatching(/\/auth\/callback\?next=\/$/),
          }),
        }),
      );
    });
  });

  it("displays error message on login failure", async () => {
    mockAuth.signInWithPassword.mockRejectedValue(new Error("Invalid credentials"));

    render(<LoginPage />);
    fillForm("user@example.com", "wrongpass");
    fireEvent.submit(getForm());

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeDefined();
    });
  });

  it("displays success message after successful signup", async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    await waitFor(() => screen.getByRole("heading", { name: "Create account" }));

    fillForm("new@example.com", "newpass123");
    fireEvent.submit(getForm());

    await waitFor(() => {
      expect(
        screen.getByText("Check your email for a confirmation link."),
      ).toBeDefined();
    });
  });

  it("shows '...' on submit button while request is pending", async () => {
    // Never-resolving promise keeps the component in loading state indefinitely
    mockAuth.signInWithPassword.mockReturnValue(new Promise(() => {}));

    render(<LoginPage />);
    fillForm("user@example.com", "secret123");
    fireEvent.submit(getForm());

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "..." })).toBeDefined();
    });
  });

  it("renders OAuth buttons with Google and Discord options", () => {
    render(<LoginPage />);

    const oauthContainer = screen.getByTestId("oauth-buttons");
    expect(oauthContainer.textContent).toContain("Continue with Google");
    expect(oauthContainer.textContent).toContain("Continue with Discord");
  });
});
