// ===== FILE START: apps/web/components/shell/TopHud.tsx =====
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PLAYER_CHANGED_EVENT, readPlayer, updatePlayer } from "../../lib/playerStore";


function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Icon({ name, active }: { name: string; active?: boolean }) {
  const base =
    "grid h-6 w-6 place-items-center rounded-md border text-[10px] font-bold";
  return (
    <span
      className={cn(
        base,
        active
          ? "border-white/30 bg-white/15 text-white"
          : "border-white/15 bg-white/5 text-white/70"
      )}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-3 w-36 overflow-hidden rounded-full bg-black/20 ring-1 ring-white/10">
      <div className="h-full rounded-full bg-white/70" style={{ width: `${v}%` }} />
    </div>
  );
}

export default function TopHud() {
  const [profileOpen, setProfileOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  // HUD real values
// ВАЖНО: не читаем localStorage на первом рендере (SSR), иначе hydration mismatch.
// Стартуем со стабильного дефолта, потом в useEffect синхронизируем.
const [player, setPlayer] = useState(() => ({
  level: 1,
  xp: 0,
  gems: 0,
  cash: 0,
}));

  useEffect(() => {
  const sync = () => setPlayer(readPlayer());

  // same-tab updates (our custom event)
  window.addEventListener(PLAYER_CHANGED_EVENT, sync);

  // other-tab updates
  window.addEventListener("storage", sync);

  // initial sync (in case state changed before mount)
  sync();

  return () => {
    window.removeEventListener(PLAYER_CHANGED_EVENT, sync);
    window.removeEventListener("storage", sync);
  };
}, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!profileOpen) return;
      const t = e.target as Node | null;
      if (t && popRef.current && !popRef.current.contains(t)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [profileOpen]);

  const level = player.level;
  const progress = Math.max(0, Math.min(100, Math.round((player.xp % 100) * 1)));
  const gems = String(player.gems);
  const cash = `$${player.cash.toFixed(2)}`;

  function onAddCash() {
    const next = updatePlayer({ cash: player.cash + 1 });
    setPlayer(next);
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)]">
      <div className="flex items-center justify-between gap-3">
        {/* left: level + progress */}
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/10 text-sm font-bold">
            {level}
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-[11px] text-white/70">Progress</div>
            <ProgressBar value={progress} />
          </div>
        </div>

        {/* right: currencies + profile */}
        <div className="flex items-center gap-2">
          <Link
            href="/shop"
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/15 px-3 py-2"
            title="Shop"
          >
            <Icon name="💎" />
            <div className="text-sm font-semibold">{gems}</div>
          </Link>

          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/15 px-3 py-2">
            <Icon name="$" />
            <div className="text-sm font-semibold">{cash}</div>
            <button
              type="button"
              onClick={onAddCash}
              className="grid h-7 w-7 place-items-center rounded-xl bg-white text-black font-bold"
              title="Add"
              aria-label="Add"
            >
              +
            </button>
          </div>

          {/* profile dropdown */}
          <div className="relative" ref={popRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/10"
              aria-label="Profile menu"
              title="Profile"
            >
              <span className="text-lg">🐺</span>
            </button>

            {profileOpen ? (
              <div className="absolute right-0 top-12 w-56 overflow-hidden rounded-3xl border border-white/15 bg-[#4b168f]/95 shadow-[0_40px_140px_-80px_rgba(0,0,0,0.95)]">
                <div className="px-4 py-3">
                  <div className="text-xs text-white/70">Player</div>
                  <div className="mt-1 font-semibold">VIBRANTPANDA257</div>
                </div>
                <div className="h-px bg-white/10" />

                <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10">
                  <Icon name="👤" /> <span className="font-medium">Profile</span>
                </button>
                <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10">
                  <Icon name="👥" /> <span className="font-medium">Friends</span>
                </button>
                <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10">
                  <Icon name="🎁" /> <span className="font-medium">Daily Rewards</span>
                </button>
                <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10">
                  <Icon name="⚙️" /> <span className="font-medium">Settings</span>
                </button>

                <div className="h-px bg-white/10" />
                <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/10">
                  <span className="flex items-center gap-3">
                    <Icon name="🔑" /> <span className="font-medium">Login</span>
                  </span>
                  <span className="text-xs text-white/70">→</span>
                </button>
                <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/10">
                  <span className="flex items-center gap-3">
                    <Icon name="💾" /> <span className="font-medium">Save Account</span>
                  </span>
                  <span className="text-xs text-white/70">→</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
// ===== FILE END: apps/web/components/shell/TopHud.tsx =====
