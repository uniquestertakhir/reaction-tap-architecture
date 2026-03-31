// ===== FILE START: apps/web/app/(public)/games/match-3-rush/play/page.tsx =====
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import GameCanvas from "@/components/game/GameCanvas";
import GamePlayShell from "@/components/game/GamePlayShell";
import { getGameMeta } from "@/lib/games/registry";

function Match3RushPlayInner() {
  const sp = useSearchParams();

  const mode = (sp.get("mode") || "warm-up").trim();
  const entry = (sp.get("entry") || "").trim();

  const meta = getGameMeta("match-3-rush");
  const defaultReturnTo =
    meta.routes?.modesHref || "/games/match-3-rush/modes";

  const returnTo = (sp.get("returnTo") || defaultReturnTo).trim();

  return (
    <GamePlayShell
      title="Match 3 Rush"
      subtitle="Dedicated Match 3 Rush runtime through platform canvas dispatch."
      modeLabel={mode}
      entryLabel={entry ? `$${Number(entry).toFixed(2)}` : undefined}
      returnTo={returnTo}
      backgroundClassName="bg-[radial-gradient(1200px_700px_at_50%_-120px,rgba(255,255,255,0.20),transparent_55%),linear-gradient(180deg,#ec4899_0%,#8b5cf6_48%,#312e81_100%)]"
    >
      <GameCanvas gameId="match-3-rush" />
    </GamePlayShell>
  );
}

export default function Match3RushPlayPage() {
  return (
    <Suspense fallback={null}>
      <Match3RushPlayInner />
    </Suspense>
  );
}
// ===== FILE END: apps/web/app/(public)/games/match-3-rush/play/page.tsx =====