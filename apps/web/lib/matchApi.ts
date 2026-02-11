// apps/web/lib/matchApi.ts

export type MatchStatus = "created" | "started" | "ended";

export type Match = {
  id: string;
  status: MatchStatus;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;

  durationMs?: number;

  serverScore?: number;
  winnerRunId?: string;
  winnerPlayerId?: string;
};

export type RunItem = {
  id: string;
  createdAt: number;
  serverScore: number;

  matchId: string | null;
  playerId: string;

  seed: number;
  hits: number;
  misses: number;
  avgReactionMs: number | null;
  durationMs: number;
  spawnCount: number;
  tapCount: number;
};

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; status: number; error: string; detail?: any };

async function safeJson(r: Response) {
  try {
    return await r.json();
  } catch {
    return null;
  }
}

export async function apiCreateMatch(): Promise<Ok<{ match: Match }> | Err> {
  const r = await fetch("/api/match/create", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({}), // важно: явный JSON-body
  });

  const j = await safeJson(r);

  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      error: j?.error || "create_failed",
      detail: j,
    };
  }

  if (!j?.match) {
    return { ok: false, status: 200, error: "bad_response", detail: j };
  }

  return { ok: true, data: j };
}


export async function apiGetMatch(id: string): Promise<Ok<{ match: Match }> | Err> {
  const r = await fetch(`/api/match/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  const j = await safeJson(r);

  if (!r.ok) return { ok: false, status: r.status, error: j?.error || "get_failed", detail: j };
  if (!j?.match) return { ok: false, status: 200, error: "bad_response", detail: j };

  return { ok: true, data: j };
}

export async function apiStartMatch(id: string): Promise<Ok<{ match: Match; alreadyStarted?: boolean }> | Err> {
  const r = await fetch(`/api/match/${encodeURIComponent(id)}/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const j = await safeJson(r);

  if (!r.ok) return { ok: false, status: r.status, error: j?.error || "start_failed", detail: j };
  return { ok: true, data: j };
}

export async function apiGetRuns(id: string): Promise<Ok<{ items: RunItem[] }> | Err> {
  const r = await fetch(`/api/match/${encodeURIComponent(id)}/runs`, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  const j = await safeJson(r);

  if (!r.ok) return { ok: false, status: r.status, error: j?.error || "runs_failed", detail: j };
  if (!Array.isArray(j?.items)) return { ok: false, status: 200, error: "bad_response", detail: j };

  return { ok: true, data: j };
}
