// ===== FILE START: apps/web/app/(public)/layout.tsx =====
"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import BottomNav from "@/components/shell/BottomNav";
import TopHud from "@/components/shell/TopHud";

export default function PublicLayout({ children }: { children: ReactNode }) {

  const path = usePathname() || "/";

  const isMenuScreen =
  path === "/games" ||
  path.startsWith("/games/") ||
  path === "/shop" ||
  path.startsWith("/shop/") ||
  path === "/results" ||
  path.startsWith("/results/") ||
  path === "/rewards" ||
  path.startsWith("/rewards/") ||
  path === "/leagues" ||
  path.startsWith("/leagues/") ||
  path === "/settings" ||
  path.startsWith("/settings/");

  if (isMenuScreen) {
    return (
      <div className="min-h-screen text-white">
        <div className="min-h-screen bg-[radial-gradient(1200px_800px_at_50%_-200px,rgba(255,255,255,0.18),transparent_60%),linear-gradient(180deg,#6b21a8_0%,#3b0a7a_40%,#170027_100%)]">
          <div className="mx-auto flex max-w-md flex-col px-4 pb-28 pt-4">
            <TopHud />
            <div className="mt-5">{children}</div>
          </div>

          <BottomNav />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
// ===== FILE END =====
