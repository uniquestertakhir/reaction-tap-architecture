// apps/web/lib/resultsStore.ts

export type ResultsCurrency = "cash" | "gems";

export type ResultsRun = {
  id: string;              // local id
  createdAt: number;

  gameId: string;          // "reaction-tap"
  title: string;           // "Warm up", "Starter Brawl" etc (MVP)
  currency: ResultsCurrency;

  // what user sees on the right (MVP)
  prize: number;           // cash: dollars, gems: diamonds

  // extra for later
  matchId?: string | null;
  mode?: string;
  score?: number;
  serverScore?: number;
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

export function readResultsRuns(): ResultsRun[] {
  if (typeof window === "undefined") return [];
  const data = safeParse<{ items: ResultsRun[] }>(localStorage.getItem(KEY));
  const items = Array.isArray(data?.items) ? data!.items : [];
  // newest first
  return [...items].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function addResultsRun(run: Omit<ResultsRun, "id" | "createdAt"> & { createdAt?: number }) {
  if (typeof window === "undefined") return;

  const prev = readResultsRuns();
  const now = typeof run.createdAt === "number" ? run.createdAt : Date.now();

  const nextItem: ResultsRun = {
    id: `rr_${now}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    ...run,
  };

  const next = [nextItem, ...prev].slice(0, 200); // keep last 200
  localStorage.setItem(KEY, JSON.stringify({ items: next }));
}

export function clearResultsRuns() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
