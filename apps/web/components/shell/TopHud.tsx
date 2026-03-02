// ===== FILE START: apps/web/components/shell/TopHud.tsx =====
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PLAYER_CHANGED_EVENT, readPlayer, updatePlayer } from "../../lib/playerStore";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Icon({ name, active }: { name: string; active?: boolean }) {
  const base = "grid h-6 w-6 place-items-center rounded-md border text-[10px] font-bold";
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


type MenuPos = { top: number; left: number };

export default function TopHud() {
  const [profileOpen, setProfileOpen] = useState(false);

  // refs for portal positioning
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<MenuPos>({ top: 0, left: 0 });

  const path = usePathname() || "/";
  const showBack = path.startsWith("/games/") && path !== "/games";

  // HUD real values
  const [player, setPlayer] = useState(() => ({
    level: 1,
    xp: 0,
    gems: 0,
    cash: 0,
  }));

  useEffect(() => {
    const sync = () => setPlayer(readPlayer());

    window.addEventListener(PLAYER_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);

    sync();

    return () => {
      window.removeEventListener(PLAYER_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // close on outside click (portal-safe) + ESC
  useEffect(() => {
    if (!profileOpen) return;

    const onDown = (e: MouseEvent | PointerEvent) => {
      const t = e.target as Node | null;

      // click on button => ignore (it toggles separately)
      if (t && btnRef.current && btnRef.current.contains(t)) return;

      // click inside menu => ignore
      if (t && menuRef.current && menuRef.current.contains(t)) return;

      setProfileOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileOpen(false);
    };

    window.addEventListener("pointerdown", onDown, { capture: true });
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("pointerdown", onDown, { capture: true } as any);
      window.removeEventListener("keydown", onKey);
    };
  }, [profileOpen]);

  // compute portal menu position (fixed to viewport, anchored to button)
useEffect(() => {
  if (!profileOpen) return;

  const MENU_W = 224; // w-56 = 14rem = 224px
  const GAP = 10;
  const PAD = 8;

  const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

  const calc = () => {
    const b = btnRef.current;
    if (!b) return;

    const r = b.getBoundingClientRect();

    // below the button
    const top = Math.round(r.bottom + GAP);

    // ✅ Decide opening direction to stay inside viewport:
    // - button on left half => open to the RIGHT (menu left aligned to button left)
    // - button on right half => open to the LEFT (menu right aligned to button right)
    const openRight = r.left + r.width / 2 < window.innerWidth / 2;

    const rawLeft = openRight
      ? Math.round(r.left)
      : Math.round(r.right - MENU_W);

    // keep inside viewport
    const left = clamp(rawLeft, PAD, window.innerWidth - MENU_W - PAD);

    setMenuPos({ top, left });
  };

  calc();

  window.addEventListener("resize", calc);
  window.addEventListener("scroll", calc, { passive: true });

  return () => {
    window.removeEventListener("resize", calc);
    window.removeEventListener("scroll", calc as any);
  };
}, [profileOpen]);

  const gems = String(player.gems);
const cash = `$${player.cash.toFixed(2)}`;

  function onAddCash() {
    const next = updatePlayer({ cash: player.cash + 1 });
    setPlayer(next);
  }

  const MenuPortal = profileOpen
    ? createPortal(
        <div
          className="fixed inset-0"
          style={{
            zIndex: 20000, // 🚀 always above any game overlay (ghost z-[9999], etc.)
          }}
        >
          {/* optional subtle backdrop to improve readability */}
          <div
            className="absolute inset-0"
            style={{
              background: "transparent",
            }}
          />

          <div
            ref={menuRef}
            className="fixed w-56 overflow-hidden rounded-3xl border border-white/15 bg-[#4b168f]/95 shadow-[0_40px_140px_-80px_rgba(0,0,0,0.95)]"
            style={{
  top: menuPos.top,
  left: menuPos.left,
}}
          >
            <div className="px-4 py-3">
              <div className="text-xs text-white/70">Player</div>
              <div className="mt-1 font-semibold">VIBRANTPANDA257</div>
            </div>
            <div className="h-px bg-white/10" />
         
<Link
  href="/profile"
  onClick={() => setProfileOpen(false)}
  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10"
>
  <Icon name="👤" /> <span className="font-medium">Profile</span>
</Link>

<Link
  href="/friends"
  onClick={() => setProfileOpen(false)}
  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10"
>
  <Icon name="👥" /> <span className="font-medium">Friends</span>
</Link>

<Link
  href="/rewards"
  onClick={() => setProfileOpen(false)}
  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10"
>
  <Icon name="🎁" /> <span className="font-medium">Daily Rewards</span>
</Link>

<Link
  href="/settings"
  onClick={() => setProfileOpen(false)}
  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10"
>
  <Icon name="⚙️" /> <span className="font-medium">Settings</span>
</Link>

<div className="h-px bg-white/10" />

<Link
  href="/login"
  onClick={() => setProfileOpen(false)}
  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/10"
>
  <span className="flex items-center gap-3">
    <Icon name="🔑" /> <span className="font-medium">Login</span>
  </span>
  <span className="text-xs text-white/70">→</span>
</Link>

<Link
  href="/save-account"
  onClick={() => setProfileOpen(false)}
  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/10"
>
  <span className="flex items-center gap-3">
    <Icon name="💾" /> <span className="font-medium">Save Account</span>
  </span>
  <span className="text-xs text-white/70">→</span>
</Link>

          </div>
        </div>,
        document.body
      )
    : null;

  return (
  <>
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)]">
      <div className="flex items-center justify-between gap-3">
        {/* LEFT: menu + currencies */}
        <div className="flex items-center gap-2">
          {/* profile dropdown button (menu) */}
          <div className="relative">
            <button
              type="button"
              ref={btnRef}
              onClick={() => setProfileOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/10"
              aria-label="Profile menu"
              title="Profile"
            >
              <span className="text-lg">🐺</span>
            </button>
          </div>

          {/* gems */}
          <Link
            href="/shop"
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/15 px-3 py-2"
            title="Shop"
          >
            <Icon name="💎" />
            <div className="text-sm font-semibold">{gems}</div>
          </Link>

          {/* cash */}
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
        </div>

        {/* RIGHT: back (only on /games/*) */}
        {showBack ? (
          <Link
            href="/games"
            className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/10 text-lg"
            aria-label="Back"
            title="Back"
          >
            ←
          </Link>
        ) : null}
      </div>
    </div>

    {MenuPortal}
  </>
);
}
// ===== FILE END: apps/web/components/shell/TopHud.tsx =====