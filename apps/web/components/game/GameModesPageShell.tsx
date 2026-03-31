// ===== FILE START: apps/web/components/game/GameModesPageShell.tsx =====
"use client";

import GameModesScreen from "@/components/game/GameModesScreen";

type Props = {
  gameId: string;
  backHref?: string;
};

export default function GameModesPageShell({
  gameId,
  backHref = "/games",
}: Props) {
  return <GameModesScreen gameId={gameId} backHref={backHref} />;
}
// ===== FILE END: apps/web/components/game/GameModesPageShell.tsx =====