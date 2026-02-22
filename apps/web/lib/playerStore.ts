// ===== FILE START: apps/web/lib/playerStore.ts =====

export type PlayerState = {
  playerId: string; // ✅ stable id for runs/results
  gems: number;
  cash: number;
  level: number;
  xp: number;
};

const KEY = "rt_player_state_v1";



// ✅ NEW: event for live UI updates (HUD, pages)
export const PLAYER_CHANGED_EVENT = "rt_player_changed_v1";

function emitPlayerChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PLAYER_CHANGED_EVENT));
}

// ✅ NEW: subscribe helper (used by useSyncExternalStore later)
export function subscribePlayer(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(PLAYER_CHANGED_EVENT, handler);
  return () => window.removeEventListener(PLAYER_CHANGED_EVENT, handler);
}

// ✅ NEW: stable snapshot getter for UI
export function getPlayerSnapshot(): PlayerState {
  return readPlayer();
}

function makePlayerId() {
  // no deps, stable, good enough for MVP
  const rand = Math.random().toString(36).slice(2, 10);
  return `p_${Date.now()}_${rand}`;
}

const DEFAULT_STATE: PlayerState = {
  playerId: "p_unknown", // will be replaced in readPlayer() in browser
  gems: 0,
  cash: 0,
  level: 1,
  xp: 0,
};

export function readPlayer(): PlayerState {
  if (typeof window === "undefined") return DEFAULT_STATE;

  try {
    const raw = localStorage.getItem(KEY);

    if (!raw) {
  const first = { ...DEFAULT_STATE, playerId: makePlayerId() };
  writePlayer(first);
  return first;
}

    const parsed = JSON.parse(raw) as Partial<PlayerState>;
    const merged = { ...DEFAULT_STATE, ...parsed };

    if (!merged.playerId || merged.playerId === "p_unknown") {
  merged.playerId = makePlayerId();
  writePlayer(merged);
}

    return merged;
  } catch {
  const fallback = { ...DEFAULT_STATE, playerId: makePlayerId() };
  writePlayer(fallback);
  return fallback;
}
}

export function writePlayer(next: PlayerState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(next));
  emitPlayerChanged();
}

export function updatePlayer(patch: Partial<PlayerState>) {
  const current = readPlayer();
  const next = { ...current, ...patch };
  writePlayer(next); // emits
  return next;
}

// ✅ NEW: convenience helpers (safe atomic updates)
export function addGems(delta: number) {
  const p = readPlayer();
  return updatePlayer({ gems: Math.max(0, (p.gems || 0) + delta) });
}

export function addCash(delta: number) {
  const p = readPlayer();
  return updatePlayer({ cash: Math.max(0, (p.cash || 0) + delta) });
}

export function addXp(delta: number) {
  const p = readPlayer();
  return updatePlayer({ xp: Math.max(0, (p.xp || 0) + delta) });
}

// ===== FILE END: apps/web/lib/playerStore.ts =====
