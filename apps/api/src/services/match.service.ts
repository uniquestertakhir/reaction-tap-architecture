// ===== FILE START: apps/api/src/services/match.service.ts =====
export type MatchStatus = "created" | "started" | "ended";



export type Currency = "USD";

export type Match = {
  id: string;
  status: MatchStatus;

  createdAt: number;
  startedAt?: number;
  endedAt?: number;

  durationMs: number;

  // game / money
  gameId?: string;
  currency?: Currency;

  // escrow/stakes
  escrowTotal?: number; // sum of accepted stakes
  stakes?: Record<string, number>; // playerId -> amount

  // winner
  serverScore?: number;
  winnerRunId?: string;
  winnerPlayerId?: string;

  // payout (idempotent)
  paidOutAt?: number;
  paidOutTo?: string;
  paidOutAmount?: number;
};


type StartOk = { ok: true; match: Match; alreadyStarted?: boolean };
type StartErr =
  | { ok: false; reason: "not_found"; match?: Match | null }
  | { ok: false; reason: "ended"; match?: Match | null }
  | { ok: false; reason: "escrow_not_ready"; match: Match; details: any };

type EndPayload = {
  serverScore: number;
  winnerRunId: string;
  winnerPlayerId: string;
};

const matches = new Map<string, Match>();

function uuid() {
  const g: any = globalThis as any;
  if (g.crypto && typeof g.crypto.randomUUID === "function") return g.crypto.randomUUID();
  return `m_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function clampDuration(ms: any) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return 30_000;
  return Math.min(Math.max(5_000, n), 5 * 60_000);
}

export function createMatch(opts?: { gameId?: string; currency?: Currency }): Match {
  const id = uuid();

  const m: Match = {
    id,
    status: "created",
    createdAt: Date.now(),
    durationMs: 30_000,

    gameId: opts?.gameId || "reaction-tap",
    currency: opts?.currency || "USD",

    escrowTotal: 0,
    stakes: {},
  };

  matches.set(id, m);
  return m;
}

export function getMatch(id: string): Match | null {
  return matches.get(id) || null;
}

function escrowReady(m: Match) {
  const stakes = m.stakes || {};
  const entries = Object.entries(stakes).filter(([, amt]) => Number(amt) > 0);

  // MVP rule: need 2 players with equal stake (same amount)
  if (entries.length < 2) {
    return { ok: false as const, reason: "need_two_players", entries };
  }

  const a0 = Number(entries[0][1]);
  const a1 = Number(entries[1][1]);

  if (!Number.isFinite(a0) || !Number.isFinite(a1) || a0 <= 0 || a1 <= 0) {
    return { ok: false as const, reason: "bad_amounts", entries };
  }

  if (a0 !== a1) {
    return { ok: false as const, reason: "amounts_must_match", entries };
  }

  return { ok: true as const, amount: a0, players: [entries[0][0], entries[1][0]] };
}

export function startMatch(id: string): StartOk | StartErr {
  const m = matches.get(id) || null;
  if (!m) return { ok: false, reason: "not_found", match: null };

  if (m.status === "ended") return { ok: false, reason: "ended", match: m };
  if (m.status === "started") return { ok: true, match: m, alreadyStarted: true };

  // ✅ require escrow ready before start
  const ready = escrowReady(m);
  if (!ready.ok) {
    return {
      ok: false,
      reason: "escrow_not_ready",
      match: m,
      details: ready,
    };
  }

  m.status = "started";
  m.startedAt = Date.now();
  m.durationMs = clampDuration(m.durationMs);

  return { ok: true, match: m };
}

/**
 * placeStake: record stake per player.
 * NOTE: wallet checks are in server.ts route handler (service is pure).
 */
export function placeStake(id: string, playerId: string, amount: number): Match | null {
  const m = matches.get(id) || null;
  if (!m) return null;

  if (!m.stakes) m.stakes = {};
  const prev = Number(m.stakes[playerId] || 0);
  const next = prev + Number(amount);

  m.stakes[playerId] = next;

  // recompute escrowTotal
  const total = Object.values(m.stakes).reduce((sum, x) => sum + (Number(x) || 0), 0);
  m.escrowTotal = total;

  return m;
}

export function endMatch(id: string, payload: EndPayload): Match | null {
  const m = matches.get(id) || null;
  if (!m) return null;

  m.status = "ended";
  m.endedAt = Date.now();

  m.serverScore = Number(payload.serverScore);
  m.winnerRunId = String(payload.winnerRunId);
  m.winnerPlayerId = String(payload.winnerPlayerId);


  return m;
}

// ===== FILE END: apps/api/src/services/match.service.ts =====
