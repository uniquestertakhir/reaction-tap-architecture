// ===== FILE START: apps/web/app/(public)/play/page.tsx =====
"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GameCanvas from "@/components/game/GameCanvas";
import { apiStartMatch } from "@/lib/matchApi";

type MatchStatus = "none" | "created" | "started" | "ended" | "error";
const GAME_ID = "reaction-tap";

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


function PlayInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const matchId = (sp.get("matchId") || "").trim();

  const [isHost, setIsHost] = useState(false);
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

  const [matchStatus, setMatchStatus] = useState<MatchStatus>(matchId ? "created" : "none");
  const [startError, setStartError] = useState<string | null>(null);

  // ✅ playerId of this tab (same as GameCanvas)
  const [playerId, setPlayerId] = useState<string>("");

    useEffect(() => {
    const pid = ensureTabPlayerId();
    setPlayerId(pid);
  }, []);


  // ✅ wallet + match money info
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
    // ✅ stake UI
  const [stakeAmount, setStakeAmount] = useState<string>("10");



  // ✅ cashout list for this player
  const [cashouts, setCashouts] = useState<any[]>([]);
  const [cashoutsErr, setCashoutsErr] = useState<string | null>(null);




  const label = useMemo(() => {
    if (!matchId) return "match: none";
    if (matchStatus === "created") return "match: created";
    if (matchStatus === "started") return "match: started";
    if (matchStatus === "ended") return "match: ended";
    if (matchStatus === "error") return "match: network_error";
    return "match: none";
  }, [matchId, matchStatus]);

  // ✅ poll match status (existing)
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

  // ✅ poll match info for escrow display
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

  // ✅ poll wallet for current tab playerId
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

    // ✅ poll cashouts list for this playerId
  useEffect(() => {
    if (!playerId) return;

    let alive = true;
    let t: any = null;

    const tick = async () => {
      try {
        const url =
          `/api/cashout/list?playerId=${encodeURIComponent(playerId)}&limit=50`;

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


    // ✅ DEV: fund + stake прямо на /play
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

      // обновим сразу (и дальше поллинг добьёт)
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
      alert("No matchId. Open /play?matchId=... from lobby invite.");
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
        body: JSON.stringify({ playerId, amount: amt, currency: "USD", gameId: GAME_ID }),
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
      // ✅ show concrete reason
      if (res.status === 409 && res.error === "escrow_not_ready") {
        const stakesCount = Object.keys(matchInfo?.stakes || {}).length;
        setStartError(
          `Escrow not ready: need stakes first (current stakes: ${stakesCount}). Open 2 tabs, Stake in both tabs, then Start.`
        );
        return;
      }

      if (res.status === 409 && res.error === "match_ended") {
        setStartError("Match already ended");
        setMatchStatus("ended");
        return;
      }

      if (res.status === 404 && res.error === "not_found") {
        setStartError("Match not found");
        setMatchStatus("error");
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
    try {
      const r = await fetch("/api/match/create", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ gameId: GAME_ID }),
      });

      const data = await r.json().catch(() => null);
      const id = String(data?.match?.id || "").trim();

      if (!r.ok || !id) {
        console.log("[CREATE MATCH] bad response:", { status: r.status, data });
        alert("Create match failed. Check API is running.");
        return;
      }

      try {
        localStorage.setItem("rt_match_host_v1", id);
      } catch {}

      const started = await apiStartMatch(id);
      if (!started.ok) {
        alert(`Start new match failed (${started.status || "?"}): ${started.error || "unknown"}`);
        return;
      }

      router.replace(`/play?matchId=${encodeURIComponent(id)}`);
    } catch (e) {
      console.error("[CREATE MATCH] network", e);
      alert("Create match failed (network). Check API is running.");
    }
  }

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

    // ===== INSERT START: cashout computed =====
  const myUsdBalance = useMemo(() => {
    const b = wallet?.balances || {};
    const usd = typeof b["USD"] === "number" ? b["USD"] : 0;
    return Number.isFinite(usd) ? usd : 0;
  }, [wallet]);

  const hasPendingCashout = useMemo(() => {
    return cashouts.some((c: any) => String(c?.status || "").toLowerCase() === "pending");
  }, [cashouts]);
  // ===== INSERT END: cashout computed =====


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

    const stakesCount = useMemo(() => {
    return Object.keys(matchInfo?.stakes || {}).length;
  }, [matchInfo]);

  const canStartMatch =
    !!matchId &&
    matchStatus === "created" &&
    stakesCount >= 2;

      // ===== INSERT START: stakes list view-model =====
  const stakesList = useMemo(() => {
    const stakes = (matchInfo?.stakes || {}) as Record<string, number>;
    const entries = Object.entries(stakes)
      .map(([pid, amt]) => ({ playerId: String(pid), amount: Number(amt || 0) }))
      .filter((x) => x.playerId && Number.isFinite(x.amount) && x.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    return entries;
  }, [matchInfo]);

  function shortPid(pid: string) {
    if (!pid) return "—";
    if (pid.length <= 14) return pid;
    return `${pid.slice(0, 6)}…${pid.slice(-4)}`;
  }
  // ===== INSERT END: stakes list view-model =====




  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Play</h1>
          <Link href="/lobby" className="text-sm text-white/70 hover:text-white">
            Back
          </Link>
        </div>

                {/* ✅ Wallet + Escrow HUD */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs text-white/60">This tab player</div>
              <div className="mt-1 font-mono text-sm text-white/90">{playerId ? playerId : "—"}</div>

                             {/* ===== REPLACE START: stakes summary + list ===== */}
              <div className="mt-2 text-xs text-white/60">
                {matchId ? `stakes: ${Object.keys(matchInfo?.stakes || {}).length}` : ""}
                {matchErr ? ` · ${matchErr}` : ""}
                {resultLabel ? ` · ${resultLabel}` : ""}
              </div>

              {matchId && stakesList.length > 0 ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-white/70">Stakes</div>
                    <div className="text-[11px] text-white/40">{stakesList.length} players</div>
                  </div>

                  <div className="mt-2 space-y-2">
                    {stakesList.slice(0, 10).map((s) => (
                      <div
                        key={s.playerId}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                      >
                        <div className="font-mono text-[11px] text-white/80">
                          {shortPid(s.playerId)}
                          {s.playerId === playerId ? (
                            <span className="ml-2 text-emerald-200">(you)</span>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-white/70">
                          {s.amount} USD
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {/* ===== REPLACE END: stakes summary + list ===== */}



                            {/* ===== REPLACE START: DEV_UI block ===== */}
              {DEV_UI ? (
                <>
                  {/* Fund + Stake (DEV) */}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={onFund50}
                      disabled={busy !== null}
                      className={
                        "rounded-xl px-3 py-2 text-xs font-medium " +
                        (busy !== null
                          ? "cursor-not-allowed bg-white/20 text-white/60"
                          : "bg-white text-black")
                      }
                    >
                      Fund +50 (DEV)
                    </button>

                    <input
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      inputMode="decimal"
                      className="w-24 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/90 outline-none"
                      placeholder="Stake"
                    />

                    <button
                      type="button"
                      onClick={onStake}
                      disabled={busy !== null || !matchId}
                      className={
                        "rounded-xl px-3 py-2 text-xs font-medium " +
                        (busy !== null || !matchId
                          ? "cursor-not-allowed bg-white/5 text-white/40"
                          : "border border-white/15 bg-white/10 text-white/90")
                      }
                    >
                      Stake
                    </button>
                  </div>

                  {/* Cash out (public) */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <div className="text-xs text-white/60">
                      Balance:{" "}
                      <span className="font-mono text-white/85">{myBalanceLabel}</span>
                    </div>

                    <input
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      inputMode="decimal"
                      className="w-28 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/90 outline-none"
                      placeholder="Amount"
                    />

                    <button
                      type="button"
                      onClick={onWithdrawDev}
                      disabled={cashoutBusy || !playerId || myUsdBalance <= 0 || hasPendingCashout}
                      className={
                        "rounded-xl px-3 py-2 text-xs font-medium " +
                        (cashoutBusy || !playerId || myUsdBalance <= 0 || hasPendingCashout
                          ? "cursor-not-allowed bg-white/5 text-white/40"
                          : "border border-white/15 bg-white/10 text-white/90")
                      }
                    >
                      {hasPendingCashout ? "Cash out pending…" : "Cash out"}
                    </button>

                    <Link href="/cashout-admin" className="text-xs text-white/60 hover:text-white">
                      Open cashout admin →
                    </Link>
                  </div>

                  {cashoutErr ? (
                    <div className="mt-2 text-xs text-red-200">cashout: {cashoutErr}</div>
                  ) : null}

                  {lastCashout?.id ? (
                    <div className="mt-2 text-[11px] text-white/60">
                      last request: <span className="font-mono">{lastCashout.id}</span> ·{" "}
                      <span className="uppercase">{String(lastCashout.status || "")}</span>
                    </div>
                  ) : null}

                  {/* Cashouts list */}
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-white/70">Cashouts (this player)</div>
                      <div className="text-[11px] text-white/40">{playerId}</div>
                    </div>

                    {cashoutsErr ? (
                      <div className="mt-2 text-xs text-red-200">list: {cashoutsErr}</div>
                    ) : null}

                    {cashouts.length === 0 ? (
                      <div className="mt-2 text-xs text-white/50">No cashouts yet.</div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {cashouts.slice(0, 10).map((c) => (
                          <div
                            key={String(c?.id)}
                            className="rounded-lg border border-white/10 bg-white/5 p-2"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-mono text-[11px] text-white/80 truncate">
                                {String(c?.id || "")}
                              </div>
                              <div className="text-[11px] text-white/70 uppercase">
                                {String(c?.status || "")}
                              </div>
                            </div>

                            <div className="mt-1 flex items-center justify-between text-[11px] text-white/55">
                              <div>
                                {Number(c?.amount || 0)} {String(c?.currency || "USD")}
                              </div>
                              <div className="font-mono">
                                {c?.createdAt ? new Date(Number(c.createdAt)).toLocaleString() : "—"}
                              </div>
                            </div>
                            {/* ===== INSERT START: payoutRef in list ===== */}
{c?.payoutRef ? (
  <div className="mt-1 text-[11px] text-white/50">
    payoutRef: <span className="font-mono text-white/70">{String(c.payoutRef)}</span>
  </div>
) : null}
{/* ===== INSERT END: payoutRef in list ===== */}

                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-[11px] text-white/45">
                    Stake uses current matchId {matchId ? "" : "(open match first)"}.
                  </div>
                </>
              ) : (
                <div className="mt-3 text-xs text-white/50">
                  DEV controls are hidden. (Set{" "}
                  <span className="font-mono">NEXT_PUBLIC_DEV_UI=1</span> to enable.)
                </div>
              )}
              {/* ===== REPLACE END: DEV_UI block ===== */}



            </div>

            <div className="text-right">
              <div className="text-xs text-white/60">Match escrow</div>
              <div className="mt-1 font-mono text-sm text-white/90">{matchId ? escrowLabel : "—"}</div>
              <div className="mt-2 text-xs text-white/60">
                {matchId ? `stakes: ${Object.keys(matchInfo?.stakes || {}).length}` : ""}
                {matchErr ? ` · ${matchErr}` : ""}
              </div>
            </div>
          </div>
        </div>


        {matchId && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60">Match</div>
            <div className="mt-1 font-mono text-sm text-white/90">{matchId}</div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="text-sm text-white/70">
                {label} · <span className="font-mono text-white/60">{GAME_ID}</span>
                {isHost ? <span className="ml-2 text-emerald-200">· host</span> : null}
              </div>

              <div className="flex items-center gap-2">
                                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={onStartMatch}
                    disabled={!canStartMatch}
                    className={
                      "rounded-xl px-4 py-2 text-sm font-medium " +
                      (!canStartMatch
                        ? "cursor-not-allowed bg-white/20 text-white/60"
                        : "bg-white text-black")
                    }
                  >
                    Start match
                  </button>

                  {!canStartMatch && matchStatus === "created" && (
                    <div className="text-[11px] text-white/50">
                      Need 2 stakes to start (now {stakesCount})
                    </div>
                  )}
                </div>


                <button
                  type="button"
                  onClick={onCreateNewMatch}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/90"
                >
                  Create new match
                </button>
              </div>
            </div>

            {startError ? <div className="mt-2 text-sm text-red-200">{startError}</div> : null}

            <div className="mt-2 text-xs text-white/50">
              2nd tab will auto-update from created → started.
            </div>
          </div>
        )}

        <div className="mt-6">
          <GameCanvas canPlay={!matchId || matchStatus === "started"} />
        </div>
      </div>
    </main>
  );
}
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

// ===== FILE END: apps/web/app/(public)/play/page.tsx =====
