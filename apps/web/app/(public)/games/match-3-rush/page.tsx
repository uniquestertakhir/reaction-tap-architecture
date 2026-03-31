// ===== FILE START: apps/web/app/(public)/games/match-3-rush/page.tsx =====
"use client";

import Link from "next/link";
import { getGameMeta } from "@/lib/games/registry";

export default function Match3RushPage() {
  const meta = getGameMeta("match-3-rush");

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto max-w-[520px] px-4 py-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="text-center">
            <div className="text-5xl">{meta.icon}</div>
            <h1 className="mt-3 text-2xl font-extrabold">{meta.title}</h1>
            <p className="mt-2 text-sm text-white/70">{meta.subtitle}</p>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Link
              href={meta.routes?.modesHref || "/games"}
              className="w-full rounded-2xl bg-white px-4 py-3 text-center text-sm font-bold text-black"
            >
              Play
            </Link>

            <Link
              href="/games"
              className="w-full rounded-2xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white/80"
            >
              Back to Games
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
// ===== FILE END: apps/web/app/(public)/games/match-3-rush/page.tsx =====