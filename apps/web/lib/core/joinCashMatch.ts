// ===== FILE START: apps/web/lib/core/joinCashMatch.ts =====

import { readPlayer, updatePlayer } from "@/lib/playerStore";

async function safeJson(r: Response) {
  try {
    return await r.json();
  } catch {
    return null;
  }
}

function ensurePlayerId(): string {
  const p = readPlayer();
  const existing = String(p.playerId || "").trim();

  if (existing) return existing;

  const fresh =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `p_${crypto.randomUUID()}`
      : `p_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;

  try {
    updatePlayer({ playerId: fresh });
  } catch {}

  return fresh;
}

export type JoinCashMatchInput = {
  gameId: string;
  queue: string;
  entryUsd: number;
  players: number;
};

export type JoinCashMatchResult =
  | { ok: true; matchId: string; playerId: string }
  | { ok: false; error: string };

export async function joinCashMatch(
  input: JoinCashMatchInput
): Promise<JoinCashMatchResult> {
  const gameId = String(input.gameId || "").trim().toLowerCase();
  const queue = String(input.queue || "").trim();
  const entry = Number(input.entryUsd);
  const players = Number(input.players) || 2;

  if (!gameId) {
    return { ok: false, error: "missing_game_id" };
  }

  if (!queue) {
    return { ok: false, error: "missing_queue" };
  }

  if (!Number.isFinite(entry) || entry <= 0) {
    return { ok: false, error: "bad_entry" };
  }

  const playerId = ensurePlayerId();

  // DEV top-up so local flow does not fail on stake with insufficient funds.
  // Production can safely ignore this because /api/wallet/fund is DEV-only.
  try {
    const topUp = Math.max(10, Math.ceil(entry * 50));

    await fetch("/api/wallet/fund", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId,
        amount: topUp,
        currency: "USD",
      }),
    });
  } catch {}

  try {
    const r = await fetch("/api/matchmaking/join", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        playerId,
        gameId,
        queue,
        mode: queue,
        currency: "USD",
        entry,
        players,
      }),
    });

    const j = await safeJson(r);

    if (!r.ok) {
      return {
        ok: false,
        error: String(j?.error || "matchmaking_failed"),
      };
    }

    const matchId = String(j?.match?.id || j?.matchId || "").trim();

    if (!matchId) {
      return { ok: false, error: "bad_matchmaking_response" };
    }

    return {
      ok: true,
      matchId,
      playerId,
    };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

// ===== FILE END: apps/web/lib/core/joinCashMatch.ts =====