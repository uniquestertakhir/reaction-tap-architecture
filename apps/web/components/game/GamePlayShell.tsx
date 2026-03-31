// ===== FILE START: apps/web/components/game/GamePlayShell.tsx =====
"use client";

import Link from "next/link";
import { ReactNode } from "react";

type Props = {
  title: string;
  subtitle: string;
  modeLabel: string;
  entryLabel?: string;
  returnTo: string;
  backgroundClassName: string;
  children: ReactNode;
};

export default function GamePlayShell({
  title,
  subtitle,
  modeLabel,
  entryLabel,
  returnTo,
  backgroundClassName,
  children,
}: Props) {
  return (
    <main className="min-h-screen text-white">
      <div className={`min-h-screen ${backgroundClassName}`}>
        <div className="mx-auto flex max-w-md flex-col px-4 pb-24 pt-4">
          <div className="mb-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between">
              <Link
                href={returnTo}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white/90"
              >
                ← Back
              </Link>

              <div className="text-right">
                <div className="text-[11px] text-white/60">GAME</div>
                <div className="text-2xl font-extrabold">{title}</div>
              </div>
            </div>

            <div className="mt-3 text-sm text-white/70">{subtitle}</div>

            <div className="mt-2 text-xs text-white/50">
              mode: <span className="text-white/80">{modeLabel}</span>
              {entryLabel ? (
                <>
                  {" "}
                  • entry: <span className="text-white/80">{entryLabel}</span>
                </>
              ) : null}
            </div>
          </div>

          {children}
        </div>
      </div>
    </main>
  );
}
// ===== FILE END: apps/web/components/game/GamePlayShell.tsx =====