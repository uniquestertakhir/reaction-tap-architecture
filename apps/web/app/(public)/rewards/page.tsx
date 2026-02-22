// ===== FILE START: apps/web/app/(public)/rewards/page.tsx =====
"use client";

export default function RewardsPage() {
  return (
    <div>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)]">
        <div className="text-xl font-semibold">Rewards</div>
        <div className="mt-2 text-sm text-white/70">
          Daily rewards, streaks, event bonuses — как у Blitz.
        </div>

        {/* Daily reward card */}
        <div className="mt-5 rounded-3xl border border-white/10 bg-black/15 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Daily Reward</div>
              <div className="text-xs text-white/60">Come back every day</div>
            </div>
            <div className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black">
              Claim
            </div>
          </div>

          <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs">
            {[1, 2, 3, 4, 5].map((d) => (
              <div
                key={d}
                className="rounded-2xl border border-white/10 bg-white/5 p-3"
              >
                <div className="text-white/60">Day {d}</div>
                <div className="mt-1 font-semibold">💎 {d * 5}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Events placeholder */}
        <div className="mt-5 rounded-3xl border border-white/10 bg-black/15 p-5 opacity-80">
          <div className="text-sm font-semibold">Events</div>
          <div className="mt-2 text-sm text-white/70">
            Limited-time tournaments and bonus prize pools will be here.
          </div>
        </div>

        <div className="mt-5 text-[11px] text-white/50">
          Следующий шаг: подключим реальную streak-логику и начисление 💎.
        </div>
      </div>
    </div>
  );
}
// ===== FILE END: apps/web/app/(public)/rewards/page.tsx =====
