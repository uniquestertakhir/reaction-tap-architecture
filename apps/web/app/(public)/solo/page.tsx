// ===== FILE START: apps/web/app/(public)/solo/page.tsx =====
"use client";

import { Suspense } from "react";
import GameCanvas from "@/components/game/GameCanvas";

function SoloInner() {
  return (
    <div className="w-full">
      <GameCanvas canPlay />
    </div>
  );
}

export default function SoloPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <SoloInner />
    </Suspense>
  );
}
// ===== FILE END: apps/web/app/(public)/solo/page.tsx =====