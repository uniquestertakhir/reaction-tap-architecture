// ===== FILE START: apps/web/lib/games/runtimeRegistry.ts =====
import ReactionTapCanvasRuntime from "@/components/game/ReactionTapCanvasRuntime";
import BlackjackRuntime from "@/components/game/BlackjackRuntime";
import BingoRuntime from "@/components/game/BingoRuntime";
import BlockPuzzleRuntime from "@/components/game/BlockPuzzleRuntime";

export const GAME_RUNTIME_COMPONENTS = {
  "reaction-tap": ReactionTapCanvasRuntime,
  blackjack: BlackjackRuntime,
  bingo: BingoRuntime,
  "block-puzzle": BlockPuzzleRuntime,
  "match-3-rush": require("@/components/game/Match3RushRuntime").default,
} as const;
// ===== FILE END: apps/web/lib/games/runtimeRegistry.ts =====