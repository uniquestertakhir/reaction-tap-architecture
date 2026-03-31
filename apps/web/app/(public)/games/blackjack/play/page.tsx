// ===== FILE START: apps/web/app/(public)/games/blackjack/play/page.tsx =====
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import GameCanvas from "@/components/game/GameCanvas";
import GamePlayShell from "@/components/game/GamePlayShell";
import { getGameMeta } from "@/lib/games/registry";

function BlackjackPlayInner() {
  const sp = useSearchParams();

  const mode = (sp.get("mode") || "warm-up").trim();
  const entry = (sp.get("entry") || "").trim();

  const meta = getGameMeta("blackjack");
  const defaultReturnTo =
    meta.routes?.modesHref || "/games/blackjack/modes";

  const returnTo = (sp.get("returnTo") || defaultReturnTo).trim();

  return (
    <GamePlayShell
      title="21 Blackjack"
      subtitle="Dedicated Blackjack runtime through platform canvas dispatch."
      modeLabel={mode}
      entryLabel={entry ? `$${Number(entry).toFixed(2)}` : undefined}
      returnTo={returnTo}
      backgroundClassName="bg-[radial-gradient(1200px_720px_at_50%_-80px,rgba(255,255,255,0.18),transparent_55%),radial-gradient(1000px_700px_at_15%_20%,rgba(59,130,246,0.14),transparent_60%),radial-gradient(1000px_700px_at_85%_15%,rgba(34,197,94,0.12),transparent_60%),linear-gradient(180deg,#0f172a_0%,#0f3b2f_46%,#07111d_100%)]"
    >
      <GameCanvas gameId="blackjack" />
    </GamePlayShell>
  );
}

export default function BlackjackPlayPage() {
  return (
    <Suspense fallback={null}>
      <BlackjackPlayInner />
    </Suspense>
  );
}
// ===== FILE END: apps/web/app/(public)/games/blackjack/play/page.tsx =====