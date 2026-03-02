// ===== FILE START: apps/web/app/(public)/profile/page.tsx =====
"use client";

import { useEffect, useState } from "react";
import { readPlayer } from "@/lib/playerStore";

type Player = {
  playerId: string;
  gems: number;
  cash: number;
  level: number;
  xp: number;
};

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default function ProfilePage() {
  const [p, setP] = useState<Player>(() => ({
    playerId: "p_unknown",
    gems: 0,
    cash: 0,
    level: 1,
    xp: 0,
  }));

  useEffect(() => {
    const v = readPlayer() as any;
    setP(v);
  }, []);

  const cash = `$${Number(p.cash || 0).toFixed(2)}`;
  const gems = String(p.gems || 0);
  const level = String(p.level || 1);
  const xp = String(p.xp || 0);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)]">
      <div className="text-xs font-semibold tracking-widest text-white/60">
        PROFILE
      </div>
      <div className="mt-2 text-3xl font-extrabold">Player</div>
      <div className="mt-1 text-sm text-white/70">
        Your local profile + stats on this device.
      </div>

      <div className="mt-5 rounded-3xl border border-white/10 bg-black/10 p-4">
        <div className="text-xs text-white/60">Player ID</div>
        <div className="mt-1 break-all font-semibold">{p.playerId}</div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <StatCard label="Gems" value={gems} />
        <StatCard label="Cash" value={cash} />
        <StatCard label="Level" value={level} />
        <StatCard label="XP" value={xp} />
      </div>

      <div className="mt-6 text-xs text-white/50">
        Next: connect login/save account to sync this profile across devices.
      </div>
    </div>
  );
}
// ===== FILE END =====