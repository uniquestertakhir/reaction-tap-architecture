// ===== FILE START: apps/web/app/(public)/games/[gameId]/page.tsx =====
"use client";

import React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { readPlayer } from "@/lib/playerStore";

type Currency = "cash" | "gems";

type Mode = {
  id: string;
  title: string;
  subtitle?: string;
  playersText?: string; // e.g. "5 PLAYERS"
  currency: Currency;
  entryFee: number; // cash: dollars; gems: diamonds
  prizePool: number; // cash: dollars; gems: diamonds
  limited?: boolean;

  // LIMITED timer (client-only)
  durationMs?: number; // e.g. 6 hours
  startedAt?: number; // unix ms; if omitted we'll persist it per mode in localStorage
  requiresLevel?: number; // locked until level
};

type GameConfig = {
  id: string;
  name: string;
  theme: "violet" | "green" | "pink" | "gold" | "blue" | "red";
  modes: Mode[];
};

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

// ===== limited timer helpers =====
function formatTimeLeft(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function limitedKey(gameId: string, modeId: string) {
  return `rt_limited_start_${gameId}_${modeId}`;
}

function readLimitedStart(gameId: string, modeId: string): number | null {
  try {
    const v = localStorage.getItem(limitedKey(gameId, modeId));
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeLimitedStart(gameId: string, modeId: string, startedAt: number) {
  try {
    localStorage.setItem(limitedKey(gameId, modeId), String(startedAt));
  } catch {
    // ignore
  }
}
// ===== end limited helpers =====

function headerTheme(theme: GameConfig["theme"]) {
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

const GAMES: Record<string, GameConfig> = {
  "reaction-tap": {
    id: "reaction-tap",
    name: "Reaction Tap",
    theme: "violet",
    modes: [
      {
        id: "ox-clash",
        title: "Ox Clash",
        subtitle: "Unlocks at level 6",
        playersText: "5 PLAYERS",
        currency: "cash",
        entryFee: 4,
        prizePool: 14,
        requiresLevel: 6,
      },
      {
        id: "monkey-wins",
        title: "Monkey Wins",
        subtitle: "Unlocks at level 5",
        playersText: "5 PLAYERS",
        currency: "cash",
        entryFee: 2,
        prizePool: 7,
        requiresLevel: 5,
      },

      // active
      {
        id: "starter-brawl",
        title: "Starter Brawl",
        subtitle: "Limited time only!",
        playersText: "5 PLAYERS",
        currency: "cash",
        entryFee: 0.3,
        prizePool: 1.7,
        limited: true,
        durationMs: 6 * 60 * 60 * 1000, // 6 hours
      },

      { id: "warm-up", title: "Warm up", currency: "gems", entryFee: 50, prizePool: 120 },
      { id: "cash-factory", title: "Cash Factory", currency: "gems", entryFee: 1000, prizePool: 2000 },
    ],
  },
};

export default function GameModesPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = (params?.gameId || "").toString();
  const router = useRouter();

  const [player, setPlayer] = React.useState(() => ({
    level: 0,
    xp: 0,
    gems: 0,
    cash: 0,
  }));

  React.useEffect(() => {
    setPlayer(readPlayer());
  }, []);

  // client-only clock (no hydration mismatch because initial render shows no timer)
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const game = GAMES[gameId] || GAMES["reaction-tap"];

  return (
    <div>
      {/* top header block like Blitz (under TopHud) */}
      <div className={"overflow-hidden rounded-3xl border border-white/10 " + headerTheme(game.theme)}>
        {/* bonus row */}
        <div className="flex items-center justify-between px-4 py-3 text-xs font-extrabold tracking-wide">
          <div className="text-amber-200 drop-shadow">100% BONUS!</div>
          <div className="text-white/80">LEVEL UP RUSH</div>
        </div>

        {/* title/logo row */}
        <div className="px-4 pb-5">
          <div className="flex items-center justify-between">
            <Link
              href="/games"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white/90"
            >
              ← Back
            </Link>

            <div className="text-center">
              <div className="text-[11px] text-white/70">GAME</div>
              <div className="mt-1 text-2xl font-extrabold tracking-wide">{game.name}</div>
            </div>

            <div className="w-[78px]" />
          </div>

          <div className="mt-3 text-sm text-white/70">
            Choose a mode. 💎 = practice-style. 💵 = real match. No “Practice vs Play” screen.
          </div>
        </div>
      </div>

      {/* modes list */}
      <div className="mt-4 flex flex-col gap-3">
        {game.modes.map((m) => {
          const locked = typeof m.requiresLevel === "number" && player.level < m.requiresLevel;
          const hasEnough = m.currency === "cash" ? player.cash >= m.entryFee : player.gems >= m.entryFee;

          const leftPrize = m.currency === "cash" ? money(m.prizePool) : `${m.prizePool}`;
          const rightEntry = m.currency === "cash" ? money(m.entryFee) : `${m.entryFee}`;

                    // ✅ NEW FLOW (NO /matchmaking folder):
// gems -> /practice (no matchmaking)
// cash -> /play (auto-match bootstraps inside PlayPage)
const playHref =
  m.currency === "gems"
    ? `/practice?gameId=${encodeURIComponent(game.id)}&mode=${encodeURIComponent(m.id)}`
    : `/play?gameId=${encodeURIComponent(game.id)}&mode=${encodeURIComponent(
        m.id
      )}&currency=usd&entry=${encodeURIComponent(String(m.entryFee))}&returnTo=${encodeURIComponent(
        `/games/${encodeURIComponent(game.id)}`
      )}`;

// if not enough funds => send to shop (and return back into the SAME flow)
// cash returns to /play auto-match bootstrap
const returnTo =
  m.currency === "cash"
    ? `/play?gameId=${encodeURIComponent(game.id)}&mode=${encodeURIComponent(
        m.id
      )}&currency=usd&entry=${encodeURIComponent(String(m.entryFee))}&returnTo=${encodeURIComponent(
        `/games/${encodeURIComponent(game.id)}`
      )}`
    : `/games/${encodeURIComponent(game.id)}`;

const shopHref =
  m.currency === "cash"
    ? `/shop?tab=cash&need=cash&amount=${encodeURIComponent(String(m.entryFee))}&returnTo=${encodeURIComponent(returnTo)}`
    : `/shop?tab=gems&need=gems&amount=${encodeURIComponent(String(m.entryFee))}&returnTo=${encodeURIComponent(returnTo)}`;

const finalHref = hasEnough ? playHref : shopHref;

          // LIMITED timer: persist per mode
          let timeLeftText: string | null = null;
          if (m.limited && m.durationMs && now !== null) {
            const persisted = readLimitedStart(game.id, m.id);
            const startedAt = m.startedAt ?? persisted ?? now;
            if (!persisted && !m.startedAt) writeLimitedStart(game.id, m.id, startedAt);
            const left = m.durationMs - (now - startedAt);
            timeLeftText = formatTimeLeft(left);
          }

          const card =
            "relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 " +
            (locked ? "opacity-90" : "cursor-pointer") +
            " shadow-[0_30px_120px_-90px_rgba(0,0,0,0.9)]";

          const onCardClick = () => {
            if (locked) return;
            router.push(finalHref);
          };

          return (
            <div
              key={m.id}
              className={card}
              role={locked ? undefined : "button"}
              tabIndex={locked ? -1 : 0}
              onClick={onCardClick}
              onKeyDown={(e) => {
                if (locked) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(finalHref);
                }
              }}
            >
              {/* LIMITED badge + timer */}
              {m.limited ? (
                <div className="absolute left-0 top-0 flex items-center gap-2 bg-red-600 px-3 py-1 text-[11px] font-extrabold animate-pulse">
                  🔥 LIMITED
                  {timeLeftText ? <span className="text-white/90">{timeLeftText}</span> : null}
                </div>
              ) : null}

              <div className="flex items-stretch">
                {/* left colored prize block */}
                <div
                  className={
                    "flex min-w-[110px] flex-col justify-center px-4 py-4 text-black " +
                    (m.currency === "cash" ? "bg-emerald-400" : "bg-violet-400")
                  }
                >
                  <div className="text-[10px] font-extrabold tracking-wide opacity-80">
                    {m.currency === "cash" ? "PRIZE POOL" : "PRIZE"}
                  </div>
                  <div className="mt-1 text-3xl font-extrabold leading-none">
                    {m.currency === "cash" ? leftPrize : `💎 ${leftPrize}`}
                  </div>
                </div>

                {/* right content */}
                <div className="flex flex-1 items-center justify-between px-4 py-4">
                  {/* center text */}
                  <div className="flex flex-col">
                    <div className="text-lg font-extrabold">{m.title}</div>
                    <div className="mt-1 text-sm text-white/70">
                      {m.subtitle || (m.currency === "cash" ? "Real match" : "Practice-style")}
                    </div>
                    {m.playersText ? (
                      <div className="mt-1 text-[11px] font-semibold text-white/50">{m.playersText}</div>
                    ) : null}
                  </div>

                  {/* entry + play */}
                  <div className="flex flex-col items-end">
                    <div className="text-[10px] font-extrabold tracking-wide text-white/50">ENTRY</div>
                    <div className="mt-1 text-lg font-extrabold">
                      {m.currency === "cash" ? rightEntry : `💎 ${rightEntry}`}
                    </div>

                    {/* CTA button (no <Link> inside clickable card) */}
                    <button
                      type="button"
                      disabled={locked}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (locked) return;
                        router.push(finalHref);
                      }}
                      className={
                        "mt-3 rounded-2xl px-6 py-2 text-sm font-extrabold transition-all duration-150 active:scale-95 " +
                        (locked
                          ? "bg-white/15 text-white/50"
                          : hasEnough
                          ? "bg-emerald-400 text-black"
                          : "bg-yellow-400 text-black")
                      }
                    >
                      {locked ? "Play" : hasEnough ? "Play" : "Get"}
                    </button>
                  </div>
                </div>
              </div>

              {/* lock overlay like Blitz */}
              {locked ? (
                <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-[2px]">
                  <div className="flex items-center gap-3 rounded-3xl border border-white/15 bg-black/40 px-4 py-3">
                    <div className="grid h-9 w-9 place-items-center rounded-2xl bg-white/10">🔒</div>
                    <div>
                      <div className="text-sm font-extrabold">Locked</div>
                      <div className="text-xs text-white/70">Unlocks at level {m.requiresLevel}</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-center text-[11px] text-white/45">
  Cash modes → auto-match in /play. Gems modes → /practice. If not enough → /shop.
</div>
    </div>
  );
}
// ===== FILE END: apps/web/app/(public)/games/[gameId]/page.tsx =====