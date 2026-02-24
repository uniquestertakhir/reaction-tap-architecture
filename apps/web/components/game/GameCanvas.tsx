// ===== FILE START: apps/web/components/game/GameCanvas.tsx =====
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { addVerifiedRun } from "@/lib/leaderboard";
import { apiGetMatch, apiGetRuns } from "@/lib/matchApi";
import { readPlayer, updatePlayer } from "@/lib/playerStore";
import { addResultsRun } from "@/lib/resultsStore";

type Props = {
  durationMs?: number; // default 30s
  canPlay?: boolean; // default true (solo). match needs started.
  onGameEnd?: (result: { win: boolean; score: number; ms: number }) => void;
};

type Rect = { left: number; top: number; width: number; height: number };

// ✅ NEW: game id for this canvas (plugin identity)
const GAME_ID = "reaction-tap";

type RunResult = {
  gameId: string;
  matchId: string | null;
  playerId: string;
  seed: number;
  hits: number;
  misses: number;
  avgReactionMs: number | null;
  score: number;
  durationMs: number;
  spawnCount: number;
  tapCount: number;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function GameCanvas({ durationMs = 30_000, canPlay = true }: Props) {
  const sp = useSearchParams();
  const matchId = sp.get("matchId"); // string | null

  // ===== playerId (per-tab) =====
  const [playerId, setPlayerId] = useState("player");
  useEffect(() => {
    const KEY = "rt_tab_player_id_v1";
    try {
      const existing = window.sessionStorage.getItem(KEY);
      if (existing && existing.trim()) {
        setPlayerId(existing);
        return;
      }

      const fresh =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? `p_${crypto.randomUUID()}`
          : `p_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;

      window.sessionStorage.setItem(KEY, fresh);
      setPlayerId(fresh);
    } catch {
      setPlayerId(`p_${Date.now()}`);
    }
  }, []);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const [phase, setPhase] = useState<"idle" | "ready" | "go" | "ended">("idle");
  const [timeLeftMs, setTimeLeftMs] = useState(durationMs);

  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [reactionSumMs, setReactionSumMs] = useState(0);
  const [reactionCount, setReactionCount] = useState(0);
  const lastSpawnAtRef = useRef<number | null>(null);

  const [roundSeed, setRoundSeed] = useState<number | null>(null);
  const [matchInfo, setMatchInfo] = useState<any>(null);
  const [matchPollError, setMatchPollError] = useState<string | null>(null);

  type RunItem = {
    id: string;
    createdAt: number;
    serverScore: number;
    matchId: string;
    playerId?: string | null;
    gameId?: string | null;
    seed: number;
    hits: number;
    misses: number;
    avgReactionMs: number | null;
    score: number;
    durationMs: number;
    spawnCount: number;
    tapCount: number;
  };

  const [runs, setRuns] = useState<RunItem[] | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);

  // ✅ Practice reward (solo, no matchId)
  const [practiceRewardGems, setPracticeRewardGems] = useState<number | null>(null);

  const [serverVerify, setServerVerify] = useState<
    | { verified: true; serverScore: number }
    | { verified: false; reason?: string }
    | null
  >(null);

  // target
  const [targetId, setTargetId] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);

  // timing
  const startAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const resultEmittedRef = useRef(false);

// ✅ NEW: idempotency guard for /run/verify (prevents double submit in dev/strict-mode)
const verifyOnceRef = useRef<string | null>(null);

// prevent auto-start loop in match mode
const autoStartedForMatchRef = useRef<string | null>(null);
const joinedMatchRef = useRef<string | null>(null);

  const avgReactionMs = reactionCount > 0 ? reactionSumMs / reactionCount : null;

  const score = useMemo(() => {
    const base = hits * 10 - misses * 5;
    const bonus = avgReactionMs !== null && avgReactionMs < 250 ? 200 : 0;
    return base + bonus;
  }, [hits, misses, avgReactionMs]);

  function computeNextTargetRect(seed: number, nextId: number): Rect | null {
    const el = containerRef.current;
    if (!el) return null;

    // ✅ Real rendered size
    const r = el.getBoundingClientRect();
    const W = Math.floor(r.width);
    const H = Math.floor(r.height);

    // layout not ready yet
    if (W <= 0 || H <= 0) {
      const fallbackSize = 64;
      return { left: 0, top: 0, width: fallbackSize, height: fallbackSize };
    }

    // target shrinks a bit as id grows (difficulty)
// ✅ FAIR: size is relative to field size (same feel across devices)
const minSide = Math.max(1, Math.min(W, H));

// start around ~14% of min side, then shrink slowly
const baseSize = Math.round(minSide * 0.14);
const shrinkPerHit = Math.max(0.6, minSide * 0.0018); // scales with device
const rawSize = baseSize - nextId * shrinkPerHit;

// clamp to keep playable
const size = clamp(rawSize, Math.max(36, Math.round(minSide * 0.08)), Math.round(minSide * 0.18));

    const k = seed * 0.000001;
    const a = (Math.sin((nextId + 1 + k) * 12.9898) * 43758.5453) % 1;
    const b = (Math.sin((nextId + 1 + k) * 78.233) * 12345.6789) % 1;

    const x01 = a < 0 ? a + 1 : a;
    const y01 = b < 0 ? b + 1 : b;

    // ✅ FAIR PLAY AREA: center square of min(W,H)
// screen is still fullscreen, but spawn zone is identical across devices
const field = Math.max(1, Math.min(W, H));
const ox = Math.floor((W - field) / 2);
const oy = Math.floor((H - field) / 2);

const maxLeft = Math.max(0, field - size);
const maxTop = Math.max(0, field - size);

const left = ox + Math.round(x01 * maxLeft);
const top = oy + Math.round(y01 * maxTop);

return { left, top, width: size, height: size };
  }

  function reset() {
    setPhase("idle");
    setTimeLeftMs(durationMs);
    setHits(0);
    setMisses(0);
    setReactionSumMs(0);
    setReactionCount(0);
    setTargetId(0);
    setTargetRect(null);
    startAtRef.current = null;
    lastSpawnAtRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
rafRef.current = null;

// ✅ allow verify again for next run
verifyOnceRef.current = null;
  }

  function start() {
    reset();
    setServerVerify(null);
    resultEmittedRef.current = false;

    const isMatchMode = !!matchId && String(matchInfo?.status || "") === "started";

    let runMs = durationMs;

    if (isMatchMode) {
      const startedAt = Number(matchInfo?.startedAt);
      const matchDuration = Number.isFinite(Number(matchInfo?.durationMs))
        ? Number(matchInfo.durationMs)
        : 30_000;

      if (Number.isFinite(startedAt)) {
        const left = startedAt + matchDuration - Date.now();
        runMs = Math.max(0, Math.min(durationMs, left));
      }

      if (runMs <= 0) {
        resultEmittedRef.current = true;
        setServerVerify({ verified: false, reason: "match_ended" });
        setPhase("ended");
        return;
      }
    }

    const seed =
      isMatchMode && Number.isFinite(Number(matchInfo?.startedAt))
        ? Number(matchInfo.startedAt)
        : Date.now();

    setRoundSeed(seed);

    // match: go immediately
    if (isMatchMode) {
      setPhase("go");
      setTimeLeftMs(runMs);
      startAtRef.current = performance.now();

      const firstRect = computeNextTargetRect(seed, 0);
      setTargetRect(firstRect);
      lastSpawnAtRef.current = performance.now();

      const tick = () => {
        const startAt = startAtRef.current;
        if (!startAt) return;

        const now2 = performance.now();
        const elapsed = now2 - startAt;
        const left = Math.max(0, runMs - elapsed);

        setTimeLeftMs(left);

        if (left <= 0) {
          setPhase("ended");
          return;
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    // SOLO
    setPhase("ready");

    const now = Date.now();
    const d01 = ((Math.sin(now * 0.001) * 10000) % 1 + 1) % 1; // 0..1
    const delayMs = 800 + Math.floor(d01 * 700); // ✅ быстрее и приятнее: 0.8..1.5s

    window.setTimeout(() => {
      setPhase("go");
      setTimeLeftMs(durationMs);
      startAtRef.current = performance.now();

      const firstRect = computeNextTargetRect(seed, 0);
      setTargetRect(firstRect);
      lastSpawnAtRef.current = performance.now();

      const tick = () => {
        const startAt = startAtRef.current;
        if (!startAt) return;

        const now2 = performance.now();
        const elapsed = now2 - startAt;
        const left = Math.max(0, durationMs - elapsed);

        setTimeLeftMs(left);

        if (left <= 0) {
          setPhase("ended");
          return;
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    }, delayMs);
  }

  // cleanup raf on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // poll match
  useEffect(() => {
    if (!matchId) return;

    let alive = true;
    let t: any = null;

    const tick = async () => {
      let st = "";
      try {
        const res = await apiGetMatch(matchId);

        if (!alive) return;

        if (!res.ok) {
          if (res.status === 404 && res.error === "not_found") {
            setMatchInfo(null);
            setMatchPollError("not_found");
          } else {
            setMatchPollError(res.error || "network_error");
          }
        } else {
          setMatchInfo(res.data.match);
          setMatchPollError(null);
          st = String(res.data.match?.status || "");
        }
      } catch {
        if (!alive) return;
        setMatchPollError("network_error");
      } finally {
        if (!alive) return;
        const delay = st === "ended" ? 1500 : 800;
        t = setTimeout(tick, delay);
      }
    };

    tick();

    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [matchId]);

  // poll runs
  useEffect(() => {
    if (!matchId) return;

    let alive = true;
    let t: any = null;

    const tick = async () => {
      try {
        setRunsLoading(true);
        const res = await apiGetRuns(matchId);

        if (!alive) return;

        if (!res.ok) {
          setRunsError(res.error || "network_error");
          return;
        }

        const items = [...res.data.items].sort(
          (a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)
        );

        setRuns(items as any);
        setRunsError(null);
      } catch {
        if (!alive) return;
        setRunsError("network_error");
      } finally {
        if (!alive) return;
        setRunsLoading(false);

        const st = String(matchInfo?.status || "");
        const hasWinner = typeof (matchInfo as any)?.serverScore === "number";
        if (st === "ended" && hasWinner) {
          t = null;
          return;
        }

        t = setTimeout(tick, 1200);
      }
    };

    tick();

    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [matchId, matchInfo?.status, (matchInfo as any)?.serverScore]);

  // emit run result once when ended
  useEffect(() => {
    if (phase !== "ended") return;
if (roundSeed === null) return;

// ✅ idempotency key = same run (matchId + seed + playerId)
const verifyKey = `${matchId || "solo"}::${roundSeed}::${playerId}`;
if (verifyOnceRef.current === verifyKey) return;
verifyOnceRef.current = verifyKey;

// ✅ keep your existing guard too (UI/result emit)
if (resultEmittedRef.current) return;

    setPracticeRewardGems(null);

    const result: RunResult = {
      gameId: GAME_ID,
      matchId,
      playerId,
      seed: roundSeed,
      hits,
      misses,
      avgReactionMs: reactionCount > 0 ? reactionSumMs / reactionCount : null,
      score,
      durationMs,
      spawnCount: hits + 1,
      tapCount: hits + misses,
    };

    resultEmittedRef.current = true;

    // PRACTICE: award gems + store in results
    if (!matchId) {
      const earned = Math.max(1, Math.floor(score / 50));

      try {
        const p = readPlayer();
        updatePlayer({ gems: (p.gems || 0) + earned });
      } catch {}

      try {
        const modeParam = sp.get("mode") || "warm-up";
        addResultsRun({
          gameId: GAME_ID,
          title: "Warm up",
          currency: "gems",
          prize: earned,
          matchId: null,
          mode: String(modeParam),
          score,
        });
      } catch {}

      setPracticeRewardGems(earned);
      setServerVerify({ verified: true, serverScore: score });
      return;
    }

    

    fetch("/api/run/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => null);

        if (!r.ok) {
          const reason =
            (j && typeof j.reason === "string" && j.reason) ||
            (r.status === 409 ? "match_ended" : r.status === 404 ? "match_not_found" : "api_error");

          setServerVerify({ verified: false, reason });
          return null;
        }

        setServerVerify(j);
        return j;
      })
      .then(async (data) => {
        if (!data) return;
        if (data?.verified === false && data?.reason === "match_ended") return;

        if (data?.verified === true && typeof data.serverScore === "number") {
          addVerifiedRun({
            gameId: GAME_ID,
            seed: result.seed,
            hits: result.hits,
            misses: result.misses,
            avgReactionMs: result.avgReactionMs,
            durationMs: result.durationMs,
            spawnCount: result.spawnCount,
            tapCount: result.tapCount,
            serverScore: data.serverScore,
            ...(result.matchId ? { matchId: result.matchId } : {}),
          } as any);

          try {
            if (!matchId) return;

            const r2 = await fetch(`/api/match/${encodeURIComponent(matchId)}/end`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                serverScore: data.serverScore,
                winnerRunId: data.runId || data.id,
                winnerPlayerId: playerId,
              }),
            });

            await r2.json();
          } catch {}
        }
      })
      .catch(() => {
        setServerVerify({ verified: false, reason: "network_error" });
      });
  }, [phase, roundSeed, hits, misses, reactionSumMs, reactionCount, score, durationMs, matchId, playerId, sp]);

  function onHit(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (phase === "ready") {
      setPhase("ended");
      return;
    }
    if (phase !== "go") return;

    const now = performance.now();
    const spawnedAt = lastSpawnAtRef.current;
    if (spawnedAt !== null) {
      const reaction = Math.max(0, now - spawnedAt);
      setReactionSumMs((s) => s + reaction);
      setReactionCount((c) => c + 1);
    }

    setHits((x) => x + 1);

    const nextId = targetId + 1;
    setTargetId(nextId);
    if (roundSeed !== null) setTargetRect(computeNextTargetRect(roundSeed, nextId));
    lastSpawnAtRef.current = performance.now();
  }

  function onMiss() {
    if (phase === "ready") {
      setPhase("ended");
      return;
    }
    if (phase !== "go") return;
    setMisses((x) => x + 1);
  }

  const mm = Math.floor(timeLeftMs / 60_000);
  const ss = Math.floor((timeLeftMs % 60_000) / 1000);
  const ms = Math.floor((timeLeftMs % 1000) / 10);
  const timeStr = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;

  const isEnded = !!matchId && String(matchInfo?.status || "") === "ended";
  const isMatchMissing = !!matchId && (matchPollError === "not_found" || matchPollError === "match_not_found");

  const effectiveCanPlay = !!canPlay && !isEnded && !isMatchMissing;

  // ✅ Fullscreen during play + lock scroll
  const isPlaying = phase === "ready" || phase === "go";
    // ✅ real visible viewport height (mobile-safe). fixes "field extends downward"
  const [vpH, setVpH] = useState<number | null>(null);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;

    const read = () => {
      const h = vv?.height || window.innerHeight;
      setVpH(Number.isFinite(h) ? Math.floor(h) : null);
    };

    read();

    if (vv) vv.addEventListener("resize", read);
    window.addEventListener("resize", read);

    return () => {
      if (vv) vv.removeEventListener("resize", read);
      window.removeEventListener("resize", read);
    };
  }, []);
  useEffect(() => {
    if (!isPlaying) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isPlaying]);

  // ===== REPLACE START: match auto-join + autostart =====
useEffect(() => {
  if (!matchId) return;

  // 1) JOIN once per matchId
  if (joinedMatchRef.current !== matchId) {
    joinedMatchRef.current = matchId;

    fetch(`/api/match/${encodeURIComponent(matchId)}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gameId: GAME_ID,
        playerId,
      }),
    }).catch(() => {
      // ignore; polling will still show match state
    });
  }

  // 2) react to match state
  const st = String(matchInfo?.status || "");

  if (st === "ended") {
    if (phase !== "ended") {
      resultEmittedRef.current = true;
      setServerVerify({ verified: false, reason: "match_ended" });
      setPhase("ended");
    }
    return;
  }

  if (st === "started" && phase === "idle" && effectiveCanPlay) {
    if (autoStartedForMatchRef.current !== matchId) {
      autoStartedForMatchRef.current = matchId;
      start();
    }
  }
}, [matchId, matchInfo?.status, phase, effectiveCanPlay, playerId]);
// ===== REPLACE END: match auto-join + autostart =====

  // ==== UI building blocks ====

  const GhostHud = (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 opacity-60">
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-2 text-[11px] text-white/70 backdrop-blur">
        <span className="font-mono text-white/80">{timeStr}</span>
        <span className="text-white/40">{matchId ? "match" : "solo"}</span>
        <span className="ml-2 text-white/40">•</span>
        <span>
          hits <span className="text-white/90">{hits}</span>
        </span>
        <span className="text-white/40">•</span>
        <span>
          score <span className="text-white/90">{score}</span>
        </span>
      </div>
    </div>
  );

  const Target = targetRect ? (
    <button
      type="button"
      aria-label="Tap target"
      onPointerDown={onHit}
      className="absolute rounded-full border border-white/20 active:scale-95"
      style={{
        left: targetRect.left,
        top: targetRect.top,
        width: targetRect.width,
        height: targetRect.height,
        touchAction: "none",
        background:
          "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.35) 16%, rgba(255,255,255,0) 40%), linear-gradient(135deg, rgba(255,46,144,0.98), rgba(168,85,247,0.98))",
        boxShadow:
          "0 14px 34px rgba(168,85,247,0.40), 0 0 46px rgba(255,46,144,0.30), inset 0 3px 14px rgba(255,255,255,0.28)",
      }}
    />
  ) : null;

  const Field = (
    <div
  ref={containerRef}
  className={
    "relative w-full overflow-hidden bg-gradient-to-b from-white/6 to-black " +
    (isPlaying ? "rounded-none" : "h-[62vh] min-h-[460px] rounded-3xl border border-white/10")
  }
  style={
    isPlaying
      ? {
          height: vpH ? `${vpH}px` : "100vh",
          width: "100vw",
        }
      : undefined
  }
  onPointerDown={onMiss}
>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_520px_at_50%_-10%,rgba(168,85,247,0.18),transparent_60%)]" />

      {GhostHud}

      {Target}

      {phase === "go" && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-white/10 px-4 py-1 text-sm font-semibold text-white/90 backdrop-blur">
          GO!
        </div>
      )}

      {phase === "ready" && (
        <div className="absolute inset-0 z-30 grid place-items-center">
          <div className="rounded-[28px] border border-white/10 bg-black/60 p-6 text-center shadow-[0_30px_110px_rgba(0,0,0,0.75)] backdrop-blur">
            <div className="text-sm text-white/70">Get ready…</div>
            <div className="mt-1 text-2xl font-semibold">Wait for GO</div>
            <div className="mt-3 text-xs text-white/60">Don’t tap early.</div>
          </div>
        </div>
      )}

      {phase === "idle" && (
        <div className="absolute inset-0 z-40 grid place-items-center">
          <div className="w-[86%] max-w-[360px] rounded-[28px] border border-white/10 bg-black/55 p-5 text-center shadow-[0_30px_110px_rgba(0,0,0,0.75)] backdrop-blur">
            <div className="text-[18px] font-semibold">Ready?</div>
            <div className="mt-2 text-sm text-white/70">Tap targets as fast as you can.</div>

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                start();
              }}
              disabled={!effectiveCanPlay}
              className={
                "mt-5 w-full rounded-2xl px-5 py-3 text-sm font-semibold " +
                (effectiveCanPlay ? "bg-white text-black" : "cursor-not-allowed bg-white/20 text-white/60")
              }
            >
              {effectiveCanPlay
                ? "Start"
                : isMatchMissing
                ? "Match not found"
                : isEnded
                ? "Match ended"
                : "Waiting…"}
            </button>

            {matchId ? (
              <div className="mt-3 text-[11px] text-white/50">Match mode starts automatically when ready.</div>
            ) : (
              <div className="mt-3 text-[11px] text-white/50">Practice rewards 💎 after the run.</div>
            )}
          </div>
        </div>
      )}

      {phase === "ended" && (
        <div className="absolute inset-0 z-50 grid place-items-center">
          <div className="w-[86%] max-w-[360px] rounded-[28px] border border-white/10 bg-black/60 p-6 text-center shadow-[0_30px_110px_rgba(0,0,0,0.75)] backdrop-blur">
            <div className="text-sm text-white/70">Run finished</div>
            <div className="mt-1 text-3xl font-semibold">{score}</div>
            <div className="mt-1 text-xs text-white/60">Score</div>

            {practiceRewardGems !== null ? (
              <div className="mt-3 text-sm font-semibold text-emerald-200">+{practiceRewardGems} 💎 earned</div>
            ) : null}

            {serverVerify && !matchId ? <div className="mt-2 text-xs text-white/60">Verified ✅</div> : null}

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  start();
                }}
                disabled={isEnded}
                className={
                  "w-full rounded-2xl px-5 py-3 text-sm font-semibold " +
                  (isEnded ? "cursor-not-allowed bg-white/20 text-white/60" : "bg-white text-black")
                }
              >
                {isEnded ? "Match ended" : "Play again"}
              </button>

              <a
                href="/games"
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white"
              >
                Back to Games
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ✅ When playing: fullscreen field only (no top blocks)
    if (isPlaying) {
    return createPortal(
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 999999,
          background: "black",
        }}
      >
        {Field}
      </div>,
      document.body
    );
  }

  // ✅ Normal (not playing): keep regular block layout
  return (
    <div className="w-full">
      {Field}
    </div>
  );
}
// ===== FILE END: apps/web/components/game/GameCanvas.tsx =====