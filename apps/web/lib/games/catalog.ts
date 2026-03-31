// ===== FILE START: apps/web/lib/games/catalog.ts =====

import { resolveGameModes } from "@/lib/games/resolveGameModes";

export type GameModeCurrency = "cash" | "gems";

export type GameMode = {
  id: string;
  mode: string;
  title: string;
  subtitle?: string;
  eventLabel?: string;
  players?: number;
  playersText?: string;
  currency: GameModeCurrency;
  entryFee: number;
  prizePool: number;
  limited?: boolean;
  durationMs?: number;
  startedAt?: number;
  requiresLevel?: number;
};

export type GameConfig = {
  id: string;
  name: string;
  theme: "violet" | "green" | "pink" | "gold" | "blue" | "red";
  modes: GameMode[];
};

const GAMES_CATALOG: Record<string, GameConfig> = {
  "reaction-tap": {
    id: "reaction-tap",
    name: "Reaction Tap",
    theme: "violet",
    modes: resolveGameModes("reaction-tap"),
  },

  "block-puzzle": {
    id: "block-puzzle",
    name: "Block Puzzle",
    theme: "blue",
    modes: resolveGameModes("block-puzzle"),
  },

  bingo: {
    id: "bingo",
    name: "Bingo",
    theme: "pink",
    modes: resolveGameModes("bingo"),
  },

  blackjack: {
    id: "blackjack",
    name: "21 Blackjack",
    theme: "blue",
    modes: resolveGameModes("blackjack"),
  },

    "match-3-rush": {
    id: "match-3-rush",
    name: "Match 3 Rush",
    theme: "pink",
    modes: resolveGameModes("match-3-rush"),
  },
};

export function getGameConfig(gameId: string | null | undefined): GameConfig {
  const key = String(gameId || "").trim().toLowerCase();

  if (key && GAMES_CATALOG[key]) {
    return GAMES_CATALOG[key];
  }

  return {
    id: key || "unknown",
    name: "Unknown Game",
    theme: "violet",
    modes: [],
  };
}

export function listGameConfigs(): GameConfig[] {
  return Object.values(GAMES_CATALOG);
}

// ===== FILE END: apps/web/lib/games/catalog.ts =====