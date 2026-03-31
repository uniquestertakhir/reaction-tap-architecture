// ===== FILE START: apps/web/app/(public)/games/block-puzzle/play/page.tsx =====
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import GameCanvas from "@/components/game/GameCanvas";
import GamePlayShell from "@/components/game/GamePlayShell";
import { getGameMeta } from "@/lib/games/registry";

function BlockPuzzlePlayInner() {
  const sp = useSearchParams();

  const mode = (sp.get("mode") || "warm-up").trim();
  const entry = (sp.get("entry") || "").trim();

  const meta = getGameMeta("block-puzzle");
  const defaultReturnTo =
    meta.routes?.modesHref || "/games/block-puzzle/modes";

  const returnTo = (sp.get("returnTo") || defaultReturnTo).trim();

  return (
    <GamePlayShell
      title="Block Puzzle"
      subtitle="Dedicated Block Puzzle runtime through platform canvas dispatch."
      modeLabel={mode}
      entryLabel={entry ? `$${Number(entry).toFixed(2)}` : undefined}
      returnTo={returnTo}
      backgroundClassName="bg-[radial-gradient(1200px_700px_at_50%_-120px,rgba(255,255,255,0.22),transparent_55%),radial-gradient(900px_550px_at_20%_10%,rgba(59,130,246,0.18),transparent_60%),radial-gradient(900px_600px_at_80%_20%,rgba(34,197,94,0.14),transparent_60%),linear-gradient(180deg,#2563eb_0%,#1e3a8a_55%,#0b1026_100%)]"
    >
      <GameCanvas gameId="block-puzzle" />
    </GamePlayShell>
  );
}

export default function BlockPuzzlePlayPage() {
  return (
    <Suspense fallback={null}>
      <BlockPuzzlePlayInner />
    </Suspense>
  );
}
// ===== FILE END: apps/web/app/(public)/games/block-puzzle/play/page.tsx =====