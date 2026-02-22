// ===== FILE START: apps/web/app/(public)/results/page.tsx =====
"use client";

import { useEffect, useMemo, useState } from "react";
import { readResultsRuns, type ResultsRun } from "@/lib/resultsStore";


function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type AnyRun = ResultsRun;


function timeAgo(ts: number, now: number) {
  const diff = now - ts;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}


function asTs(r: AnyRun) {
  // ResultsRun гарантированно хранит createdAt
  return typeof (r as any).createdAt === "number" ? (r as any).createdAt : Date.now();
}

function runKey(r: AnyRun, i: number) {
  // ResultsRun гарантированно хранит id
  return String((r as any).id || `${asTs(r)}_${i}`);
}


function detectCurrency(r: AnyRun): "cash" | "gems" {
  // ResultsRun хранит currency всегда
  return ((r as any).currency === "cash" ? "cash" : "gems") as "cash" | "gems";
}

function detectTitle(r: AnyRun) {
  // ResultsRun хранит title (мы его пишем из GameCanvas как "Warm up")
  const t = (r as any).title;
  if (typeof t === "string" && t.trim()) return t;

  const gid = String((r as any).gameId || "");
  return gid || "Warm up";
}

function detectLeftIcon(r: AnyRun) {
  const gid = String((r as any).gameId || "").toLowerCase();
  if (gid.includes("reaction")) return "🎮";
  return "🕹️";
}


export default function ResultsPage() {
    const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<AnyRun[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState<number>(0);


useEffect(() => {
  setNow(Date.now());
  const t = window.setInterval(() => setNow(Date.now()), 10_000);
  return () => window.clearInterval(t);
}, []);


    useEffect(() => {
  let alive = true;

  (async () => {
    setLoading(true);
    setErr(null);
    try {
      const list = readResultsRuns();
      if (alive) setRuns(list);
    } catch (e: any) {
      if (alive) setErr(e?.message || "Failed to load");
    } finally {
      if (alive) setLoading(false);
    }
  })();

  return () => {
    alive = false;
  };
}, []);



  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
          Loading…
        </div>
      );
    }

    if (err) {
      return (
        <div className="mt-5 rounded-3xl border border-rose-300/20 bg-rose-500/10 p-6 text-sm text-white/80">
          Failed to load results. (API not ready yet)
          <div className="mt-2 text-xs text-white/60">{err}</div>
        </div>
      );
    }

    if (!runs.length) {
      return (
        <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
          No matches yet. Play a round and come back.
        </div>
      );
    }

    return (
      <div className="mt-5">
        <div className="flex flex-col gap-3">
          {runs.slice(0, 30).map((r, i) => {
            const ts = asTs(r);
            const currency = detectCurrency(r);
            const right =
              currency === "cash"
                ? `$${(typeof r.prize === "number" ? r.prize : 0.35).toFixed(2)}`
                : `${typeof r.prize === "number" ? r.prize : 120}`;

            const rightBadge =
              currency === "cash"
                ? "text-emerald-200 drop-shadow"
                : "text-sky-200 drop-shadow";

            return (
              <div
                key={runKey(r, i)}
                className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 shadow-[0_30px_120px_-95px_rgba(0,0,0,0.9)]"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5 text-xl">
                  {detectLeftIcon(r)}
                </div>

                <div className="flex-1">
                  <div className="text-sm font-extrabold">{detectTitle(r)}</div>
                  <div className="mt-1 text-xs text-white/60">{timeAgo(ts, now || Date.now())}</div>

                </div>

                <div className="flex items-center gap-3">
                  <div className={cn("text-xl font-extrabold", rightBadge)}>
                    {right}
                    {currency === "gems" ? <span className="ml-1 text-sm">💎</span> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {}}
                    className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/70"
                    aria-label="More"
                    title="More"
                  >
                    ⋮
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [loading, err, runs]);

  return (
    <main className="min-h-screen text-white">
      <div className="min-h-screen bg-[radial-gradient(1200px_800px_at_50%_-200px,rgba(255,255,255,0.18),transparent_60%),linear-gradient(180deg,#6b21a8_0%,#3b0a7a_40%,#170027_100%)]">
        <div className="mx-auto flex max-w-md flex-col px-4 pb-28 pt-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)]">
            <div className="text-lg font-extrabold">Past matches</div>
            <div className="mt-2 text-sm text-white/70">
              Recent runs (cash & gems). Later: filters per game + receipts.
            </div>
          </div>

          {content}
        </div>
      </div>
    </main>
  );
}
// ===== FILE END: apps/web/app/(public)/results/page.tsx =====
