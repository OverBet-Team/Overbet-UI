"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  // Recovery session must be confirmed before the form is usable.
  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const [sessionCheckDone, setSessionCheckDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Supabase fires PASSWORD_RECOVERY when the user arrives via the reset
    // email link. Without this event the page is not safe to use.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoverySession(true);
      }
      setSessionCheckDone(true);
    });

    // Fallback: if onAuthStateChange doesn't fire quickly (direct navigation
    // without a recovery token), mark check as done after a short wait.
    const timeout = setTimeout(() => setSessionCheckDone(true), 1500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.updateUser({ password });

      if (authError) {
        setError(authError.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/"), 2000);
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  if (!sessionCheckDone) {
    return null;
  }

  if (!isRecoverySession) {
    return (
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: 0 }}>
          Invalid or expired link
        </h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, margin: 0, lineHeight: 1.5 }}>
          This password reset link is invalid or has already been used.
        </p>
        <Link
          href="/auth/forgot-password"
          style={{ color: "#eab308", textDecoration: "none", fontWeight: 600, fontSize: 14 }}
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: 0 }}>
          Password updated
        </h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, margin: 0 }}>
          Redirecting you to the app...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: 0, textAlign: "center" }}>
        Set new password
      </h1>

      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
        style={inputStyle}
      />

      <input
        type="password"
        placeholder="Confirm new password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        style={inputStyle}
      />

      <button type="submit" disabled={loading} style={{ ...buttonStyle, opacity: loading ? 0.6 : 1 }}>
        {loading ? "Updating..." : "Update password"}
      </button>

      {error && (
        <p style={{ color: "#ef4444", fontSize: 14, margin: 0, textAlign: "center" }}>{error}</p>
      )}
    </form>
  );
}
