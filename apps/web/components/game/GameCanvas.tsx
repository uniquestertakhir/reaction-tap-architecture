// ===== FILE START: apps/web/components/game/GameCanvas.tsx =====
"use client";

import Link from "next/link";
import { GAME_RUNTIME_COMPONENTS } from "@/lib/games/runtimeRegistry";

type Props = {
  gameId?: string;
};

function RuntimeNotRegistered({ gameId }: { gameId: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white">
      <div className="text-xl font-extrabold">Runtime not registered</div>
      <div className="mt-2 text-sm text-white/70">
        No GameCanvas runtime is registered for:
        <span className="ml-2 font-bold text-white">{gameId}</span>
      </div>

      <Link
        href="/games"
        className="mt-4 inline-flex rounded-2xl bg-white px-4 py-2 text-sm font-bold text-black"
      >
        Back to Games
      </Link>
    </div>
  );
}

export default function GameCanvas({ gameId = "reaction-tap" }: Props) {
  const gid = String(gameId || "").trim().toLowerCase();

  const Runtime =
    GAME_RUNTIME_COMPONENTS[
      gid as keyof typeof GAME_RUNTIME_COMPONENTS
    ] || null;

  if (!Runtime) {
    return <RuntimeNotRegistered gameId={gid} />;
  }

  return <Runtime />;
}
// ===== FILE END: apps/web/components/game/GameCanvas.tsx =====