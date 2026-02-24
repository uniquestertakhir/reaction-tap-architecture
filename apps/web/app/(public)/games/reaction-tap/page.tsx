// ===== FILE START: apps/web/app/(public)/games/reaction-tap/page.tsx =====
"use client";

import Link from "next/link";
import React from "react";
import { useRouter } from "next/navigation";
import { readPlayer, updatePlayer } from "@/lib/playerStore";

type ModeKind = "practice" | "cash";

type ModeCard = {
  id: string;
  title: string;
  subtitle: string;
  kind: ModeKind;

  // Practice
  gemsEntry?: number;
  gemsPrize?: number;

  // Cash
  cashEntryUsd?: number;
  prizePoolUsd?: number;
  players?: number;

  // Locking
  lockedLevel?: number;

  // UX
  badgeLeft?: string; // e.g. "LIMITED 00:00:00"
  badgeRight?: string; // e.g. "100% BONUS!"
};

async function safeJson(r: Response) {
  try {
    return await r.json();
  } catch {
    return null;
  }
}

export default function ReactionTapModesPage() {
  const router = useRouter();

    const [level, setLevel] = React.useState(1);
  const [gems, setGems] = React.useState(0);
  const [cash, setCash] = React.useState(0);

  // ✅ required for matchmaking
  const [playerId, setPlayerId] = React.useState<string>("");

  const [finding, setFinding] = React.useState<null | { label: string }>(null);

    React.useEffect(() => {
    const p = readPlayer();

    setLevel(p.level || 1);
    setGems(p.gems || 0);
    // @ts-ignore
    setCash(typeof p.cash === "number" ? p.cash : 0);

    // ✅ ensure playerId exists
    const existing = String((p as any)?.id || "").trim();
    if (existing) {
      setPlayerId(existing);
      return;
    }

    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `p_${crypto.randomUUID()}`
        : `p_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;

    try {
      updatePlayer({ id: fresh } as any);
    } catch {}
    setPlayerId(fresh);
  }, []);

  const MODES: ModeCard[] = [
    {
      id: "ox-clash",
      title: "Ox Clash",
      subtitle: "Real match • 5 players",
      kind: "cash",
      prizePoolUsd: 14.0,
      cashEntryUsd: 4.0,
      players: 5,
      lockedLevel: 6,
      badgeRight: "100% BONUS!",
    },
    {
      id: "monkey-wins",
      title: "Monkey Wins",
      subtitle: "Real match • 6 players",
      kind: "cash",
      prizePoolUsd: 7.0,
      cashEntryUsd: 2.0,
      players: 6,
      lockedLevel: 5,
    },
    {
      id: "starter-brawl",
      title: "Starter Brawl",
      subtitle: "Limited time only! • 5 players",
      kind: "cash",
      prizePoolUsd: 1.7,
      cashEntryUsd: 0.3,
      players: 5,
      badgeLeft: "LIMITED 00:00:00",
    },
    {
      id: "warm-up",
      title: "Warm up",
      subtitle: "Practice-style",
      kind: "practice",
      gemsPrize: 120,
      gemsEntry: 50,
    },
    {
      id: "cash-factory",
      title: "Cash Factory",
      subtitle: "Practice-style",
      kind: "practice",
      gemsPrize: 2000,
      gemsEntry: 1000,
    },
  ];

  const isLocked = (m: ModeCard) => !!m.lockedLevel && level < m.lockedLevel;

  async function startPractice(modeId: string) {
    // practice must be instant and go to /practice
    router.push(`/practice?gameId=reaction-tap&mode=${encodeURIComponent(modeId)}`);
  }

      async function startCashMatch(modeId: string, stakeUsd: number, players: number) {
    // cash must auto-match and start; no lobby
    setFinding({ label: `Finding opponent… $${stakeUsd.toFixed(2)}` });

        // ===== INSERT START: ensure API wallet has funds (DEV) =====
    const p0 = readPlayer();

    // ensure playerId exists in playerStore
    let pid = String((p0 as any)?.id || "").trim();
    if (!pid) {
      pid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? `p_${crypto.randomUUID()}`
          : `p_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
      try {
        updatePlayer({ id: pid } as any);
      } catch {}
    }

    // top up API wallet so /match/:id/stake won't fail with insufficient_funds
    // (API /wallet/fund is DEV-only and returns 403 in production)
    try {
      const topUp = Math.max(10, Math.ceil(stakeUsd * 50)); // enough for many tries
      await fetch("/api/wallet/fund", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId: pid, amount: topUp, currency: "USD" }),
      });
    } catch {}
    // ===== INSERT END: ensure API wallet has funds (DEV) =====

    try {
      const entry = Number(stakeUsd);
      if (!Number.isFinite(entry) || entry <= 0) {
        alert("Bad entry amount");
        setFinding(null);
        return;
      }

      const pid = String(playerId || "").trim();
      if (!pid) {
        alert("Missing playerId (refresh page)");
        setFinding(null);
        return;
      }

      const r = await fetch("/api/matchmaking/join", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          playerId: pid,
          gameId: "reaction-tap",
          queue: modeId,
          mode: modeId,          // (safe extra)
          currency: "USD",
          entry,                 // ✅ backend expects entry (not stake)
          players: Number(players) || 2,
        }),
      });

      const j = await safeJson(r);

      if (!r.ok) {
        console.error("Matchmaking join failed:", { status: r.status, body: j });
        alert(`Matchmaking failed. (${j?.error || "bad_request"})`);
        setFinding(null);
        return;
      }

      const matchId = String(j?.match?.id || j?.matchId || "").trim();
      if (!matchId) {
        console.error("Matchmaking join bad response:", j);
        alert("Matchmaking failed (bad response)");
        setFinding(null);
        return;
      }

      router.push(
        `/play?matchId=${encodeURIComponent(matchId)}&gameId=reaction-tap&mode=cash&stake=${encodeURIComponent(
          String(entry)
        )}&queue=${encodeURIComponent(modeId)}`
      );
    } catch (e) {
      console.error(e);
      alert("Matchmaking failed (network). Check API is running.");
      setFinding(null);
    }
  }

  return (
    <main className="min-h-[calc(100vh-72px)] px-4 pb-10 pt-4 text-white">
      {/* header like Blitz */}
      <div className="mx-auto w-full max-w-[520px]">
        <div className="rounded-[26px] border border-white/10 bg-white/5 p-4 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)]">
          <div className="flex items-center justify-between">
            <Link
              href="/games"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
            >
              ← Back
            </Link>

            <div className="text-right">
              <div className="text-xs text-white/60">GAME</div>
              <div className="text-3xl font-extrabold leading-tight">Reaction Tap</div>
            </div>
          </div>

          <div className="mt-3 text-sm text-white/70">
            Choose a mode. <span className="text-white/85">💎</span> = practice-style.{" "}
            <span className="text-white/85">💵</span> = real match. No “Practice vs Play” screen.
          </div>
        </div>

        {/* modes list */}
        <div className="mt-4 space-y-3">
          {MODES.map((m) => {
            const locked = isLocked(m);

            return (
              <div
                key={m.id}
                className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)]"
              >
                {/* optional ribbons */}
                {m.badgeRight ? (
                  <div className="absolute right-0 top-0 z-20 rounded-bl-2xl bg-white/15 px-3 py-2 text-xs font-extrabold text-white/90 backdrop-blur">
                    {m.badgeRight}
                  </div>
                ) : null}

                {m.badgeLeft ? (
                  <div className="absolute left-0 top-0 z-20 rounded-br-2xl bg-red-500/80 px-3 py-2 text-xs font-extrabold text-white">
                    {m.badgeLeft}
                  </div>
                ) : null}

                <div className="flex min-h-[108px] items-stretch">
                  {/* left prize block (Blitz-style) */}
                  <div className="w-[40%] min-w-[148px] bg-[linear-gradient(135deg,rgba(16,185,129,0.85),rgba(59,130,246,0.35))] p-4">
                    <div className="text-xs font-extrabold tracking-wide text-black/80">
                      {m.kind === "cash" ? "PRIZE POOL" : "PRIZE"}
                    </div>

                    <div className="mt-2 flex items-end gap-2">
                      {m.kind === "cash" ? (
                        <>
                          <div className="text-4xl font-black text-black">${m.prizePoolUsd?.toFixed(2)}</div>
                        </>
                      ) : (
                        <>
                          <div className="text-2xl font-black text-black">💎</div>
                          <div className="text-5xl font-black text-black">{m.gemsPrize}</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* right content */}
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <div className="text-xl font-extrabold">{m.title}</div>
                      <div className="mt-1 text-sm text-white/70">{m.subtitle}</div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      {/* entry */}
                      <div className="text-right">
                        <div className="text-[10px] font-extrabold tracking-wide text-white/60">ENTRY</div>
                        <div className="mt-1 text-lg font-extrabold">
                          {m.kind === "cash" ? (
                            <>${m.cashEntryUsd?.toFixed(2)}</>
                          ) : (
                            <>
                              💎 <span className="tabular-nums">{m.gemsEntry}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* play button */}
                      <button
                        type="button"
                        disabled={locked || !!finding}
                        onClick={() => {
                          if (locked) return;

                          if (m.kind === "practice") {
                            startPractice(m.id);
                          } else {
                            startCashMatch(m.id, Number(m.cashEntryUsd || 0), Number(m.players || 2));
                          }
                        }}
                        className={
                          "rounded-2xl px-6 py-3 text-sm font-extrabold " +
                          (locked || finding
                            ? "bg-white/10 text-white/60"
                            : "bg-emerald-400 text-black hover:brightness-110 active:scale-[0.99]")
                        }
                      >
                        Play
                      </button>
                    </div>

                    <div className="mt-2 text-[11px] text-white/55">
                      {m.kind === "cash"
                        ? "Cash mode → auto-match → starts instantly."
                        : "Gems mode → instant practice run."}
                    </div>
                  </div>
                </div>

                {/* lock overlay */}
                {locked ? (
                  <div className="absolute inset-0 z-30 grid place-items-center bg-black/45 backdrop-blur-[1px]">
                    <div className="rounded-3xl border border-white/15 bg-black/35 px-4 py-3 text-center">
                      <div className="text-sm font-extrabold">Locked</div>
                      <div className="mt-1 text-xs text-white/70">Unlocks at level {m.lockedLevel}</div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-5 text-center text-xs text-white/55">
          Cash modes → auto-match in <span className="text-white/75">/play</span>. Gems modes →{" "}
          <span className="text-white/75">/practice</span>. If not enough →{" "}
          <span className="text-white/75">/shop</span>.
        </div>
      </div>

      {/* matchmaking overlay */}
      {finding ? (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/70 backdrop-blur">
          <div className="w-[88%] max-w-[420px] rounded-[28px] border border-white/12 bg-black/60 p-6 text-center shadow-[0_30px_110px_rgba(0,0,0,0.75)]">
            <div className="text-xs font-extrabold tracking-wide text-white/60">MATCHMAKING</div>
            <div className="mt-2 text-2xl font-extrabold">{finding.label}</div>
            <div className="mt-5">
              <div className="mx-auto h-2 w-full max-w-[320px] overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[40%] animate-pulse rounded-full bg-white/40" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFinding(null)}
              className="mt-6 w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-extrabold text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
// ===== FILE END: apps/web/app/(public)/games/reaction-tap/page.tsx =====