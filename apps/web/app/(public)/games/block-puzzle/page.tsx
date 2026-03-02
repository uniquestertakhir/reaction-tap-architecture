// ===== FILE START: apps/web/app/(public)/games/block-puzzle/page.tsx =====
import { Suspense } from "react";
import BlockPuzzleClient from "./BlockPuzzleClient";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BlockPuzzleClient />
    </Suspense>
  );
}
// ===== FILE END: apps/web/app/(public)/games/block-puzzle/page.tsx =====