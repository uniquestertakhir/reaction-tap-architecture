// ===== FILE START: apps/web/app/(public)/practice/page.tsx =====
"use client";

import Link from "next/link";
import GameCanvas from "@/components/game/GameCanvas";

export default function PracticePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Practice</h1>
          <Link href="/games" className="text-sm text-white/70 hover:text-white">
  Back
</Link>

        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/80">
            Solo practice. No stakes. No match. Just play.
          </div>
          <div className="mt-2 text-xs text-white/50">
            This mode is for pure gameplay. Multiplayer & betting live in /play.
          </div>
        </div>

        <div className="mt-6">
          <GameCanvas
  canPlay={true}
  onGameEnd={(result: { win?: boolean; score?: number; ms?: number }) => {
    console.log("Practice finished:", result);
  }}
/>

        </div>
      </div>
    </main>
  );
}
// ===== FILE END: apps/web/app/(public)/practice/page.tsx =====
