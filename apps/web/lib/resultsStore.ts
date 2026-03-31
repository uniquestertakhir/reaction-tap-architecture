// ===== FILE START: apps/web/lib/resultsStore.ts =====

export type ResultsCurrency = "cash" | "gems";

export type ResultsRun = {
  id: string;
  createdAt: number;

  gameId: string;          // "reaction-tap", "block-puzzle", ...
  title: string;           // "Warm up", "Starter Brawl", ...
  currency: ResultsCurrency;

  // what user sees on the right
  prize: number;           // cash: dollars, gems: diamonds

  // core result data
  matchId?: string | null;
  mode?: string;
  score?: number;
  serverScore?: number;

  // platform-result contract (optional for backward compatibility)
  verified?: boolean;
  outcome?: "win" | "loss" | "completed";
  durationMs?: number;
  placement?: number | null;
  rewardSource?: "practice" | "cash" | "reward" | "unknown";
};

const KEY = "rt_results_v1";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeGameId(gameId: string | null | undefined) {
  return String(gameId || "").trim().toLowerCase();
}

function sortNewestFirst(items: ResultsRun[]) {
  return [...items].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function readResultsRuns(): ResultsRun[] {
  if (typeof window === "undefined") return [];

  const data = safeParse<{ items: ResultsRun[] }>(localStorage.getItem(KEY));
  const items = Array.isArray(data?.items) ? data.items : [];

  return sortNewestFirst(items);
}

export function readResultsRunsByGame(gameId: string | null | undefined): ResultsRun[] {
  const gid = normalizeGameId(gameId);
  if (!gid) return readResultsRuns();

  return readResultsRuns().filter((item) => normalizeGameId(item.gameId) === gid);
}

export function readResultsRunsByCurrency(currency: ResultsCurrency): ResultsRun[] {
  return readResultsRuns().filter((item) => item.currency === currency);
}

export function readRecentResultsRuns(limit = 30): ResultsRun[] {
  const n = Math.max(1, Math.floor(limit || 30));
  return readResultsRuns().slice(0, n);
}

export function readRecentResultsRunsByGame(
  gameId: string | null | undefined,
  limit = 30
): ResultsRun[] {
  const n = Math.max(1, Math.floor(limit || 30));
  return readResultsRunsByGame(gameId).slice(0, n);
}

export function addResultsRun(
  run: Omit<ResultsRun, "id" | "createdAt"> & { createdAt?: number }
) {
  if (typeof window === "undefined") return;

  const prev = readResultsRuns();
  const now = typeof run.createdAt === "number" ? run.createdAt : Date.now();

  const nextItem: ResultsRun = {
    id: `rr_${now}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    ...run,
    gameId: normalizeGameId(run.gameId),
  };

  const next = [nextItem, ...prev].slice(0, 200);
  localStorage.setItem(KEY, JSON.stringify({ items: next }));
}

export function clearResultsRuns() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export function clearResultsRunsByGame(gameId: string | null | undefined) {
  if (typeof window === "undefined") return;

  const gid = normalizeGameId(gameId);
  if (!gid) return;

  const next = readResultsRuns().filter((item) => normalizeGameId(item.gameId) !== gid);
  localStorage.setItem(KEY, JSON.stringify({ items: next }));
}

// ===== FILE END: apps/web/lib/resultsStore.ts =====