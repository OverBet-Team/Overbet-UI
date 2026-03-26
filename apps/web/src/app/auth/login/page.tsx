"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import OAuthButtons from "@/components/auth/OAuthButtons";

type Mode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` },
        });
        if (error) throw error;
        setMessage({ text: "Check your email for a confirmation link.", isError: false });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/";
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setMessage({ text: msg, isError: true });
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 44,
    padding: "0 14px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    fontSize: 15,
    fontFamily: "var(--font-sans, 'Outfit', sans-serif)",
    outline: "none",
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#fff",
              fontFamily: "var(--font-sans, 'Outfit', sans-serif)",
              margin: 0,
            }}
          >
            {mode === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.5)",
              marginTop: 8,
              fontFamily: "var(--font-sans, 'Outfit', sans-serif)",
            }}
          >
            {mode === "login"
              ? "Sign in to your OverBet account"
              : "Sign up to start playing"}
          </p>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          {message && (
            <p
              style={{
                fontSize: 13,
                color: message.isError ? "#ef4444" : "#22c55e",
                margin: 0,
                textAlign: "center",
              }}
            >
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              height: 44,
              borderRadius: 8,
              border: "none",
              background: "#eab308",
              color: "#000",
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "var(--font-sans, 'Outfit', sans-serif)",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {loading
              ? "..."
              : mode === "login"
                ? "Sign in"
                : "Sign up"}
          </button>
        </form>

        {/* OAuth */}
        <OAuthButtons redirectTo="/" />

        {/* Toggle mode */}
        <p
          style={{
            textAlign: "center",
            fontSize: 14,
            color: "rgba(255,255,255,0.5)",
            margin: 0,
            fontFamily: "var(--font-sans, 'Outfit', sans-serif)",
          }}
        >
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setMessage(null);
            }}
            style={{
              background: "none",
              border: "none",
              color: "#eab308",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              fontFamily: "inherit",
              padding: 0,
            }}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
