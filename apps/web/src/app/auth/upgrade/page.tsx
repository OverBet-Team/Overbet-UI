"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

const MIN_PASSWORD_LENGTH = 6;

export default function UpgradePage() {
  const { user, isReady } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Not loaded yet — render nothing to avoid flash.
  if (!isReady) return null;

  // No session at all — redirect to login.
  if (!user) {
    router.replace("/auth/login");
    return null;
  }

  // Already a permanent account.
  if (user.is_anonymous !== true) {
    return (
      <div style={containerStyle}>
        <h1 style={headingStyle}>You already have an account</h1>
        <p style={subheadingStyle}>
          Signed in as{" "}
          <span style={{ color: "#fff" }}>{user.email ?? user.id}</span>
        </p>
        <Link href="/" style={linkStyle}>
          ← Back to home
        </Link>
      </div>
    );
  }

  // Success state — brief confirmation before redirect.
  if (success) {
    return (
      <div style={containerStyle}>
        <h1 style={headingStyle}>Account created!</h1>
        <p style={subheadingStyle}>
          Check your email to confirm. Redirecting…
        </p>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side validation.
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        email,
        password,
      });

      if (updateError) {
        // Surface Supabase-specific errors (e.g. "email already registered").
        setError(updateError.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.replace("/"), 3000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={containerStyle}>
      <h1 style={headingStyle}>Create Your Account</h1>
      <p style={subheadingStyle}>
        Link an email and password to keep your game history and stats
      </p>

      <form onSubmit={handleSubmit} style={formStyle}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          style={inputStyle}
        />

        {error && <p style={errorStyle}>{error}</p>}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <p style={sessionIdStyle}>
        Current session: {user.id.slice(0, 8)}…
      </p>

      <Link href="/" style={linkStyle}>
        Cancel
      </Link>
    </div>
  );
}

/* ---------- Styles ---------- */

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100%",
  padding: "40px 20px",
  fontFamily: "var(--font-outfit), sans-serif",
};

const headingStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 600,
  color: "#fff",
  margin: "0 0 8px",
};

const subheadingStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "rgba(255,255,255,0.5)",
  margin: "0 0 32px",
  textAlign: "center",
  maxWidth: "360px",
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  width: "100%",
  maxWidth: "360px",
};

const inputStyle: React.CSSProperties = {
  padding: "12px 14px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "14px",
  fontFamily: "var(--font-outfit), sans-serif",
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  padding: "12px",
  background: "#eab308",
  color: "#000",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: 600,
  fontFamily: "var(--font-outfit), sans-serif",
  cursor: "pointer",
  marginTop: "4px",
};

const errorStyle: React.CSSProperties = {
  color: "#ef4444",
  fontSize: "13px",
  margin: 0,
};

const sessionIdStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "rgba(255,255,255,0.25)",
  marginTop: "24px",
};

const linkStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.4)",
  fontSize: "13px",
  textDecoration: "none",
  marginTop: "12px",
};
