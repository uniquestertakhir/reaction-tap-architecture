// ===== FILE START: apps/api/src/services/game.service.ts =====
import { randomUUID } from "node:crypto";

export type RunResult = {
  gameId?: string | null; // ✅ NEW (optional for backward compatibility)
  matchId?: string | null; // ✅ optional (solo => null/undefined)
  playerId: string; // ✅ required

  seed: number;
  hits: number;
  misses: number;
  avgReactionMs: number | null;
  score: number;
  durationMs: number;
  spawnCount: number; // hits + 1
  tapCount: number; // hits + misses
};

export type StoredRun = {
  id: string;
  createdAt: number;

  gameId: string; // ✅ NEW (always stored)
  matchId: string | null; // ✅ existing
  playerId: string; // ✅ existing

  seed: number;
  hits: number;
  misses: number;
  avgReactionMs: number | null;
  durationMs: number;

  spawnCount: number;
  tapCount: number;

  serverScore: number;
};

const DEFAULT_GAME_ID = "reaction-tap";

const MAX_RUNS = 2000;
const runs: StoredRun[] = [];

function normalizeGameId(v: any): string {
  if (typeof v !== "string") return DEFAULT_GAME_ID;
  const s = v.trim();
  return s ? s : DEFAULT_GAME_ID;
}

function recomputeScore(run: RunResult) {
  // NOTE: for now scoring is same for all games (we’ll branch by gameId later)
  const base = run.hits * 10 - run.misses * 5;
  const bonus = run.avgReactionMs !== null && run.avgReactionMs < 250 ? 200 : 0;
  return base + bonus;
}

export function verifyRun(
  run: RunResult
): { ok: true; serverScore: number } | { ok: false; reason: string } {
  // ✅ gameId is optional; if present must be non-empty string
  if (run.gameId !== undefined && run.gameId !== null) {
    if (typeof run.gameId !== "string" || !run.gameId.trim()) {
      return { ok: false, reason: "bad_gameId" };
    }
  }

  if (!Number.isFinite(run.seed)) return { ok: false, reason: "bad_seed" };

  if (typeof run.playerId !== "string" || !run.playerId.trim()) {
    return { ok: false, reason: "bad_playerId" };
  }

  if (!Number.isFinite(run.hits) || run.hits < 0) return { ok: false, reason: "bad_hits" };
  if (!Number.isFinite(run.misses) || run.misses < 0) return { ok: false, reason: "bad_misses" };

  if (!Number.isFinite(run.durationMs) || run.durationMs <= 0) return { ok: false, reason: "bad_duration" };

  if (!Number.isFinite(run.tapCount) || run.tapCount < 0) return { ok: false, reason: "bad_tapCount" };
  if (!Number.isFinite(run.spawnCount) || run.spawnCount < 0) return { ok: false, reason: "bad_spawnCount" };

  if (run.tapCount !== run.hits + run.misses) return { ok: false, reason: "bad_tapCount" };
  if (run.spawnCount !== run.hits + 1) return { ok: false, reason: "bad_spawnCount" };

  if (run.avgReactionMs !== null && run.avgReactionMs < 80) return { ok: false, reason: "reaction_too_fast" };

  const serverScore = recomputeScore(run);
  return { ok: true, serverScore };
}

export function storeVerifiedRun(run: RunResult, serverScore: number): StoredRun {
  const item: StoredRun = {
    id: randomUUID(),
    createdAt: Date.now(),

    gameId: normalizeGameId((run as any).gameId), // ✅ NEW
    matchId: typeof run.matchId === "string" ? run.matchId : null,
    playerId: run.playerId,

    seed: run.seed,
    hits: run.hits,
    misses: run.misses,
    avgReactionMs: run.avgReactionMs ?? null,
    durationMs: run.durationMs,

    spawnCount: run.spawnCount,
    tapCount: run.tapCount,

    serverScore,
  };

  runs.push(item);
  if (runs.length > MAX_RUNS) runs.splice(0, runs.length - MAX_RUNS);

  return item;
}

export function getRunsByMatch(matchId: string, limit = 50): StoredRun[] {
  return runs
    .filter((r) => r.matchId === matchId)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export function getBestScoreByMatch(matchId: string): number | null {
  const list = runs.filter((r) => r.matchId === matchId);
  if (list.length === 0) return null;
  let best = -Infinity;
  for (const r of list) best = Math.max(best, r.serverScore);
  return Number.isFinite(best) ? best : null;
}

export function getBestRunByMatch(matchId: string): StoredRun | null {
  const items = runs.filter((r) => r.matchId === matchId);
  if (items.length === 0) return null;

  // max by serverScore, tie-break: earlier createdAt wins
  items.sort((a, b) => {
    if (b.serverScore !== a.serverScore) return b.serverScore - a.serverScore;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  return items[0] || null;
}
// ===== FILE END: apps/api/src/services/game.service.ts =====
