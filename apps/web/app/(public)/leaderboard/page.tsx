// ===== FILE START: apps/web/app/(public)/leaderboard/page.tsx =====
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type StoredRun = {
  id: string;
  createdAt: number;
  seed: number;
  hits: number;
  misses: number;
  avgReactionMs: number | null;
  durationMs: number;
  spawnCount: number;
  tapCount: number;
  serverScore: number;
};

type Mode = "top" | "recent";

export default function LeaderboardPage() {
  const [mode, setMode] = useState<Mode>("top");
  const [items, setItems] = useState<StoredRun[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  useEffect(() => {
    let alive = true;

    async function load() {
      setStatus("loading");
      try {
        const url = mode === "top" ? "/api/leaderboard/top" : "/api/leaderboard/recent";
        const r = await fetch(url, { cache: "no-store" });
        const text = await r.text();

        let data: any = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = null;
        }

        if (!alive) return;

        if (Array.isArray(data?.items)) {
          setItems(data.items);
          setStatus("ok");
        } else {
          console.log("[LEADERBOARD LOAD] bad response:", { mode, status: r.status, text });
          setItems([]);
          setStatus("error");
        }
      } catch (e) {
        if (!alive) return;
        console.log("[LEADERBOARD LOAD] error:", e);
        setItems([]);
        setStatus("error");
      }
    }

    load();
    const t = window.setInterval(load, 3000);

    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [mode]);

  const list = useMemo(() => items.slice(0, 20), [items]);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Leaderboard</h1>
          <Link href="/lobby" className="text-sm text-white/70 hover:text-white">
            Back
          </Link>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-1">
            <button
              onClick={() => setMode("top")}
              className={
                "rounded-xl px-3 py-2 text-sm transition " +
                (mode === "top" ? "bg-white text-black" : "text-white/70 hover:text-white")
              }
            >
              Top
            </button>
            <button
              onClick={() => setMode("recent")}
              className={
                "rounded-xl px-3 py-2 text-sm transition " +
                (mode === "recent" ? "bg-white text-black" : "text-white/70 hover:text-white")
              }
            >
              Recent
            </button>
          </div>

          <div className="text-xs text-white/60">
            {status === "loading" ? "Updating…" : status === "error" ? "Failed to load" : "Live"}
          </div>
        </div>

        <p className="mt-3 text-sm text-white/60">
          {mode === "top"
            ? "Server leaderboard (highest scores)."
            : "Server leaderboard (most recent verified runs)."}
        </p>

        <div className="mt-6 overflow-hidden rounded-3xl border border-white/10">
          {list.length === 0 ? (
            <div className="p-6 text-sm text-white/60">
              No runs yet. Play a verified run first.
            </div>
          ) : (
            <ul className="divide-y divide-white/10">
              {list.map((r, idx) => (
                <li key={r.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 text-white/60">{mode === "top" ? `#${idx + 1}` : "•"}</div>
                    <div>
                      <div className="font-semibold">{r.serverScore}</div>
                      <div className="text-xs text-white/60">
                        hits {r.hits} · miss {r.misses} · avg{" "}
                        {r.avgReactionMs === null ? "-" : Math.round(r.avgReactionMs)}ms
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-white/50">
                    {new Date(r.createdAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6">
          <Link
            href="/play"
            className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 font-medium text-black"
          >
            Play
          </Link>
        </div>
      </div>
    </main>
  );
}
// ===== FILE END: apps/web/app/(public)/leaderboard/page.tsx =====
