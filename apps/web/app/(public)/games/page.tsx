// ===== FILE START: apps/web/app/(public)/games/page.tsx =====
"use client";

import Link from "next/link";
import React from "react";
import { readPlayer } from "@/lib/playerStore";

type GameTile = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  locked?: { level: number };
  // simple “theme” classes for now (we’ll swap to real art later)
  className: string;
};

const GAMES: GameTile[] = [
  {
    id: "reaction-tap",
    title: "Reaction Tap",
    subtitle: "Tap-fast skill game",
    href: "/games/reaction-tap",
    className:
      "bg-[radial-gradient(800px_500px_at_30%_-10%,rgba(255,255,255,0.22),transparent_60%),linear-gradient(135deg,rgba(124,58,237,0.65),rgba(17,24,39,0.35))]",
  },
  {
    id: "block-puzzle",
    title: "Block Puzzle",
    subtitle: "Block Blast-style",
    href: "/games/block-puzzle",
    className:
      "bg-[radial-gradient(800px_500px_at_30%_-10%,rgba(255,255,255,0.20),transparent_60%),linear-gradient(135deg,rgba(59,130,246,0.40),rgba(17,24,39,0.35))]",
  },
  {
    id: "bingo",
    title: "Bingo",
    subtitle: "Coming soon",
    href: "/games/bingo",
    locked: { level: 6 },
    className:
      "bg-[radial-gradient(800px_500px_at_30%_-10%,rgba(255,255,255,0.18),transparent_60%),linear-gradient(135deg,rgba(168,85,247,0.55),rgba(17,24,39,0.35))]",
  },
  {
    id: "solitaire",
    title: "Solitaire",
    subtitle: "Coming soon",
    href: "/games/solitaire",
    locked: { level: 6 },
    className:
      "bg-[radial-gradient(800px_500px_at_30%_-10%,rgba(255,255,255,0.16),transparent_60%),linear-gradient(135deg,rgba(34,197,94,0.35),rgba(17,24,39,0.35))]",
  },
  {
    id: "tile-match",
    title: "Tile Match",
    subtitle: "Coming soon",
    href: "/games/tile-match",
    locked: { level: 6 },
    className:
      "bg-[radial-gradient(800px_500px_at_30%_-10%,rgba(255,255,255,0.16),transparent_60%),linear-gradient(135deg,rgba(244,63,94,0.35),rgba(17,24,39,0.35))]",
  },
];

function LockPill({ level }: { level: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3 py-1 text-xs text-white/85">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-white/10">🔒</span>
      Unlocks at level {level}
    </div>
  );
}

export default function GamesPage() {
  const [level, setLevel] = React.useState(0);

  React.useEffect(() => {
    setLevel(readPlayer().level);
  }, []);

  return (
    <div className="mt-5">
      {/* banner (placeholder for real art like Blitz) */}
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)]">
        <div className="p-5">
          <div className="text-xs font-semibold tracking-wide text-white/70">GAMES</div>
          <div className="mt-2 text-2xl font-extrabold">Choose a game</div>
          <div className="mt-2 text-sm text-white/70">
            Tap a tile → open the game page → pick a mode (diamonds for practice-style, cash for real matches).
          </div>
        </div>
        <div className="h-2 w-full bg-white/10" />
      </div>

      {/* tiles grid */}
      <div className="mt-5 grid grid-cols-2 gap-4">
        {GAMES.map((g) => {
          const isLocked = !!g.locked && level < g.locked.level;

          const CardInner = (
            <div
              className={
                "group relative overflow-hidden rounded-3xl border border-white/10 p-4 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)] " +
                g.className +
                (isLocked ? " opacity-90" : "")
              }
            >
              <div className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100 bg-white/5" />
              <div className="relative">
                <div className="text-xs text-white/70">{g.subtitle || ""}</div>
                <div className="mt-2 text-xl font-extrabold leading-tight">{g.title}</div>

                <>
  <div
    className={
      "mt-4 inline-flex rounded-2xl px-4 py-2 text-sm font-semibold " +
      (isLocked ? "bg-white/10 text-white/70" : "bg-white text-black")
    }
  >
    {isLocked ? "Locked" : "Open"}
  </div>

  <div className="mt-3 text-[11px] text-white/55">
    {g.locked ? `Locked until level ${g.locked.level}.` : "Open → choose a mode inside the game."}
  </div>
</>

                {g.locked ? (
                  <div className="mt-3">
                    <LockPill level={g.locked.level} />
                  </div>
                ) : null}
              </div>

              {/* lock overlay (no click like Blitz) */}
              {isLocked ? (
                <div className="absolute inset-0 grid place-items-center bg-black/35 backdrop-blur-[1px]">
                  <div className="rounded-3xl border border-white/15 bg-black/30 px-4 py-3">
                    <LockPill level={g.locked!.level} />
                  </div>
                </div>
              ) : null}
            </div>
          );

          // Blitz behavior: locked game tiles are NOT clickable
          if (isLocked) {
            return (
              <div key={g.id} className="block cursor-not-allowed select-none">
                {CardInner}
              </div>
            );
          }

return (
  <Link key={g.id} href={g.href} className="block">
    {CardInner}
  </Link>
);
        })}
      </div>
    </div>
  );
}
// ===== FILE END: apps/web/app/(public)/games/page.tsx =====
