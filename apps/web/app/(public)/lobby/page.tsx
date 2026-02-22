// ===== FILE START: apps/web/app/(public)/lobby/page.tsx =====
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { readLeaderboard, subscribeLeaderboard } from "@/lib/leaderboard";
import { apiCreateMatch } from "@/lib/matchApi";

const MATCH_ID_KEY = "rt_match_id_v1";
const MATCH_HOST_KEY = "rt_match_host_v1";
const GAME_ID_FALLBACK = "reaction-tap";

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

export default function LobbyPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const gameId = (sp.get("gameId") || GAME_ID_FALLBACK).trim() || GAME_ID_FALLBACK;
  const mode = (sp.get("mode") || "").trim(); // optional (from /games/[gameId])

  const [best, setBest] = useState<number | null>(null);

  const [matchId, setMatchId] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState("");

  // hydration-safe origin for invite link
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    setOrigin(window.location.origin);

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

    return unsub;
  }, []);

  const bestLabel = useMemo(() => (best === null ? "—" : String(best)), [best]);

  const playUrl = useMemo(() => {
    if (!matchId) return "";
    const qs = new URLSearchParams();
    qs.set("matchId", matchId);
    if (gameId) qs.set("gameId", gameId);
    if (mode) qs.set("mode", mode);
    return `/play?${qs.toString()}`;
  }, [matchId, gameId, mode]);

  const inviteLink = useMemo(() => {
    if (!origin || !matchId) return "";
    return `${origin}${playUrl}`;
  }, [origin, matchId, playUrl]);

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

    // host marker (optional)
    try {
      localStorage.setItem(MATCH_HOST_KEY, id);
    } catch {}
  }

  async function onCopyInvite() {
    if (!matchId) {
      alert("No match yet. Create one first.");
      return;
    }
    if (!inviteLink) {
      alert("Invite link not ready yet.");
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

    router.push(playUrl.replace(/matchId=[^&]+/, `matchId=${encodeURIComponent(id)}`));
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex max-w-xl flex-col px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Lobby</h1>
          <Link href={`/games/${encodeURIComponent(gameId)}`} className="text-sm text-white/70 hover:text-white">
            Back to modes
          </Link>
        </div>

        {/* Solo */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-xs text-white/60">Best verified score</div>
          <div className="mt-1 text-3xl font-semibold">{bestLabel}</div>
          <div className="mt-2 text-sm text-white/60">Your runs are verified by the local server.</div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={async () => {
                try {
                  const r = await fetch("/api/match/create", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ gameId, durationMs: 30_000 }),
                  });

                  const j = await r.json().catch(() => null);

                  const id =
                    (j && j.match && typeof j.match.id === "string" && j.match.id) ||
                    (j && typeof j.id === "string" && j.id) ||
                    "";

                  if (!r.ok || !id) {
                    console.error("[SOLO CREATE] bad response", { status: r.status, j });
                    alert("Solo create failed. Check server logs.");
                    return;
                  }

                  try {
                    localStorage.setItem(MATCH_HOST_KEY, id);
                  } catch {}

                  // go to play
                  const qs = new URLSearchParams();
                  qs.set("matchId", id);
                  qs.set("mode", "solo");
                  qs.set("gameId", gameId);
                  window.location.href = `/play?${qs.toString()}`;
                } catch (e) {
                  console.error("[SOLO CREATE] network error", e);
                  alert("Solo create failed (network). Is web server running?");
                }
              }}
              className="flex-1 rounded-2xl bg-white px-5 py-3 text-center font-medium text-black"
            >
              Solo Play
            </button>

            <Link
              href="/leaderboard"
              className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center font-medium text-white"
            >
              Leaderboard
            </Link>
          </div>
        </div>

        {/* Match */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Match</div>
          <div className="mt-2 text-sm text-white/65">
            Create a match, copy invite, share with a friend.
            {mode ? <span className="ml-2 text-white/55">(mode: {mode})</span> : null}
          </div>

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

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={!matchId}
              onClick={() => {
                if (!matchId) return;
                router.push(playUrl);
              }}
              className={
                "flex-1 rounded-2xl px-5 py-3 text-center font-medium " +
                (!matchId ? "cursor-not-allowed bg-white/10 text-white/40" : "bg-emerald-400 text-black")
              }
            >
              Go to match
            </button>

            <Link
              href={`/games/${encodeURIComponent(gameId)}`}
              className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center font-medium text-white"
            >
              Change mode
            </Link>
          </div>

          <div className="mt-5 text-xs text-white/60">Join existing match</div>
          <div className="mt-2 flex gap-3">
            <input
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="Paste matchId here"
              className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none"
            />
            <button type="button" onClick={onJoin} className="rounded-2xl bg-white px-5 py-3 font-medium text-black">
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