// ===== FILE START: apps/web/app/(public)/practice/page.tsx =====
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import GameCanvas from "@/components/game/GameCanvas";

type EndResult = { win?: boolean; score?: number; ms?: number };

export default function PracticePage() {
  const sp = useSearchParams();
  const mode = (sp.get("mode") || "warm-up").trim();
  const gameId = (sp.get("gameId") || "reaction-tap").trim();

  const [isPlaying, setIsPlaying] = useState(false);
  const [last, setLast] = useState<EndResult | null>(null);
  const score = typeof last?.score === "number" ? last!.score : null;

  const modeLabel = useMemo(() => {
    if (!mode) return "Warm up";
    return mode
      .split(/[-_]/g)
      .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
      .join(" ");
  }, [mode]);

  return (
    <main className="min-h-screen bg-black text-white">
      {/* ===== TOP BAR (hidden during gameplay) ===== */}
      <div className={isPlaying ? "hidden" : ""}>
        <div className="mx-auto max-w-xl px-6 py-10">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Practice</h1>
            <Link href="/games" className="text-sm text-white/70 hover:text-white">
              Back
            </Link>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-white/80">
              Solo practice. No stakes. Just play.
            </div>
            <div className="mt-2 text-xs text-white/50">
              {gameId} • mode: {modeLabel}
            </div>
          </div>
        </div>
      </div>

      {/* ===== GAME AREA (always visible) ===== */}
      <div className={isPlaying ? "px-0" : "mx-auto max-w-xl px-6 pb-10"}>
        <GameCanvas
          canPlay={true}
          onGameEnd={(r) => {
            // GameCanvas already controls its own end screen,
            // we just update page UI state.
            setLast(r);
            setIsPlaying(false);
          }}
        />

        {/* ===== RESULTS PANEL (page-level, after game) ===== */}
        {!isPlaying && last && (
          <div className="mx-auto max-w-xl px-6 pb-10">
            <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <div className="text-xs text-white/50">Last run</div>
              <div className="mt-1 text-2xl font-semibold">
                {score !== null ? score : "—"} <span className="text-white/40 text-base">score</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link
                  href={`/practice?gameId=${encodeURIComponent(gameId)}&mode=${encodeURIComponent(mode)}`}
                  className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-black"
                  onClick={() => {
                    // We want the next run to feel fullscreen immediately.
                    setIsPlaying(true);
                    setLast(null);
                  }}
                >
                  Play again
                </Link>

                <Link
                  href="/results"
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center text-sm font-semibold text-white"
                >
                  Results
                </Link>

                <Link
                  href="/games"
                  className="col-span-2 rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-center text-sm font-semibold text-white/90"
                >
                  Back to Games
                </Link>
              </div>

              <div className="mt-3 text-[11px] text-white/50">
                Tip: Practice rewards 💎 (see HUD gems).
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
// ===== FILE END: apps/web/app/(public)/practice/page.tsx =====