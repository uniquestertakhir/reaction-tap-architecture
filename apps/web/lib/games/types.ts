// ===== FILE START: apps/web/lib/games/types.ts =====

export type GameCurrency = "cash" | "gems";

export type GameTheme = "violet" | "green" | "pink" | "gold" | "blue" | "red";

export type GamePayout = {
  r1: number;
  r2: number;
  r3: number;
};

// общий тип варианта / режима игры
export type GameVariant = {
  id: string;

  // UI
  title: string;
  subtitle: string;
  playersText?: string;

  // routing / identity
  gameId: string; // "reaction-tap", "block-puzzle", ...
  mode: string; // queue/mode id

  // economy
  currency: GameCurrency;
  entry: number; // USD or gems
  prizePool?: number; // what user sees as prize in UI

  // multiplayer size
  players: 2 | 4 | 8;

  // payout model (for usd variants mostly)
  payout?: GamePayout;

  // UX / live mode flags
  limited?: boolean;
  durationMs?: number;
  startedAt?: number;

  // locks
  requiresLevel?: number;

  // legacy compatibility
  locked?: boolean;
};

export type RegisteredGameRoutes = {
  modesHref: string;
  practiceHref: string;
  cashHref: string;
};

export type RegisteredGame = {
  id: string;
  title: string;
  icon: string;
  href: string;
  subtitle?: string;
  requiresLevel?: number;
  theme?: GameTheme;

  // NEW: platform-level routing map for hard separation
  routes?: RegisteredGameRoutes;
};

export type GameConfig = {
  id: string;
  name: string;
  theme: GameTheme;
  modes: GameVariant[];
};

// ===== FILE END: apps/web/lib/games/types.ts =====