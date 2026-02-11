// ===== FILE START: apps/web/app/(public)/lobby/page.tsx =====
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { readLeaderboard, subscribeLeaderboard } from "@/lib/leaderboard";
import { apiCreateMatch } from "@/lib/matchApi";

const MATCH_ID_KEY = "rt_match_id_v1";
const MATCH_HOST_KEY = "rt_match_host_v1";
const TAB_PLAYER_KEY = "rt_tab_player_id_v1";
const GAME_ID = "reaction-tap";

function readMatchId(): string | null {
  try {
    const v = localStorage.getItem(MATCH_ID_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

function writeMatchId(id: string | null) {
  try {
    if (!id) localStorage.removeItem(MATCH_ID_KEY);
    else localStorage.setItem(MATCH_ID_KEY, id);
  } catch {}
}

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

export default function LobbyPage() {
  const router = useRouter();

  const [best, setBest] = useState<number | null>(null);

  const [matchId, setMatchId] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState("");

  // ✅ wallet HUD
  const [playerId, setPlayerId] = useState<string>("");
  const [walletUsd, setWalletUsd] = useState<number | null>(null);
  const [walletErr, setWalletErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    // leaderboard (local)
    const pull = () => {
      const runs = readLeaderboard();
      const top = runs.length > 0 ? runs[0].serverScore : null;
      setBest(top);
    };
    pull();
    const unsub = subscribeLeaderboard(pull);

    // matchId (persisted)
    setMatchId(readMatchId());

    // playerId (per tab)
    const pid = ensureTabPlayerId();
    setPlayerId(pid);

    return unsub;
  }, []);

  // poll wallet
  useEffect(() => {
    if (!playerId) return;

    let alive = true;
    let t: any = null;

    const tick = async () => {
      try {
        const r = await fetch(`/api/wallet/${encodeURIComponent(playerId)}`, { cache: "no-store" });
        const j = await r.json().catch(() => null);

        if (!alive) return;

        if (!r.ok || j?.ok === false) {
          setWalletUsd(null);
          setWalletErr(j?.error || "wallet_fetch_failed");
        } else {
          const b = j?.wallet?.balances || {};
          const usd = typeof b["USD"] === "number" ? b["USD"] : 0;
          setWalletUsd(usd);
          setWalletErr(null);
        }
      } catch {
        if (!alive) return;
        setWalletUsd(null);
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

  const bestLabel = useMemo(() => (best === null ? "—" : String(best)), [best]);

  const inviteLink = useMemo(() => {
    if (!matchId) return "";
    return `${window.location.origin}/play?matchId=${encodeURIComponent(matchId)}`;
  }, [matchId]);

  async function onCreateMatch() {
    const res = await apiCreateMatch();

    if (!res.ok) {
      alert("Create match failed. Check API is running.");
      return;
    }

    const id = String(res.data?.match?.id || "").trim();
    if (!id) {
      alert("Create match failed: missing match.id");
      return;
    }

    writeMatchId(id);
    setMatchId(id);
  }

  async function onCopyInvite() {
    if (!matchId) {
      alert("No match yet. Create one first.");
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = inviteLink;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {}
    }
  }

  function onJoin() {
    const id = (joinInput || "").trim();
    if (!id) return;

    writeMatchId(id);
    try {
      localStorage.removeItem(MATCH_HOST_KEY);
    } catch {}
    setMatchId(id);

    router.push(`/play?matchId=${encodeURIComponent(id)}`);
  }

  // ✅ DEV buttons
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

      // wallet poll will update, but we can also set instantly:
      setWalletUsd(Number(j?.balance ?? walletUsd ?? 0));
    } finally {
      setBusy(null);
    }
  }

  async function onStake10() {
    if (!playerId) return;
    if (!matchId) {
      alert("Create a match first.");
      return;
    }

    setBusy("stake");
    try {
      const r = await fetch(`/api/match/${encodeURIComponent(matchId)}/stake`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, amount: 10, currency: "USD", gameId: GAME_ID }),
      });

      const j = await r.json().catch(() => null);
      if (!r.ok || j?.ok === false) {
        alert(`Stake failed: ${j?.error || j?.reason || r.status}`);
        return;
      }

      alert("Stake placed ✅ (escrow updated)");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex max-w-xl flex-col px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Lobby</h1>
          <Link href="/" className="text-sm text-white/70 hover:text-white">
            Home
          </Link>
        </div>

        {/* ✅ Wallet (DEV HUD) */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs text-white/60">This tab player</div>
              <div className="mt-1 font-mono text-sm text-white/90">{playerId || "—"}</div>
              <div className="mt-2 text-xs text-white/60">
                Wallet (USD):{" "}
                <span className="font-mono text-white/80">
                  {walletErr ? walletErr : walletUsd === null ? "—" : `${walletUsd} USD`}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onFund50}
                disabled={busy !== null}
                className={
                  "rounded-2xl px-5 py-3 font-medium " +
                  (busy !== null ? "cursor-not-allowed bg-white/20 text-white/60" : "bg-white text-black")
                }
              >
                Fund +50 (DEV)
              </button>

              <button
                type="button"
                onClick={onStake10}
                disabled={busy !== null || !matchId}
                className={
                  "rounded-2xl border border-white/15 px-5 py-3 font-medium " +
                  (busy !== null || !matchId
                    ? "cursor-not-allowed bg-white/5 text-white/40"
                    : "bg-white/10 text-white/90")
                }
              >
                Stake 10 (DEV)
              </button>

              <div className="text-[11px] text-white/50">
                Uses current matchId{matchId ? "" : " (create match first)"}.
              </div>
            </div>
          </div>
        </div>

        {/* Solo */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-xs text-white/60">Best verified score</div>
          <div className="mt-1 text-3xl font-semibold">{bestLabel}</div>
          <div className="mt-2 text-sm text-white/60">Your runs are verified by the local server.</div>

          <div className="mt-6 flex gap-3">
            <Link
              href="/play"
              className="flex-1 rounded-2xl bg-white px-5 py-3 text-center font-medium text-black"
            >
              Solo Play
            </Link>

            <Link
              href="/leaderboard"
              className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center font-medium text-white"
            >
              Leaderboard
            </Link>
          </div>
        </div>

        {/* Match (MVP) */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Match (MVP)</div>
          <div className="mt-2 text-sm text-white/65">Create a match, copy invite, share with a friend.</div>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onCreateMatch}
              className="flex-1 rounded-2xl bg-white px-5 py-3 text-center font-medium text-black"
            >
              Create match
            </button>

            <button
              type="button"
              onClick={onCopyInvite}
              className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center font-medium text-white"
            >
              Copy invite link
            </button>
          </div>

          <div className="mt-5 text-xs text-white/60">matchId</div>
          <div className="mt-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm">
            {matchId ?? "—"}
          </div>

          <div className="mt-5 text-xs text-white/60">Join existing match</div>
          <div className="mt-2 flex gap-3">
            <input
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="Paste matchId here"
              className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none"
            />
            <button
              type="button"
              onClick={onJoin}
              className="rounded-2xl bg-white px-5 py-3 font-medium text-black"
            >
              Join
            </button>
          </div>

          <div className="mt-3 text-sm text-white/70">{matchId ? "Match ready ✅" : "No match yet. Create one first."}</div>
        </div>

        {/* How it works */}
        <div className="mt-6 rounded-3xl border border-white/10 p-6">
          <div className="text-sm font-semibold">How it works</div>
          <ul className="mt-2 space-y-2 text-sm text-white/65">
            <li>• Wait for GO (false start ends the run).</li>
            <li>• Hit targets fast; misses reduce score.</li>
            <li>• Server recomputes score + basic anti-cheat checks.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
// ===== FILE END: apps/web/app/(public)/lobby/page.tsx =====
