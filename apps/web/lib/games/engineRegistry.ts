// ===== FILE START: apps/web/lib/games/engineRegistry.ts =====

import { getGameMeta, listGamesMeta } from "@/lib/games/registry";

export type GameRuntimeKind = "practice" | "cash";

export type GameRuntime = {
  gameId: string;
  practiceRoute: string;
  cashRoute: string;
};

export function getGameRuntime(gameId: string): GameRuntime {
  const meta = getGameMeta(gameId);

  return {
    gameId: meta.id,
    practiceRoute: meta.routes?.practiceHref || meta.routes?.modesHref || "/games",
    cashRoute: meta.routes?.cashHref || meta.routes?.modesHref || "/games",
  };
}

export function getGameRuntimeRoute(
  gameId: string,
  kind: GameRuntimeKind
): string {
  const runtime = getGameRuntime(gameId);
  return kind === "cash" ? runtime.cashRoute : runtime.practiceRoute;
}

export function listGameRuntimes(): GameRuntime[] {
  return listGamesMeta().map((game) => ({
    gameId: game.id,
    practiceRoute:
      game.routes?.practiceHref || game.routes?.modesHref || "/games",
    cashRoute: game.routes?.cashHref || game.routes?.modesHref || "/games",
  }));
}

// ===== FILE END: apps/web/lib/games/engineRegistry.ts =====