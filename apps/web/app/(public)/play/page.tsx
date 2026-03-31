// ===== FILE START: apps/web/app/(public)/play/page.tsx =====
"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getGameRuntimeRoute } from "@/lib/games/engineRegistry";

function PlayBridgeInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const gameId = (sp.get("gameId") || "reaction-tap").trim().toLowerCase();
  const matchId = (sp.get("matchId") || "").trim();
  const mode = (sp.get("mode") || "").trim();
  const entry = (sp.get("entry") || "").trim();
  const prize = (sp.get("prize") || "").trim();
  const returnTo = (sp.get("returnTo") || "").trim();
  const currency = (sp.get("currency") || "").trim();
  const stake = (sp.get("stake") || "").trim();
  const queue = (sp.get("queue") || "").trim();
  const modeId = (sp.get("modeId") || "").trim();

  useEffect(() => {
     const kind =
      currency === "cash" || stake || matchId || queue ? "cash" : "practice";

    const targetBase = getGameRuntimeRoute(gameId, kind);

    if (!targetBase || targetBase === "/games") {
      router.replace("/games");
      return;
    }

    const qs = new URLSearchParams();

    if (matchId) qs.set("matchId", matchId);
    if (gameId) qs.set("gameId", gameId);
    if (mode) qs.set("mode", mode);
    if (modeId) qs.set("modeId", modeId);
    if (entry) qs.set("entry", entry);
    if (prize) qs.set("prize", prize);
    if (currency) qs.set("currency", currency);
    if (returnTo) qs.set("returnTo", returnTo);
    if (stake) qs.set("stake", stake);
    if (queue) qs.set("queue", queue);

    const target = qs.toString() ? `${targetBase}?${qs.toString()}` : targetBase;
    router.replace(target);
  }, [router, gameId, matchId, mode, modeId, entry, prize, returnTo, currency, stake, queue]);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex max-w-xl flex-col px-6 py-12">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/70">
            Redirecting to dedicated runtime…
          </div>
        </div>
      </div>
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black text-white">
          <div className="mx-auto max-w-xl px-6 py-10">
            <div className="text-sm text-white/70">Loading…</div>
          </div>
        </main>
      }
    >
      <PlayBridgeInner />
    </Suspense>
  );
}
// ===== FILE END: apps/web/app/(public)/play/page.tsx =====