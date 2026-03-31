// ===== FILE START: apps/web/app/(public)/games/[gameId]/page.tsx =====
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getGameMeta } from "@/lib/games/registry";

export default function GameModesPage() {
  const router = useRouter();
  const params = useParams<{ gameId: string }>();
  const gameId = String(params?.gameId || "").trim().toLowerCase();

  const meta = getGameMeta(gameId);
  const exists = meta.id !== "unknown";

  useEffect(() => {
    if (!exists) return;

    const target = meta.routes?.modesHref || `/games/${gameId}/modes`;
    router.replace(target);
  }, [exists, meta.routes?.modesHref, gameId, router]);

  if (!exists) {
    return (
      <div className="p-6 text-center text-white">
        <div className="text-2xl font-bold">Game not found</div>
        <div className="mt-2 text-white/60">
          This game does not exist in the platform registry.
        </div>

        <Link
          href="/games"
          className="mt-4 inline-block rounded-xl bg-white px-4 py-2 font-semibold text-black"
        >
          Back to Games
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 text-center text-white">
      <div className="text-sm text-white/70">Redirecting to game modes…</div>
    </div>
  );
}
// ===== FILE END: apps/web/app/(public)/games/[gameId]/page.tsx =====