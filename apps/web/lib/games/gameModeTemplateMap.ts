// ===== FILE START: apps/web/lib/games/gameModeTemplateMap.ts =====

import type { PlatformModeTemplateId } from "@/lib/games/modeTemplates";

export const GAME_MODE_TEMPLATE_MAP: Record<string, PlatformModeTemplateId[]> = {
  "reaction-tap": [
    "cash-starter",
    "cash-standard",
    "cash-high",
    "cash-apex",
    "cash-bold",
    "practice-warmup",
    "practice-medium",
    "practice-high",
  ],

  "block-puzzle": [
    "cash-starter",
    "cash-standard",
    "cash-high",
    "cash-apex",
    "cash-bold",
    "practice-warmup",
    "practice-medium",
    "practice-high",
  ],

    "match-3-rush": [
    "cash-starter",
    "cash-standard",
    "cash-high",
    "cash-apex",
    "cash-bold",
    "practice-warmup",
    "practice-medium",
    "practice-high",
  ],

  bingo: [
    "cash-starter",
    "cash-standard",
    "cash-high",
    "cash-apex",
    "cash-bold",
    "practice-warmup",
    "practice-medium",
    "practice-high",
  ],

  blackjack: [
    "cash-starter",
    "cash-standard",
    "cash-high",
    "cash-apex",
    "cash-bold",
    "practice-warmup",
    "practice-medium",
    "practice-high",
  ],
};

export function getGameModeTemplateIds(gameId: string): PlatformModeTemplateId[] {
  const gid = String(gameId || "").trim().toLowerCase();
  return GAME_MODE_TEMPLATE_MAP[gid] || [];
}

// ===== FILE END: apps/web/lib/games/gameModeTemplateMap.ts =====