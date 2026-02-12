// ===== FILE START: apps/web/app/(public)/page.tsx =====
import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Reaction Tap</h1>
      <p>Choose a page:</p>

      <ul style={{ display: "grid", gap: 8, paddingLeft: 18 }}>
        <li><Link href="/lobby">Lobby</Link></li>
        <li><Link href="/play">Play</Link></li>
        <li><Link href="/wallet">Wallet</Link></li>
        <li><Link href="/leaderboard">Leaderboard</Link></li>
        <li><Link href="/cashout-admin">Cashout Admin</Link></li>
      </ul>
    </main>
  );
}
// ===== FILE END: apps/web/app/(public)/page.tsx =====
