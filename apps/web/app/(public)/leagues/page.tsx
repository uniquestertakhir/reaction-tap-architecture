// ===== FILE START: apps/web/app/(public)/leagues/page.tsx =====
"use client";

import Link from "next/link";

export default function LeaguesPage() {
  return (
    <main className="min-h-screen text-white">
      <div className="min-h-screen bg-[radial-gradient(1200px_800px_at_50%_-200px,rgba(255,255,255,0.18),transparent_60%),linear-gradient(180deg,#6b21a8_0%,#3b0a7a_40%,#170027_100%)]">
        <div className="mx-auto max-w-md px-4 pb-28 pt-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Leagues</h1>
            <Link href="/games" className="text-sm text-white/70 hover:text-white">
              Back to Games
            </Link>
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)]">
            <div className="text-sm font-semibold">Coming next</div>
            <div className="mt-2 text-sm text-white/70">
              Здесь будет таблица лиг/дивизионов, сезоны, и прогресс игрока — как в Blitz.
              Сейчас это экран-заглушка для UI-скелета.
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs text-white/60">Preview</div>
              <div className="mt-2 space-y-2">
                {[
                  { name: "Bronze League", rank: "—", note: "Play to enter" },
                  { name: "Silver League", rank: "Locked", note: "Coming soon" },
                  { name: "Gold League", rank: "Locked", note: "Coming soon" },
                ].map((x) => (
                  <div
                    key={x.name}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <div>
                      <div className="font-semibold">{x.name}</div>
                      <div className="text-xs text-white/60">{x.note}</div>
                    </div>
                    <div className="text-sm text-white/70">{x.rank}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <Link
                href="/games"
                className="flex-1 rounded-2xl bg-white px-5 py-3 text-center font-medium text-black"
              >
                Open Games
              </Link>
              <Link
                href="/results"
                className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center font-medium text-white"
              >
                Results
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
// ===== FILE END: apps/web/app/(public)/leagues/page.tsx =====
