// ===== FILE START: apps/web/lib/leaderboard.ts =====
export type StoredRun = {
  id: string;
  createdAt: number;
  seed: number;
  hits: number;
  misses: number;
  avgReactionMs: number | null;
  durationMs: number;
  spawnCount: number;
  tapCount: number;
  serverScore: number;
};

const KEY = "rt_leaderboard_v1";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readLeaderboard(): StoredRun[] {
  if (typeof window === "undefined") return [];
  const data = safeParse<StoredRun[]>(window.localStorage.getItem(KEY));
  return Array.isArray(data) ? data : [];
}

export function addVerifiedRun(run: Omit<StoredRun, "id" | "createdAt">) {
  if (typeof window === "undefined") return;
  const list = readLeaderboard();

  const item: StoredRun = {
    id: `run_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now(),
    ...run,
  };

  const next = [item, ...list]
    .sort((a, b) => b.serverScore - a.serverScore)
    .slice(0, 200); // keep last/top 200

  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("rt_leaderboard_changed"));
}

export function subscribeLeaderboard(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  const onCustom = () => cb();

  window.addEventListener("storage", onStorage);
  window.addEventListener("rt_leaderboard_changed", onCustom);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("rt_leaderboard_changed", onCustom);
  };
}
// ===== FILE END: apps/web/lib/leaderboard.ts =====
