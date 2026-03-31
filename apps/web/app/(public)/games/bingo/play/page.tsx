// ===== FILE START: apps/web/app/(public)/games/bingo/play/page.tsx =====
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import GameCanvas from "@/components/game/GameCanvas";
import GamePlayShell from "@/components/game/GamePlayShell";
import { getGameMeta } from "@/lib/games/registry";

function BingoPlayInner() {
  const sp = useSearchParams();

  const mode = (sp.get("mode") || "warm-up").trim();
  const entry = (sp.get("entry") || "").trim();

  const meta = getGameMeta("bingo");
  const defaultReturnTo =
    meta.routes?.modesHref || "/games/bingo/modes";

  const returnTo = (sp.get("returnTo") || defaultReturnTo).trim();

  return (
    <GamePlayShell
      title="Bingo"
      subtitle="Dedicated Bingo runtime through platform canvas dispatch."
      modeLabel={mode}
      entryLabel={entry ? `$${Number(entry).toFixed(2)}` : undefined}
      returnTo={returnTo}
      backgroundClassName="bg-[radial-gradient(1200px_700px_at_50%_-120px,rgba(255,255,255,0.18),transparent_55%),linear-gradient(180deg,#c026d3_0%,#7e22ce_45%,#4c1d95_100%)]"
    >
      <GameCanvas gameId="bingo" />
    </GamePlayShell>
  );
}

export default function BingoPlayPage() {
  return (
    <Suspense fallback={null}>
      <BingoPlayInner />
    </Suspense>
  );
}
// ===== FILE END: apps/web/app/(public)/games/bingo/play/page.tsx =====