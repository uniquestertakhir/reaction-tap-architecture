// ===== FILE START: apps/web/app/(public)/play/page.tsx =====
"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GameCanvas from "@/components/game/GameCanvas";
import { apiStartMatch } from "@/lib/matchApi";

type MatchStatus = "none" | "created" | "started" | "ended" | "error";
const DEFAULT_GAME_ID = "reaction-tap";

// same key as GameCanvas
const TAB_PLAYER_KEY = "rt_tab_player_id_v1";

const DEV_UI = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEV_UI === "1";

function ensureTabPlayerId(): string {
  try {
    const existing = window.sessionStorage.getItem(TAB_PLAYER_KEY);
    if (existing && existing.trim()) return existing.trim();

    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `p_${crypto.randomUUID()}`
        : `p_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;

    window.sessionStorage.setItem(TAB_PLAYER_KEY, fresh);
    return fresh;
  } catch {
    return `p_${Date.now()}`;
  }
}

function numOrNull(v: string | null) {
  if (!v) return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

async function createMatch(gameId: string) {
  const r = await fetch("/api/match/create", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ gameId }),
  });
  const j = await r.json().catch(() => null);
  const id = String(j?.match?.id || j?.id || "").trim();
  if (!r.ok || !id) {
    return { ok: false as const, status: r.status, error: j?.error || "create_match_failed", raw: j };
  }
  return { ok: true as const, id, raw: j };
}

async function stakeMatch(matchId: string, playerId: string, amount: number, gameId: string) {
  const r = await fetch(`/api/match/${encodeURIComponent(matchId)}/stake`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ playerId, amount, currency: "USD", gameId }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || j?.ok === false) {
    return { ok: false as const, status: r.status, error: j?.error || j?.reason || "stake_failed", raw: j };
  }
  return { ok: true as const, match: j?.match, wallet: j?.wallet, raw: j };
}

function PlayInner() {
  const router = useRouter();
  const sp = useSearchParams();

  // ===== query =====
  const matchId = (sp.get("matchId") || "").trim();

  const gameId = (sp.get("gameId") || DEFAULT_GAME_ID).trim() || DEFAULT_GAME_ID;
  const mode = (sp.get("mode") || "").trim().toLowerCase();

  // For auto-match we pass:
  // /play?gameId=reaction-tap&mode=starter-brawl&currency=usd&entry=0.3&returnTo=/games/reaction-tap
  const currency = (sp.get("currency") || "usd").trim().toLowerCase();
  const entry = numOrNull(sp.get("entry"));
  const returnToRaw = (sp.get("returnTo") || "").trim();
  const returnTo = returnToRaw.startsWith("/") && !returnToRaw.startsWith("//") ? returnToRaw : "/games";

  const isSolo = mode === "solo";

  const isAutoMatch = !matchId && !isSolo && currency === "usd" && typeof entry === "number" && entry > 0;

  // ✅ playerId of this tab (same as GameCanvas)
  const [playerId, setPlayerId] = useState<string>("");
  useEffect(() => {
    const pid = ensureTabPlayerId();
    setPlayerId(pid);
  }, []);

  // ===== state =====
  const [isHost, setIsHost] = useState(false);

  const [matchStatus, setMatchStatus] = useState<MatchStatus>(matchId ? "created" : "none");
  const [startError, setStartError] = useState<string | null>(null);

  // ✅ wallet + match info
  const [wallet, setWallet] = useState<any>(null);
  const [walletErr, setWalletErr] = useState<string | null>(null);

  const [matchInfo, setMatchInfo] = useState<any>(null);
  const [matchErr, setMatchErr] = useState<string | null>(null);

  const [busy, setBusy] = useState<string | null>(null);

  // ✅ cashout (withdraw) UI (DEV)
  const [withdrawAmount, setWithdrawAmount] = useState<string>("1");
  const [cashoutBusy, setCashoutBusy] = useState(false);
  const [lastCashout, setLastCashout] = useState<any>(null);
  const [cashoutErr, setCashoutErr] = useState<string | null>(null);

  // ✅ stake UI (DEV)
  const [stakeAmount, setStakeAmount] = useState<string>("10");

  // ✅ cashout list for this player
  const [cashouts, setCashouts] = useState<any[]>([]);
  const [cashoutsErr, setCashoutsErr] = useState<string | null>(null);

  // ===== IMPORTANT: If no matchId and not autoMatch => go back =====
useEffect(() => {
  if (matchId) return;
  if (isAutoMatch) return;

  // ✅ Solo/Practice можно открывать без matchId — НЕ уводим в /games
  if (isSolo) return;

  // if user opened /play напрямую — уводим в games (не lobby)
  router.replace("/games");
}, [matchId, isAutoMatch, isSolo, router]);

  // ===== AUTO MATCH BOOTSTRAP =====
  const bootRef = useRef(false);

  useEffect(() => {
    if (!isAutoMatch) return;
    if (!playerId) return;
    if (bootRef.current) return;

    bootRef.current = true;

    (async () => {
      setStartError(null);

      // 1) create match
      const created = await createMatch(gameId);
      if (!created.ok) {
        console.error("[AUTO MATCH] create failed", created);
        setStartError(`Auto-match failed: create (${created.status}) ${created.error}`);
        return;
      }

      const id = created.id;

      // mark host for this tab (optional)
      try {
        localStorage.setItem("rt_match_host_v1", id);
      } catch {}

      // 2) stake immediately (YOUR stake)
      const st = await stakeMatch(id, playerId, entry!, gameId);
      if (!st.ok) {
        console.error("[AUTO MATCH] stake failed", st);
        setStartError(`Auto-match failed: stake (${st.status}) ${st.error}`);
        // still allow user to see match page for debugging
        router.replace(`/play?matchId=${encodeURIComponent(id)}&mode=${encodeURIComponent(mode)}&gameId=${encodeURIComponent(gameId)}&returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }

      // 3) go to /play?matchId=...
      router.replace(
        `/play?matchId=${encodeURIComponent(id)}&mode=${encodeURIComponent(mode)}&gameId=${encodeURIComponent(
          gameId
        )}&returnTo=${encodeURIComponent(returnTo)}`
      );
    })();
  }, [isAutoMatch, playerId, gameId, mode, entry, router, returnTo]);

  // ===== host flag (for matchId flow) =====
  useEffect(() => {
    if (!matchId) {
      setIsHost(false);
      return;
    }
    try {
      setIsHost(localStorage.getItem("rt_match_host_v1") === matchId);
    } catch {
      setIsHost(false);
    }
  }, [matchId]);

  // ===== SOLO MODE: PRACTICE (NO CASH / NO AUTO-STAKE) =====
// В solo/practice мы НЕ трогаем wallet/escrow и НЕ стартуем матч.
// GameCanvas может работать без matchId (practice).
const soloBootRef = useRef(false);

useEffect(() => {
  if (!isSolo) return;

  // reset guard when switching into solo
  if (!soloBootRef.current) soloBootRef.current = true;

  // intentionally no-op
}, [isSolo]);

  // ===== label =====
  const label = useMemo(() => {
    if (!matchId) return isAutoMatch ? "match: searching…" : "match: none";
    if (matchStatus === "created") return "match: created";
    if (matchStatus === "started") return "match: started";
    if (matchStatus === "ended") return "match: ended";
    if (matchStatus === "error") return "match: network_error";
    return "match: none";
  }, [matchId, matchStatus, isAutoMatch]);

  // ===== poll match status =====
  useEffect(() => {
    if (!matchId) return;

    let cancelled = false;
    let t: any = null;

    async function pullOnce() {
      try {
        const r = await fetch(`/api/match/${encodeURIComponent(matchId)}`, {
          method: "GET",
          headers: { accept: "application/json" },
          cache: "no-store",
        });

        const data = await r.json();

        if (cancelled) return;

        const status = String(data?.match?.status || "").trim();
        if (status === "created" || status === "started" || status === "ended") {
          setMatchStatus(status as MatchStatus);

          if (status === "ended" && t) {
            clearInterval(t);
            t = null;
          }
          return;
        }

        if (data?.error) {
          setMatchStatus("error");
          if (t) {
            clearInterval(t);
            t = null;
          }
          return;
        }
      } catch {
        if (!cancelled) setMatchStatus("error");
        if (t) {
          clearInterval(t);
          t = null;
        }
      }
    }

    pullOnce();
    t = window.setInterval(pullOnce, 800);

    return () => {
      cancelled = true;
      if (t) clearInterval(t);
    };
  }, [matchId]);

  // ===== poll match info =====
  useEffect(() => {
    if (!matchId) return;

    let alive = true;
    let t: any = null;

    const tick = async () => {
      try {
        const r = await fetch(`/api/match/${encodeURIComponent(matchId)}`, { cache: "no-store" });
        const j = await r.json().catch(() => null);

        if (!alive) return;

        if (!r.ok || j?.error) {
          setMatchInfo(null);
          setMatchErr(j?.error || "match_fetch_failed");
        } else {
          setMatchInfo(j?.match || null);
          setMatchErr(null);
        }
      } catch {
        if (!alive) return;
        setMatchInfo(null);
        setMatchErr("network_error");
      } finally {
        if (!alive) return;
        t = setTimeout(tick, 1200);
      }
    };

    tick();

    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [matchId]);

  // ===== poll wallet =====
  useEffect(() => {
    if (!playerId) return;

    let alive = true;
    let t: any = null;

    const tick = async () => {
      try {
        const r = await fetch(`/api/wallet/${encodeURIComponent(playerId)}`, {
          method: "GET",
          headers: { accept: "application/json" },
          cache: "no-store",
        });
        const j = await r.json().catch(() => null);

        if (!alive) return;

        if (!r.ok || j?.ok === false) {
          setWallet(null);
          setWalletErr(j?.error || "wallet_fetch_failed");
        } else {
          setWallet(j.wallet);
          setWalletErr(null);
        }
      } catch {
        if (!alive) return;
        setWallet(null);
        setWalletErr("network_error");
      } finally {
        if (!alive) return;
        t = setTimeout(tick, 1500);
      }
    };

    tick();

    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [playerId]);

  // ===== poll cashouts =====
  useEffect(() => {
    if (!playerId) return;

    let alive = true;
    let t: any = null;

    const tick = async () => {
      try {
        const url = `/api/cashout/list?playerId=${encodeURIComponent(playerId)}&limit=50`;

        const r = await fetch(url, {
          method: "GET",
          headers: { accept: "application/json" },
          cache: "no-store",
        });

        const j = await r.json().catch(() => null);

        if (!alive) return;

        if (!r.ok || j?.ok === false) {
          setCashouts([]);
          setCashoutsErr(j?.error || "cashouts_fetch_failed");
        } else {
          setCashouts(Array.isArray(j?.items) ? j.items : []);
          setCashoutsErr(null);
        }
      } catch {
        if (!alive) return;
        setCashouts([]);
        setCashoutsErr("network_error");
      } finally {
        if (!alive) return;
        t = setTimeout(tick, 1800);
      }
    };

    tick();

    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [playerId]);

  // ===== computed =====
  const escrowLabel = useMemo(() => {
    if (!matchInfo) return "—";
    const cur = String(matchInfo.currency || "USD");
    const total = Number(matchInfo.escrowTotal || 0);
    return `${total} ${cur}`;
  }, [matchInfo]);

  const myBalanceLabel = useMemo(() => {
    if (!wallet) return "—";
    const b = wallet?.balances || {};
    const usd = typeof b["USD"] === "number" ? b["USD"] : null;
    return usd === null ? "—" : `${usd} USD`;
  }, [wallet]);

  const myUsdBalance = useMemo(() => {
    const b = wallet?.balances || {};
    const usd = typeof b["USD"] === "number" ? b["USD"] : 0;
    return Number.isFinite(usd) ? usd : 0;
  }, [wallet]);

  const hasPendingCashout = useMemo(() => {
    return cashouts.some((c: any) => String(c?.status || "").toLowerCase() === "pending");
  }, [cashouts]);

  const stakesCount = useMemo(() => Object.keys(matchInfo?.stakes || {}).length, [matchInfo]);

  const stakesList = useMemo(() => {
    const stakes = (matchInfo?.stakes || {}) as Record<string, number>;
    return Object.entries(stakes)
      .map(([pid, amt]) => ({ playerId: String(pid), amount: Number(amt || 0) }))
      .filter((x) => x.playerId && Number.isFinite(x.amount) && x.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [matchInfo]);

  function shortPid(pid: string) {
    if (!pid) return "—";
    if (pid.length <= 14) return pid;
    return `${pid.slice(0, 6)}…${pid.slice(-4)}`;
  }

  const resultLabel = useMemo(() => {
    if (!matchId || !matchInfo) return null;

    const status = String(matchInfo.status || "");
    const pot = Number(matchInfo.escrowTotal || 0);

    if (status !== "ended") return null;

    const winnerId = String(matchInfo.winnerPlayerId || "");
    if (!winnerId) return "Result: ended (no winner)";

    if (winnerId === playerId) return `Result: YOU WON +${pot} USD`;
    return `Result: you lost (winner got ${pot} USD)`;
  }, [matchId, matchInfo, playerId]);

  const canStartMatch = !!matchId && matchStatus === "created" && (isSolo || stakesCount >= 2);

  // ===== AUTO START WHEN READY (AUTO-MATCH REAL FLOW) =====
  const autoStartRef = useRef(false);
  useEffect(() => {
    if (!matchId) return;
    if (isSolo) return;
    if (matchStatus !== "created") return;
    if (stakesCount < 2) return;
    if (autoStartRef.current) return;

    autoStartRef.current = true;

    (async () => {
      const res = await apiStartMatch(matchId);
      if (!res.ok) {
        console.error("[AUTO START] failed", res);
        setStartError(`Auto start failed: ${res.status || "?"} ${res.error || "unknown"}`);
        autoStartRef.current = false; // allow retry
        return;
      }
      setStartError(null);
    })();
  }, [matchId, matchStatus, stakesCount, isSolo]);

  // ===== DEV handlers (existing) =====
  async function onFund50() {
    if (!playerId) return;

    setBusy("fund");
    try {
      const r = await fetch("/api/wallet/fund", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, amount: 50, currency: "USD" }),
      });

      const j = await r.json().catch(() => null);
      if (!r.ok || j?.ok === false) {
        alert(`Fund failed: ${j?.error || j?.reason || r.status}`);
        return;
      }

      setWallet((prev: any) => j?.wallet ?? prev);
    } finally {
      setBusy(null);
    }
  }

  async function onWithdrawDev() {
    if (!playerId) return;

    const amt = Number(withdrawAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert("Bad amount");
      return;
    }

    setCashoutBusy(true);
    setCashoutErr(null);

    try {
      const r = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, amount: amt, currency: "USD" }),
      });

      const j = await r.json().catch(() => null);

      if (!r.ok || j?.ok === false) {
        const e = j?.error || j?.reason || String(r.status);
        setCashoutErr(e);
        alert(`Withdraw failed: ${e}`);
        return;
      }

      setLastCashout(j?.request ?? null);
    } finally {
      setCashoutBusy(false);
    }
  }

  async function onStake() {
    if (!playerId) return;
    if (!matchId) {
      alert("No matchId.");
      return;
    }

    const amt = Number(stakeAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert("Bad stake amount");
      return;
    }

    setBusy("stake");
    try {
      const r = await fetch(`/api/match/${encodeURIComponent(matchId)}/stake`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, amount: amt, currency: "USD", gameId }),
      });

      const j = await r.json().catch(() => null);
      if (!r.ok || j?.ok === false) {
        alert(`Stake failed: ${j?.error || j?.reason || r.status}`);
        return;
      }

      setMatchInfo(j?.match ?? matchInfo);
      setWallet(j?.wallet ?? wallet);

      alert("Stake placed ✅");
    } finally {
      setBusy(null);
    }
  }

  async function onStartMatch() {
    if (!matchId) return;

    setStartError(null);

    try {
      const res = await apiStartMatch(matchId);

      if (!res.ok) {
        if (res.status === 409 && res.error === "escrow_not_ready") {
          const count = Object.keys(matchInfo?.stakes || {}).length;
          setStartError(`Escrow not ready: need stakes first (current stakes: ${count}).`);
          return;
        }
        setStartError(`Failed to start match (${res.status || "?"}): ${res.error || "unknown"}`);
        setMatchStatus("error");
        return;
      }

      const status = String(res.data?.match?.status || "").trim();
      if (status === "created" || status === "started" || status === "ended") {
        setMatchStatus(status as MatchStatus);
        return;
      }

      setStartError("Bad server response");
      setMatchStatus("error");
    } catch (e) {
      console.error("[START MATCH] network", e);
      setStartError("Network error");
      setMatchStatus("error");
    }
  }

  async function onCreateNewMatch() {
    const created = await createMatch(gameId);
    if (!created.ok) {
      alert(`Create match failed: ${created.status} ${created.error}`);
      return;
    }

    try {
      localStorage.setItem("rt_match_host_v1", created.id);
    } catch {}

    const started = await apiStartMatch(created.id);
    if (!started.ok) {
      alert(`Start new match failed (${started.status || "?"}): ${started.error || "unknown"}`);
      return;
    }

    router.replace(`/play?matchId=${encodeURIComponent(created.id)}&gameId=${encodeURIComponent(gameId)}`);
  }

      return (
    <main className="min-h-screen text-white">
      {/* ===== Blitz-like purple backdrop ===== */}
      <div className="relative min-h-screen overflow-hidden bg-[#07040d]">
        {/* glow blobs */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-fuchsia-600/25 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-52 left-1/4 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-violet-600/25 blur-[120px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(168,85,247,0.25),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_500px_at_20%_120%,rgba(236,72,153,0.16),transparent_55%)]" />

        {/* ===== Center phone frame ===== */}
        <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pt-4 pb-24">
          {/* ===== HUD ===== */}
          <div className="rounded-[26px] border border-white/10 bg-white/[0.06] p-3 shadow-[0_20px_70px_rgba(0,0,0,0.6)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              {/* Left: avatar + level */}
              <div className="flex items-center gap-3">
                <div className="relative h-11 w-11 overflow-hidden rounded-2xl border border-white/10 bg-white/10">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_60%)]" />
                </div>

                <div>
                  <div className="text-[10px] font-medium text-white/60">LEVEL</div>
                  <div className="text-sm font-semibold">1</div>
                </div>
              </div>

              {/* Middle: gems + cash */}
              <div className="flex items-center gap-2">
                <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rotate-45 rounded-[3px] bg-fuchsia-300/90 shadow-[0_0_16px_rgba(236,72,153,0.55)]" />
                    <div>
                      <div className="text-[10px] font-medium text-white/60">GEMS</div>
                      <div className="text-sm font-semibold">0</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-200">
                      $
                    </span>
                    <div>
                      <div className="text-[10px] font-medium text-white/60">CASH</div>
                      <div className="text-sm font-semibold">
                        {walletErr ? "—" : `${Number(myUsdBalance || 0).toFixed(2)} USD`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: add button */}
              <button
                type="button"
                className="h-11 w-11 rounded-2xl bg-white text-black shadow-[0_14px_35px_rgba(255,255,255,0.18)] active:scale-[0.99]"
                onClick={() => {}}
                aria-label="Add"
                title="Add"
              >
                <span className="text-xl font-bold leading-none">+</span>
              </button>
            </div>
          </div>

          {/* ===== Game card ===== */}
          <div className="mt-4 rounded-[28px] border border-white/10 bg-white/[0.06] p-3 shadow-[0_18px_60px_rgba(0,0,0,0.6)] backdrop-blur">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="text-xs font-semibold text-white/80">Reaction Tap</div>
              <div className="text-[11px] text-white/50">
                {mode ? mode : "practice"}
              </div>
            </div>

            {/* Fixed phone-like aspect ratio area */}
            <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-black/40">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_500px_at_50%_0%,rgba(168,85,247,0.18),transparent_60%)]" />

              {/* Keep canvas looking like a phone screen */}
              <div className="relative w-full aspect-[9/16]">
                {/* MATCHMAKING OVERLAY */}
{!isSolo && (matchStatus === "created" || !matchId) && stakesCount < 2 ? (
  <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur">
    <div className="relative w-[88%] rounded-[28px] border border-white/10 bg-gradient-to-b from-violet-500/15 to-fuchsia-500/10 p-5 text-center shadow-[0_30px_110px_rgba(0,0,0,0.75)]">
  {/* soft glow */}
  <div className="pointer-events-none absolute -inset-8 rounded-[36px] bg-gradient-to-b from-fuchsia-500/10 to-violet-500/10 blur-2xl" />
  <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-white/10" />

  {/* icon */}
  <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[22px] border border-white/10 bg-black/25">
    <div className="relative h-8 w-8">
      <div className="absolute inset-0 rounded-full border-2 border-white/15" />
      <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-fuchsia-300/90 border-r-violet-300/70" />
      <div className="absolute inset-2 rounded-full bg-white/5" />
    </div>
  </div>

  <div className="relative text-[18px] font-semibold tracking-tight text-white">
    Finding opponent…
  </div>
  <div className="relative mt-2 text-sm text-white/70">
    Matchmaking in progress
  </div>

  {/* progress card */}
  <div className="relative mt-5 rounded-2xl border border-white/10 bg-black/20 p-3">
    <div className="flex items-center justify-between text-[11px] text-white/60">
      <span>Stakes</span>
      <span className="font-mono text-white/80">{stakesCount} / 2</span>
    </div>

    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-fuchsia-300/90 to-violet-300/80 transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(8, (stakesCount / 2) * 100))}%` }}
      />
    </div>

    <div className="mt-2 text-[11px] text-white/50">
      {stakesCount < 2 ? "Waiting for another player…" : "Starting…"}
    </div>
  </div>

  {/* cancel button (blitz style) */}
  <button
    type="button"
    onClick={() => {
      const rt = (sp.get("returnTo") || "/games").trim() || "/games";
      window.location.href = rt;
    }}
    className="relative mt-6 w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_60px_rgba(0,0,0,0.45)] hover:bg-white/15 active:scale-[0.99]"
  >
    Cancel
  </button>

  {startError ? (
    <div className="relative mt-4 text-sm text-red-200">{startError}</div>
  ) : null}
</div>
  </div>
) : null}

                <div className="absolute inset-0">
                  <GameCanvas
                    canPlay={Boolean(
                      isSolo ||
                        (matchId && (matchStatus === "started" || (matchStatus === "created" && stakesCount >= 2)))
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Bottom Nav ===== */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/55 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
            <button className="text-[11px] font-medium text-white/70 hover:text-white">Shop</button>
            <button className="text-[11px] font-medium text-white/70 hover:text-white">Results</button>

            <button className="rounded-[18px] bg-white px-6 py-3 text-[11px] font-semibold text-black shadow-[0_16px_45px_rgba(255,255,255,0.14)]">
              Games
            </button>

            <button className="text-[11px] font-medium text-white/70 hover:text-white">Rewards</button>
            <button className="text-[11px] font-medium text-white/70 hover:text-white">Leagues</button>
          </div>
        </nav>
      </div>
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white p-6">Loading…</div>}>
      <PlayInner />
    </Suspense>
  );
}
// ===== FILE END: apps/web/app/(public)/play/page.tsx =====