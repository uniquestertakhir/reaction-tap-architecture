// ===== FILE START: apps/web/components/game/ReactionTapCanvasRuntime.tsx =====
"use client";

import { useSearchParams } from "next/navigation";
import ReactionTapRuntime from "@/components/game/ReactionTapRuntime";

export default function ReactionTapCanvasRuntime() {
  const sp = useSearchParams();

  const mode = (sp.get("mode") || "warm-up").trim();

  return (
    <ReactionTapRuntime
      gameId="reaction-tap"
      mode={mode}
      canPlay={true}
    />
  );
}
// ===== FILE END: apps/web/components/game/ReactionTapCanvasRuntime.tsx =====