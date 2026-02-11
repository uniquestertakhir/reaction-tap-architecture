// ===== FILE START: apps/web/components/game/GameCanvas.tsx =====
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { addVerifiedRun } from "@/lib/leaderboard";
import { apiGetMatch, apiGetRuns } from "@/lib/matchApi";

// ===== REPLACE START: Props =====
type Props = {
  durationMs?: number; // default 30s
  canPlay?: boolean; // default true (solo). match needs started.
};
// ===== REPLACE END: Props =====

type Rect = { left: number; top: number; width: number; height: number };

// ✅ NEW: game id for this canvas (plugin identity)
const GAME_ID = "reaction-tap";

type RunResult = {
  gameId: string; // ✅ NEW
  matchId: string | null; // ✅ new (MVP)
  playerId: string; // ✅ tab id
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

  // ===== INSERT START: playerId (per-tab) =====
  const [playerId, setPlayerId] = useState("player");

  useEffect(() => {
    // sessionStorage = уникально для вкладки
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
      // fallback (no storage access)
      setPlayerId(`p_${Date.now()}`);
    }
  }, []);
  // ===== INSERT END: playerId (per-tab) =====

  const containerRef = useRef<HTMLDivElement | null>(null);

  const [phase, setPhase] = useState<"idle" | "ready" | "go" | "ended">("idle");

  const [timeLeftMs, setTimeLeftMs] = useState(durationMs);

  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [reactionSumMs, setReactionSumMs] = useState(0);
  const [reactionCount, setReactionCount] = useState(0);
  const lastSpawnAtRef = useRef<number | null>(null);

  // ===== REPLACE START: match + runs state =====
  const [roundSeed, setRoundSeed] = useState<number | null>(null);

  const [matchInfo, setMatchInfo] = useState<any>(null);
  const [matchPollError, setMatchPollError] = useState<string | null>(null);

  type RunItem = {
    id: string;
    createdAt: number;
    serverScore: number;
    matchId: string;
    playerId?: string | null; // ✅ new (may be missing from API)
    gameId?: string | null; // ✅ new (may be missing from API)
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
  // ===== REPLACE END: match + runs state =====

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
  // run duration is fixed per run start (important for match mode)
  const runDurationRef = useRef(durationMs);

  // prevent auto-start loop in match mode
  const autoStartedForMatchRef = useRef<string | null>(null);

  const avgReactionMs = reactionCount > 0 ? reactionSumMs / reactionCount : null;

  const score = useMemo(() => {
    const base = hits * 10 - misses * 5;
    const bonus = avgReactionMs !== null && avgReactionMs < 250 ? 200 : 0;
    return base + bonus;
  }, [hits, misses, avgReactionMs]);

  function computeNextTargetRect(seed: number, nextId: number): Rect | null {
    const el = containerRef.current;
    if (!el) return null;

    const W = el.clientWidth;
    const H = el.clientHeight;

    // target shrinks a bit as id grows (difficulty)
    const base = 92; // px
    const size = clamp(base - nextId * 1.2, 44, base);

    // deterministic "pseudo-random" based on id (NO Math.random)
    // These produce values in [0..1)
    const k = seed * 0.000001;

    const a = (Math.sin((nextId + 1 + k) * 12.9898) * 43758.5453) % 1;
    const b = (Math.sin((nextId + 1 + k) * 78.233) * 12345.6789) % 1;

    const x01 = a < 0 ? a + 1 : a;
    const y01 = b < 0 ? b + 1 : b;

    const left = Math.round(x01 * (W - size));
    const top = Math.round(y01 * (H - size));

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
  }

  function start() {
    reset();
    setServerVerify(null);
    resultEmittedRef.current = false;

    // ✅ Match-mode: no "ready" delay, and use remaining match time
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
        // match already ended by timer
        resultEmittedRef.current = true;
        setServerVerify({ verified: false, reason: "match_ended" });
        setPhase("ended");
        return;
      }
    }

    // ✅ seed: for match use startedAt to be deterministic; otherwise Date.now()
    const seed =
      isMatchMode && Number.isFinite(Number(matchInfo?.startedAt))
        ? Number(matchInfo.startedAt)
        : Date.now();

    setRoundSeed(seed);

    // ✅ match: GO immediately; solo: keep "ready" delay
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

    // ===== SOLO MODE (old behavior) =====
    setPhase("ready");

    const now = Date.now();
    const d01 = ((Math.sin(now * 0.001) * 10000) % 1 + 1) % 1; // 0..1
    const delayMs = 3000 + Math.floor(d01 * 4000); // 3000..7000

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
          // normalize common errors
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

        // keep polling even when ended (winner can update later)
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

        // stop polling if match ended AND winner score already known
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
    if (resultEmittedRef.current) return;
    if (roundSeed === null) return;

    const result: RunResult = {
      gameId: GAME_ID, // ✅ NEW
      matchId, // ✅ existing
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
    if (process.env.NODE_ENV !== "production") {
      console.log("[RUN RESULT]", result);
    }

    // send to server (through Next proxy to avoid CORS)
    fetch("/api/run/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => null);

        // ✅ map HTTP status to stable reasons
        if (!r.ok) {
          const reason =
            (j && typeof j.reason === "string" && j.reason) ||
            (r.status === 409 ? "match_ended" : r.status === 404 ? "match_not_found" : "api_error");

          setServerVerify({ verified: false, reason });
          console.log("[SERVER VERIFY]", { ok: false, status: r.status, body: j });

          // stop here
          return null;
        }

        setServerVerify(j);
        console.log("[SERVER VERIFY]", j);

        return j;
      })
      .then(async (data) => {
        if (!data) return;

        // ✅ match can auto-end on server timer; show a clear message and stop
        if (data?.verified === false && data?.reason === "match_ended") {
          return;
        }

        if (data?.verified === true && typeof data.serverScore === "number") {
          addVerifiedRun({
            gameId: GAME_ID, // ✅ NEW (local leaderboard can ignore for now)
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

          // END MATCH on server (only for verified run + when matchId exists)
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

            const j2 = await r2.json();
            console.log("[MATCH END]", j2);
          } catch (e) {
            console.warn("[MATCH END ERROR]", e);
          }
        }
      })
      .catch((err) => {
        setServerVerify({ verified: false, reason: "network_error" });
        console.error("[SERVER VERIFY ERROR]", err);
      });
  }, [phase, roundSeed, hits, misses, reactionSumMs, reactionCount, score, durationMs, matchId, playerId]);

  function onHit(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation(); // важно: чтобы не считалось как miss
    if (phase === "ready") {
      setPhase("ended"); // false start on target (редко, но на всякий)
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
    if (roundSeed !== null) {
      setTargetRect(computeNextTargetRect(roundSeed, nextId));
    }
    lastSpawnAtRef.current = performance.now();
  }

  function onMiss() {
    if (phase === "ready") {
      // false start
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

  // ===== INSERT START: winner helpers (by winnerRunId) =====
  const winnerRunId =
    matchId && matchInfo?.status === "ended" && typeof matchInfo?.winnerRunId === "string"
      ? String(matchInfo.winnerRunId)
      : null;

  const winnerPlayerId =
    matchId && matchInfo?.status === "ended" && typeof matchInfo?.winnerPlayerId === "string"
      ? String(matchInfo.winnerPlayerId)
      : null;

  function isWinnerRun(it: { id: string }) {
    return winnerRunId !== null && it.id === winnerRunId;
  }
  // ===== INSERT END: winner helpers (by winnerRunId) =====

  const myShortId = useMemo(() => {
    const s = String(playerId || "");
    return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
  }, [playerId]);

  const isEnded = !!matchId && String(matchInfo?.status || "") === "ended";
  const isMatchMissing = !!matchId && (matchPollError === "not_found" || matchPollError === "match_not_found");

  const effectiveCanPlay = !!canPlay && !isEnded && !isMatchMissing;

  // ✅ Match mode: auto-start run as soon as match becomes started.
  useEffect(() => {
    if (!matchId) return;

    const st = String(matchInfo?.status || "");

    if (st === "ended") {
      // if match ended externally — don't try to verify
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
  }, [matchId, matchInfo?.status, phase, effectiveCanPlay]);

  const matchTimeLeftMs = useMemo(() => {
    if (!matchId) return null;
    if (String(matchInfo?.status || "") !== "started") return null;

    const startedAt = Number(matchInfo?.startedAt);
    if (!Number.isFinite(startedAt)) return null;

    const duration = Number.isFinite(matchInfo?.durationMs) ? Number(matchInfo.durationMs) : 30_000;

    const left = startedAt + duration - Date.now();
    return Math.max(0, left);
  }, [matchId, matchInfo?.status, matchInfo?.startedAt, matchInfo?.durationMs]);

  const matchTimeLeftLabel = matchTimeLeftMs === null ? null : `${Math.ceil(matchTimeLeftMs / 1000)}s left`;

  async function createNewMatchAndGo() {
    try {
      const r = await fetch("/api/match/create", { method: "POST" });
      const data = await r.json();
      const id = String(data?.match?.id || "").trim();
      if (!id) {
        alert("Create match failed: missing match.id");
        return;
      }
      window.location.href = `/play?matchId=${encodeURIComponent(id)}`;
    } catch (e) {
      console.error(e);
      alert("Create match failed (network). Check API is running.");
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-white/70">
          {matchId && (
            <div className="mb-4 rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Match</div>
              <div className="mt-1 font-mono text-sm">{matchId}</div>

              <div className="mt-1 text-sm text-white/70">
                status:{" "}
                <span className="font-mono text-white">
                  {matchInfo?.status || (matchPollError ? matchPollError : "loading")}
                </span>

                {matchTimeLeftLabel && (
                  <>
                    {" "}
                    · <span className="font-mono text-emerald-200">{matchTimeLeftLabel}</span>
                  </>
                )}

                {matchInfo?.status === "ended" && typeof matchInfo?.serverScore === "number" && (
                  <>
                    {" "}
                    · winner score: <span className="font-semibold text-white">{matchInfo.serverScore}</span>
                  </>
                )}
              </div>

              {isMatchMissing && (
                <div className="mt-3">
                  <a
                    href="/lobby"
                    className="inline-flex rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/90"
                  >
                    Go to Lobby
                  </a>
                </div>
              )}

              {/* ===== RUNS LIST ===== */}
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="text-xs text-white/60">Runs</div>

                {runsLoading && <div className="mt-2 text-xs text-white/60">Loading…</div>}

                {!runsLoading && runsError && <div className="mt-2 text-xs text-red-300">Error: {runsError}</div>}

                {!runsLoading && !runsError && runs && runs.length === 0 && (
                  <div className="mt-2 text-xs text-white/60">No runs yet.</div>
                )}

                {!runsLoading && !runsError && runs && runs.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {(() => {
                      const asc = [...runs].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
                      const rankById = new Map<string, number>();
                      asc.forEach((it, i) => rankById.set(it.id, i + 1));

                      return runs.slice(0, 10).map((it) => {
                        const rank = rankById.get(it.id) ?? 0;
                        const isWinner = isWinnerRun(it);
                        const isMe = !!it.playerId && it.playerId === playerId;

                        return (
                          <div
                            key={it.id}
                            className={
                              "flex items-center justify-between rounded-xl border px-3 py-2 " +
                              (isWinner ? "border-yellow-400/40 bg-yellow-400/10" : "border-white/10 bg-white/5")
                            }
                          >
                            <div className="text-xs text-white/70">
                              <span className="font-mono text-white/80">#{rank}</span>

                              {isMe && (
                                <>
                                  <span className="mx-2 text-white/30">·</span>
                                  <span className="font-semibold text-emerald-200">you</span>
                                </>
                              )}

                              {isWinner && (
                                <>
                                  <span className="mx-2 text-white/30">·</span>
                                  <span className="font-semibold text-yellow-200">
                                    🏆 winner{winnerPlayerId ? ` (${winnerPlayerId.slice(0, 6)}…)` : ""}
                                  </span>
                                </>
                              )}

                              <span className="mx-2 text-white/30">·</span>
                              score <span className="font-semibold text-white">{it.serverScore}</span>
                              <span className="mx-2 text-white/30">·</span>
                              hits <span className="font-mono text-white/80">{it.hits}</span>
                              <span className="mx-2 text-white/30">·</span>
                              misses <span className="font-mono text-white/80">{it.misses}</span>

                              {/* optional: show gameId if server returns it */}
                              {it.gameId ? (
                                <>
                                  <span className="mx-2 text-white/30">·</span>
                                  <span className="font-mono text-white/50">{it.gameId}</span>
                                </>
                              ) : null}
                            </div>

                            <div className="text-[11px] font-mono text-white/40">
                              {new Date(it.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
              {/* ===== END RUNS LIST ===== */}
            </div>
          )}

          Time <span className="ml-2 font-mono text-white/50">you:{myShortId}</span>
          {matchId ? <span className="ml-2 font-mono text-white/50">match:{matchId.slice(0, 8)}…</span> : null}
        </div>

        {/* ===== REPLACE START: right header (stable width) ===== */}
        <div className="flex items-center gap-3">
          {matchId ? (
            <div className="text-xs text-white/60">
              runs:{" "}
              <span className="inline-block w-[88px] text-right font-mono text-white/70">
                {runsLoading ? "loading…" : runsError ? runsError : runs ? String(runs.length) : "-"}
              </span>
            </div>
          ) : null}

          <div className="font-mono text-lg">{timeStr}</div>
        </div>
        {/* ===== REPLACE END: right header (stable width) ===== */}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-3 text-center">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Hits</div>
          <div className="text-lg font-semibold">{hits}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Misses</div>
          <div className="text-lg font-semibold">{misses}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Avg ms</div>
          <div className="text-lg font-semibold">{avgReactionMs === null ? "-" : Math.round(avgReactionMs)}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Score</div>
          <div className="text-lg font-semibold">{score}</div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative mt-4 h-[62vh] w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-black"
        onPointerDown={onMiss}
      >
        {targetRect && (
          <button
            type="button"
            aria-label="Tap target"
            onPointerDown={onHit}
            className="absolute rounded-full border border-white/20 bg-white/15 backdrop-blur active:scale-95"
            style={{
              left: targetRect.left,
              top: targetRect.top,
              width: targetRect.width,
              height: targetRect.height,
              touchAction: "none",
            }}
          />
        )}

        {phase === "idle" && (
          <div className="absolute inset-0 grid place-items-center">
            <button
              type="button"
              onClick={start}
              disabled={!effectiveCanPlay}
              className={
                "rounded-2xl px-6 py-3 font-medium " +
                (effectiveCanPlay ? "bg-white text-black" : "cursor-not-allowed bg-white/20 text-white/50")
              }
            >
              {effectiveCanPlay
                ? "Start 30s Run"
                : isMatchMissing
                ? "Match not found — go to Lobby"
                : isEnded
                ? "Match ended — create a new match"
                : "Waiting for match start…"}
            </button>
          </div>
        )}

        {phase === "ready" && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="rounded-3xl border border-white/10 bg-black/60 p-6 text-center backdrop-blur">
              <div className="text-sm text-white/70">Get ready…</div>
              <div className="mt-1 text-2xl font-semibold">Wait for GO</div>
              <div className="mt-3 text-xs text-white/60">Don’t tap early.</div>
            </div>
          </div>
        )}

        {phase === "go" && (
          <div className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 rounded-full border border-white/10 bg-white/10 px-4 py-1 text-sm font-semibold text-white/90 backdrop-blur">
            GO!
          </div>
        )}

        {phase === "ended" && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="rounded-3xl border border-white/10 bg-black/60 p-6 text-center backdrop-blur">
              <div className="text-sm text-white/70">Run finished</div>
              <div className="mt-1 text-2xl font-semibold">Score: {score}</div>

              {serverVerify && (
                <div className="mt-2 text-sm text-white/70">
                  {serverVerify.verified ? (
                    <>
                      Verified ✅ · Server score:{" "}
                      <span className="font-semibold text-white">{serverVerify.serverScore}</span>
                    </>
                  ) : serverVerify.reason === "match_ended" ? (
                    <>
                      Too late ❌ · <span className="font-semibold text-red-200">Match already ended</span>
                    </>
                  ) : (
                    <>
                      Not verified ❌ · Reason:{" "}
                      <span className="font-mono text-white">{serverVerify.reason || "unknown"}</span>
                    </>
                  )}
                </div>
              )}

              <div className="mt-3 text-sm text-white/60">
                Hits: {hits} · Misses: {misses}
              </div>

              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={start}
                  disabled={isEnded}
                  className={
                    "rounded-2xl px-5 py-2 font-medium " +
                    (isEnded ? "cursor-not-allowed bg-white/20 text-white/60" : "bg-white text-black")
                  }
                >
                  {isEnded ? "Match ended" : "Play again"}
                </button>

                <a href="/lobby" className="rounded-2xl border border-white/15 px-5 py-2 text-white/90">
                  Back to Lobby
                </a>

                {isEnded && (
                  <button
                    type="button"
                    onClick={createNewMatchAndGo}
                    className="rounded-2xl bg-white px-5 py-2 font-medium text-black"
                  >
                    Create new match
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-white/50">
        MVP: deterministic target movement (no RNG). Next: match binding + server storage.
      </p>
    </div>
  );
}
// ===== FILE END: apps/web/components/game/GameCanvas.tsx =====
