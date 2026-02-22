// ===== FILE START: apps/web/app/(public)/solo/page.tsx =====
"use client";

import Link from "next/link";
import GameCanvas from "@/components/game/GameCanvas";

export default function SoloPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Solo</h1>
          <Link href="/lobby" className="text-sm text-white/70 hover:text-white">
            Back
          </Link>
        </div>

        <div className="mt-6">
          <GameCanvas canPlay={true} />
        </div>
      </div>
    </main>
  );
}
// ===== FILE END: apps/web/app/(public)/solo/page.tsx =====
