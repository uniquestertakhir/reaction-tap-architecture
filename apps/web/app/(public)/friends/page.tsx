// ===== FILE START: apps/web/app/(public)/friends/page.tsx =====
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function FriendsPage() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)]">
      <div className="text-xs font-semibold tracking-[0.22em] text-white/60">
        FRIENDS
      </div>

      <div className="mt-2 text-4xl font-extrabold leading-tight">
        Friends
      </div>

      <div className="mt-2 text-white/70">
        Add friends, compare stats, and play together (later).
      </div>

      <div className="mt-6 grid gap-4">
        <div className="rounded-3xl border border-white/10 bg-black/15 p-5">
          <div className="text-sm font-semibold">Your friend code</div>
          <div className="mt-1 text-white/70 text-sm">
            Coming soon — we’ll show a shareable code here.
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/15 p-5">
          <div className="text-sm font-semibold">Friend list</div>
          <div className="mt-1 text-white/70 text-sm">
            Coming soon — list, search, invite, and match with friends.
          </div>
        </div>
      </div>

      <div className="mt-6 text-xs text-white/50">
        Next: wire real friends storage + invites/matchmaking entry.
      </div>
    </div>
  );
}
// ===== FILE END: apps/web/app/(public)/friends/page.tsx =====