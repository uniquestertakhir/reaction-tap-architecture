// ===== FILE START: apps/web/app/(public)/games/reaction-tap/play/page.tsx =====
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import GameCanvas from "@/components/game/GameCanvas";
import GamePlayShell from "@/components/game/GamePlayShell";
import { getGameMeta } from "@/lib/games/registry";

function ReactionTapPlayInner() {
  const sp = useSearchParams();

  const mode = (sp.get("mode") || "warm-up").trim();
  const entry = (sp.get("entry") || "").trim();

  const meta = getGameMeta("reaction-tap");
  const defaultReturnTo =
    meta.routes?.modesHref || "/games/reaction-tap/modes";

  const returnTo = (sp.get("returnTo") || defaultReturnTo).trim();

  return (
    <GamePlayShell
      title="Reaction Tap"
      subtitle="Dedicated Reaction Tap runtime through platform canvas dispatch."
      modeLabel={mode}
      entryLabel={entry ? `$${Number(entry).toFixed(2)}` : undefined}
      returnTo={returnTo}
      backgroundClassName="bg-[radial-gradient(1200px_800px_at_50%_-200px,rgba(255,255,255,0.18),transparent_60%),linear-gradient(180deg,#5b21b6_0%,#2e1065_40%,#12061f_100%)]"
    >
      <GameCanvas gameId="reaction-tap" />
    </GamePlayShell>
  );
}

export default function ReactionTapPlayPage() {
  return (
    <Suspense fallback={null}>
      <ReactionTapPlayInner />
    </Suspense>
  );
}
// ===== FILE END: apps/web/app/(public)/games/reaction-tap/play/page.tsx =====