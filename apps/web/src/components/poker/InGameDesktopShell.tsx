"use client";

import React from "react";

interface InGameDesktopShellProps {
  title: string;
  meta: React.ReactNode;
  utility: React.ReactNode;
  rail?: React.ReactNode;
  table: React.ReactNode;
  footerLeft: React.ReactNode;
  footerCenter: React.ReactNode;
  footerRight: React.ReactNode;
}

export function InGameDesktopShell({
  title,
  meta,
  utility,
  rail,
  table,
  footerLeft,
  footerCenter,
  footerRight,
}: InGameDesktopShellProps) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        padding: 18,
        background:
          "radial-gradient(circle at 18% 18%, rgba(210, 180, 255, 0.26), transparent 30%), radial-gradient(circle at 82% 10%, rgba(149, 121, 255, 0.22), transparent 28%), linear-gradient(135deg, #8069dd 0%, #d6baf8 100%)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "min(100%, 1440px)",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          borderRadius: 30,
          overflow: "hidden",
          background: "linear-gradient(180deg, rgba(14,13,24,0.98) 0%, rgba(11,10,20,0.99) 100%)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 40px 120px rgba(27, 12, 76, 0.28), 0 20px 60px rgba(0,0,0,0.28)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 50% 22%, rgba(122, 85, 255, 0.12), transparent 28%), radial-gradient(circle at 80% 6%, rgba(255,255,255,0.06), transparent 22%)",
            pointerEvents: "none",
          }}
        />

        <header
          style={{
            position: "relative",
            zIndex: 2,
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            gap: 20,
            padding: "20px 28px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(11, 10, 20, 0.88)",
            backdropFilter: "blur(18px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "radial-gradient(circle at 30% 30%, #7f6bff 0%, #5b45ff 100%)",
                boxShadow: "0 14px 26px rgba(97, 76, 255, 0.34)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
                <path d="M12 22s7-5.1 7-12a7 7 0 1 0-14 0c0 6.9 7 12 7 12Z" />
                <circle cx="12" cy="10" r="2.5" fill="white" stroke="none" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ color: "#ffffff", fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>
                OverBet
              </span>
              <span style={{ color: "rgba(255,255,255,0.36)", fontSize: 11, fontWeight: 600 }}>
                {title}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>{meta}</div>
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>{utility}</div>
        </header>

        <div style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "20px 24px 0" }}>
          <div
            style={{
              position: "relative",
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              borderRadius: 26,
              overflow: "hidden",
            }}
          >
            {rail ? (
              <div
                style={{
                  position: "absolute",
                  top: 18,
                  left: 18,
                  zIndex: 5,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {rail}
              </div>
            ) : null}
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{table}</div>
          </div>
        </div>

        <footer
          style={{
            position: "relative",
            zIndex: 2,
            display: "grid",
            gridTemplateColumns: "auto minmax(0, 1fr) auto",
            gap: 20,
            alignItems: "end",
            padding: "16px 24px 24px",
            background: "linear-gradient(180deg, rgba(11,10,20,0) 0%, rgba(11,10,20,0.84) 22%, rgba(11,10,20,0.96) 100%)",
          }}
        >
          <div style={{ minWidth: 0 }}>{footerLeft}</div>
          <div style={{ minWidth: 0, display: "flex", justifyContent: "center" }}>{footerCenter}</div>
          <div style={{ minWidth: 0, display: "flex", justifyContent: "flex-end" }}>{footerRight}</div>
        </footer>
      </div>
    </div>
  );
}
