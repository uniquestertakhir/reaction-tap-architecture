// ===== FILE START: apps/web/lib/games/buildModeHref.ts =====

import type { GameMode } from "@/lib/games/catalog";
import { getGameRuntimeRoute } from "@/lib/games/engineRegistry";
import { getGameMeta } from "@/lib/games/registry";

type BuildModeHrefInput = {
  gameId: string;
  mode: GameMode;
  hasEnough: boolean;
};

export type BuiltModeHref = {
  playHref: string;
  returnTo: string;
  shopHref: string;
  finalHref: string;
};

function withParams(
  base: string,
  params: Record<string, string | number | undefined>
) {
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    qs.set(key, String(value));
  }

  const query = qs.toString();
  if (!query) return base;

  return `${base}${base.includes("?") ? "&" : "?"}${query}`;
}

function buildRuntimeHref(gameId: string, mode: GameMode) {
  const gid = String(gameId || "").trim().toLowerCase();
  const meta = getGameMeta(gid);
  const returnTo = meta.routes?.modesHref || `/games/${gid}`;

  const runtimeBase = getGameRuntimeRoute(
    gid,
    mode.currency === "cash" ? "cash" : "practice"
  );

    return withParams(runtimeBase, {
    gameId: gid,
    mode: mode.mode,
    modeId: mode.id,
    currency: mode.currency,
    entry: mode.entryFee,
    prize: mode.prizePool,
    returnTo,
  });
}

export function buildModeHref(input: BuildModeHrefInput): BuiltModeHref {
  const gameId = String(input.gameId || "").trim().toLowerCase();
  const mode = input.mode;
  const hasEnough = !!input.hasEnough;

  const meta = getGameMeta(gameId);
  const returnTo = meta.routes?.modesHref || `/games/${encodeURIComponent(gameId)}`;

  const playHref = buildRuntimeHref(gameId, mode);

  const shopHref =
    mode.currency === "cash"
      ? `/shop?tab=cash&need=cash&amount=${encodeURIComponent(
          String(mode.entryFee)
        )}&returnTo=${encodeURIComponent(playHref)}`
      : `/shop?tab=gems&need=gems&amount=${encodeURIComponent(
          String(mode.entryFee)
        )}&returnTo=${encodeURIComponent(playHref)}`;

  const finalHref = hasEnough ? playHref : shopHref;

  return {
    playHref,
    returnTo,
    shopHref,
    finalHref,
  };
}

// ===== FILE END: apps/web/lib/games/buildModeHref.ts =====