"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 15,
  fontFamily: "var(--font-outfit), sans-serif",
  outline: "none",
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  background: "#eab308",
  color: "#0a0a0a",
  border: "none",
  borderRadius: 8,
  fontSize: 15,
  fontWeight: 700,
  fontFamily: "var(--font-outfit), sans-serif",
  cursor: "pointer",
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      setSuccess(true);
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: 0 }}>
          Check your email
        </h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, margin: 0, lineHeight: 1.5 }}>
          We sent a password reset link to <strong style={{ color: "#fff" }}>{email}</strong>.
        </p>
        <Link
          href="/auth/login"
          style={{ color: "#eab308", textDecoration: "none", fontWeight: 600, fontSize: 14 }}
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: 0, textAlign: "center" }}>
        Reset password
      </h1>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: 0, textAlign: "center" }}>
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        style={inputStyle}
      />

      <button type="submit" disabled={loading} style={{ ...buttonStyle, opacity: loading ? 0.6 : 1 }}>
        {loading ? "Sending..." : "Send reset link"}
      </button>

      {error && (
        <p style={{ color: "#ef4444", fontSize: 14, margin: 0, textAlign: "center" }}>{error}</p>
      )}

      <div style={{ textAlign: "center", fontSize: 14 }}>
        <Link
          href="/auth/login"
          style={{ color: "#eab308", textDecoration: "none", fontWeight: 600 }}
        >
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
