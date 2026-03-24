"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";

/**
 * Subtle banner nudging anonymous users to create a permanent account.
 * Renders nothing for authenticated (non-anonymous) users.
 * Dismissible per session via local state.
 */
export function UpgradePrompt() {
  const { user, isReady } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (!isReady || !user || user.is_anonymous !== true || dismissed) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        height: "40px",
        background: "rgba(0,0,0,0.4)",
        border: "1px solid rgba(234,179,8,0.2)",
        borderRadius: "6px",
        padding: "0 12px",
        fontFamily: "var(--font-outfit), sans-serif",
        fontSize: "13px",
        color: "rgba(255,255,255,0.6)",
      }}
    >
      <span>Playing as guest</span>
      <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
      <Link
        href="/auth/upgrade"
        style={{
          color: "#eab308",
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        Create account to save progress
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          background: "none",
          border: "none",
          color: "rgba(255,255,255,0.35)",
          cursor: "pointer",
          fontSize: "16px",
          lineHeight: 1,
          padding: "0 0 0 4px",
          marginLeft: "auto",
        }}
      >
        ✕
      </button>
    </div>
  );
}
