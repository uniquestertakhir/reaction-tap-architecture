// ===== FILE START: apps/web/app/(public)/page.tsx =====
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Reaction Tap</h1>
        <p className="mt-2 text-white/70">
          MVP build. Go to lobby and create / join a match.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/lobby"
            className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black"
          >
            Open Lobby
          </Link>

          <Link
            href="/wallet"
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/90"
          >
            Wallet
          </Link>

          <Link
            href="/cashout-admin"
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/90"
          >
            Cashout Admin
          </Link>
        </div>
      </div>
    </main>
  );
}
// ===== FILE END: apps/web/app/(public)/page.tsx =====
