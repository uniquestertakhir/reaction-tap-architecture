// ===== FILE START: apps/web/app/(public)/page.tsx =====
import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        Reaction Tap
      </h1>

      <p style={{ opacity: 0.8, marginBottom: 16 }}>
        MVP: lobby → play → wallet → cashout admin
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/lobby">Go to Lobby</Link>
        <Link href="/play">Play</Link>
        <Link href="/wallet">Wallet</Link>
        <Link href="/cashout-admin">Cashout Admin</Link>
      </div>
    </main>
  );
}
// ===== FILE END: apps/web/app/(public)/page.tsx =====
