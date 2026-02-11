// ===== FILE START: apps/web/app/page.tsx =====
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-6 py-20">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <h1 className="text-3xl font-semibold tracking-tight">Reaction Tap</h1>
          <p className="mt-3 text-white/80">
            A skill-based reaction challenge. No randomness. Pure speed and precision.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/lobby"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-black font-medium"
            >
              Start
            </Link>

            <div className="flex gap-3">
              <Link
                href="/leaderboard"
                className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/15 px-4 py-3 text-white/90"
              >
                Leaderboard
              </Link>
              <Link
                href="/wallet"
                className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/15 px-4 py-3 text-white/90"
              >
                Wallet
              </Link>
            </div>
          </div>

          <p className="mt-6 text-xs text-white/50">
            Early MVP: UI only. Next step: game screen + score + local run record.
          </p>
        </div>
      </div>
    </main>
  );
}
// ===== FILE END: apps/web/app/page.tsx =====
