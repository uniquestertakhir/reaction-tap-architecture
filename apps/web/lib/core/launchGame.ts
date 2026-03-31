// ===== FILE START: apps/web/lib/core/launchGame.ts =====

import { getGameRuntimeRoute } from "@/lib/games/engineRegistry";
import { getGameMeta } from "@/lib/games/registry";

export type LaunchCashGameInput = {
  matchId: string;
  gameId: string;
  mode: string;
  modeId?: string;
  entry?: number;
  prize?: number;
    currency?: "cash" | "gems";
  stake: number;
  queue: string;
  returnTo?: string;
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

export function buildCashGameUrl(input: LaunchCashGameInput): string {
  const gameId = String(input.gameId || "").trim().toLowerCase();
  const runtimeBase = getGameRuntimeRoute(gameId, "cash");

  const meta = getGameMeta(gameId);
  const returnTo =
    input.returnTo ||
    meta.routes?.modesHref ||
    `/games/${encodeURIComponent(gameId)}`;

  return withParams(runtimeBase, {
    matchId: input.matchId,
    gameId,
    mode: input.mode,
    modeId: input.modeId,
    entry: input.entry ?? input.stake,
    prize: input.prize,
    currency: input.currency || "cash",
    returnTo,
    stake: input.stake,
    queue: input.queue,
  });
}

// ===== FILE END: apps/web/lib/core/launchGame.ts =====