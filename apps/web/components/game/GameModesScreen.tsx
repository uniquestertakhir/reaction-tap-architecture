// ===== FILE START: apps/web/components/game/GameModesScreen.tsx =====
"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readPlayer } from "@/lib/playerStore";
import {
  getGameConfig,
  type GameMode,
} from "@/lib/games/catalog";
import { buildModeHref } from "@/lib/games/buildModeHref";
import { joinCashMatch } from "@/lib/core/joinCashMatch";
import { buildCashGameUrl } from "@/lib/core/launchGame";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function formatTimeLeft(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function limitedKey(gameId: string, mode: string) {
  return `rt_limited_start_${gameId}_${mode}`;
}

function readLimitedStart(gameId: string, mode: string): number | null {
  try {
    const v = localStorage.getItem(limitedKey(gameId, mode));
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeLimitedStart(gameId: string, mode: string, startedAt: number) {
  try {
    localStorage.setItem(limitedKey(gameId, mode), String(startedAt));
  } catch {}
}

function headerTheme(theme: string) {
  switch (theme) {
    case "green":
      return "bg-[linear-gradient(180deg,#0f3d33_0%,#0b2a24_70%,rgba(0,0,0,0)_100%)]";
    case "pink":
      return "bg-[linear-gradient(180deg,#7a1048_0%,#4a0a2b_70%,rgba(0,0,0,0)_100%)]";
    case "gold":
      return "bg-[linear-gradient(180deg,#6b4a0a_0%,#3f2b06_70%,rgba(0,0,0,0)_100%)]";
    case "blue":
      return "bg-[linear-gradient(180deg,#0a2a6b_0%,#061a3f_70%,rgba(0,0,0,0)_100%)]";
    case "red":
      return "bg-[linear-gradient(180deg,#6b0a0a_0%,#3f0606_70%,rgba(0,0,0,0)_100%)]";
    default:
      return "bg-[linear-gradient(180deg,#4c1d95_0%,#2a0b5a_70%,rgba(0,0,0,0)_100%)]";
  }
}

type Props = {
  gameId: string;
  backHref?: string;
};

export default function GameModesScreen({
  gameId,
  backHref = "/games",
}: Props) {
  const router = useRouter();
  const game = getGameConfig(gameId);

  const [player, setPlayer] = React.useState(() => ({
    level: 0,
    xp: 0,
    gems: 0,
    cash: 0,
  }));

  const [now, setNow] = React.useState<number | null>(null);
  const [finding, setFinding] = React.useState<null | { label: string }>(null);

  React.useEffect(() => {
    setPlayer(readPlayer());
  }, []);

  React.useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function launchMode(mode: GameMode, hasEnough: boolean) {
    const { finalHref } = buildModeHref({
      gameId: game.id,
      mode,
      hasEnough,
    });

    if (mode.currency !== "cash" || !hasEnough) {
      router.push(finalHref);
      return;
    }

    setFinding({
      label: `Finding opponent… ${money(mode.entryFee)}`,
    });

    try {
      const result = await joinCashMatch({
        gameId: game.id,
        queue: mode.mode,
        entryUsd: mode.entryFee,
        players: Number(mode.players || 2),
      });

      if (!result.ok) {
        alert(`Matchmaking failed (${result.error})`);
        setFinding(null);
        return;
      }

            router.push(
        buildCashGameUrl({
          matchId: result.matchId,
          gameId: game.id,
          mode: mode.mode,
          modeId: mode.id,
          entry: mode.entryFee,
          prize: mode.prizePool,
          currency: "cash",
          stake: mode.entryFee,
          queue: mode.mode,
          returnTo: `/games/${game.id}/modes`,
        })
      );
    } catch (error) {
      console.error(error);
      alert("Matchmaking failed (network). Check API is running.");
      setFinding(null);
    }
  }

  return (
    <>
      <div>
        <div
          className={
            "overflow-hidden rounded-3xl border border-white/10 " +
            headerTheme(game.theme)
          }
        >
          <div className="flex items-center justify-between px-4 py-3 text-xs font-extrabold tracking-wide">
            <div className="text-amber-200 drop-shadow">100% BONUS!</div>
            <div className="text-white/80">LEVEL UP RUSH</div>
          </div>

          <div className="px-4 pb-5">
            <div className="flex items-center justify-between">
              <Link
                href={backHref}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white/90"
              >
                ← Back
              </Link>

              <div className="text-center">
                <div className="text-[11px] text-white/70">GAME</div>
                <div className="mt-1 text-2xl font-extrabold">
                  {game.name}
                </div>
              </div>

              <div className="w-[78px]" />
            </div>

            <div className="mt-3 text-sm text-white/70">
              Choose a mode. 💎 = practice-style. 💵 = real match.
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {game.modes.map((m) => {
            const locked =
              typeof m.requiresLevel === "number" &&
              player.level < m.requiresLevel;

            const hasEnough =
              m.currency === "cash"
                ? player.cash >= m.entryFee
                : player.gems >= m.entryFee;

            const leftPrize =
              m.currency === "cash"
                ? money(m.prizePool)
                : `${m.prizePool}`;

            const rightEntry =
              m.currency === "cash"
                ? money(m.entryFee)
                : `${m.entryFee}`;

            let timeLeftText: string | null = null;

            if (m.limited && m.durationMs && now !== null) {
              const persisted = readLimitedStart(game.id, m.mode);
              const startedAt = persisted ?? now;

              if (!persisted) writeLimitedStart(game.id, m.mode, startedAt);

              const left = m.durationMs - (now - startedAt);
              timeLeftText = formatTimeLeft(left);
            }

            return (
              <div
                key={m.id}
                className={
                  "relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_30px_120px_-90px_rgba(0,0,0,0.9)] " +
                  (locked || finding ? "opacity-90" : "cursor-pointer")
                }
                role={locked ? undefined : "button"}
                tabIndex={locked ? -1 : 0}
                onClick={() => {
                  if (locked || finding) return;
                  launchMode(m, hasEnough);
                }}
                onKeyDown={(e) => {
                  if (locked || finding) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    launchMode(m, hasEnough);
                  }
                }}
              >
                {m.limited && (
                  <div className="absolute left-0 top-0 flex items-center gap-2 bg-red-600 px-3 py-1 text-[11px] font-extrabold animate-pulse">
                    🔥 LIMITED
                    {timeLeftText && (
                      <span className="text-white/90">{timeLeftText}</span>
                    )}
                  </div>
                )}

                <div className="flex items-stretch">
                  <div
                    className={
                      "flex min-w-[110px] flex-col justify-center px-4 py-4 text-black " +
                      (m.currency === "cash"
                        ? "bg-emerald-400"
                        : "bg-violet-400")
                    }
                  >
                    <div className="text-[10px] font-extrabold">PRIZE</div>
                    <div className="mt-1 text-3xl font-extrabold">
                      {m.currency === "cash"
                        ? leftPrize
                        : `💎 ${leftPrize}`}
                    </div>
                  </div>

                  <div className="flex flex-1 items-center justify-between px-4 py-4">
                    <div>
                      <div className="text-lg font-extrabold">{m.title}</div>
                      <div className="text-sm text-white/70">
                        {m.subtitle}
                      </div>

                      {m.players && (
                        <div className="text-[11px] text-white/50">
                          {m.players} PLAYERS
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-white/50">ENTRY</div>

                      <div className="text-lg font-extrabold">
                        {m.currency === "cash"
                          ? rightEntry
                          : `💎 ${rightEntry}`}
                      </div>

                      <button
                        type="button"
                        disabled={locked || !!finding}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (locked || finding) return;
                          launchMode(m, hasEnough);
                        }}
                        className={
                          "mt-3 rounded-2xl px-6 py-2 text-sm font-extrabold transition-all duration-150 active:scale-95 " +
                          (locked
                            ? "bg-white/15 text-white/50"
                            : finding
                            ? "bg-white/15 text-white/50"
                            : hasEnough
                            ? "bg-emerald-400 text-black"
                            : "bg-yellow-400 text-black")
                        }
                      >
                        {locked
                          ? "Locked"
                          : finding
                          ? "Finding..."
                          : hasEnough
                          ? "Play"
                          : "Get"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 text-center text-[11px] text-white/45">
          Cash modes → auto match. Gems modes → practice.
        </div>
      </div>

      {finding ? (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/70 backdrop-blur">
          <div className="w-[88%] max-w-[420px] rounded-[28px] border border-white/12 bg-black/60 p-6 text-center shadow-[0_30px_110px_rgba(0,0,0,0.75)]">
            <div className="text-xs font-extrabold tracking-wide text-white/60">
              MATCHMAKING
            </div>
            <div className="mt-2 text-2xl font-extrabold">
              {finding.label}
            </div>
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
    </>
  );
}
// ===== FILE END: apps/web/components/game/GameModesScreen.tsx =====