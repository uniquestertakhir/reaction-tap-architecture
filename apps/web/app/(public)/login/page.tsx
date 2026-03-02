// ===== FILE START: apps/web/app/(public)/login/page.tsx =====
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { readPlayer, writePlayer } from "@/lib/playerStore";

function Card({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)]">
      <div className="text-lg font-semibold">{title}</div>
      {desc ? <div className="mt-1 text-sm text-white/70">{desc}</div> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function LoginPage() {
  const player = useMemo(() => readPlayer(), []);
  const [confirmReset, setConfirmReset] = useState(false);

  function resetLocalProfile() {
    const ok = confirmReset || window.confirm("Reset local profile on this device?");
    if (!ok) return;

    // generate a fresh local profile (new id)
    const fresh = {
      playerId: `p_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      gems: 0,
      cash: 0,
      level: 1,
      xp: 0,
    };

    writePlayer(fresh);
    setConfirmReset(false);
    alert("Local profile reset.");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)]">
        <div className="text-xs tracking-[0.22em] text-white/60">LOGIN</div>
        <h1 className="mt-2 text-4xl font-extrabold leading-tight">Account</h1>
        <p className="mt-2 max-w-md text-white/70">
          MVP mode: your profile is stored on this device. To use the same profile on another device,
          use <span className="font-semibold text-white">Export / Import</span>.
        </p>
      </div>

      <Card
        title="This device"
        desc="You are currently playing as a local profile (no email/password yet)."
      >
        <div className="flex flex-col gap-2 text-sm">
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="text-xs text-white/60">Player ID</div>
            <div className="mt-1 font-semibold">{player.playerId}</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-xs text-white/60">Gems</div>
              <div className="mt-1 text-lg font-bold">{player.gems}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-xs text-white/60">Cash</div>
              <div className="mt-1 text-lg font-bold">${player.cash.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/save-account"
            className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-black hover:opacity-90"
          >
            Export / Import code
          </Link>

          <button
            type="button"
            onClick={() => {
              setConfirmReset(true);
              resetLocalProfile();
            }}
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            Reset local profile
          </button>
        </div>

        <div className="mt-3 text-xs text-white/60">
          Next: real login + cloud sync (same account on all devices).
        </div>
      </Card>

      <Card
        title="Coming soon"
        desc="Email/phone login, passwordless, and cloud sync."
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/50"
          >
            Continue with Email
          </button>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/50"
          >
            Continue with Phone
          </button>
        </div>
      </Card>
    </div>
  );
}
// ===== FILE END: apps/web/app/(public)/login/page.tsx =====