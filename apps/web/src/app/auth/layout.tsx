import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "var(--font-outfit), sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link
            href="/"
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: "#eab308",
              textDecoration: "none",
              letterSpacing: "-0.02em",
            }}
          >
            OverBet
          </Link>
        </div>

        {children}

        <div style={{ textAlign: "center", marginTop: 32 }}>
          <Link
            href="/"
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
