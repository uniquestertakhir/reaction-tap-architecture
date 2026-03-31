// ===== FILE START: apps/web/app/(public)/results/page.tsx =====
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  readResultsRuns,
  readResultsRunsByCurrency,
  readResultsRunsByGame,
  type ResultsRun,
} from "@/lib/resultsStore";
import { getGameMeta, listGamesMeta } from "@/lib/games/registry";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type AnyRun = ResultsRun;
type GameFilter = "all" | string;
type CurrencyFilter = "all" | "cash" | "gems";

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
  return typeof r.createdAt === "number" ? r.createdAt : Date.now();
}

function runKey(r: AnyRun, i: number) {
  return String(r.id || `${asTs(r)}_${i}`);
}

function detectCurrency(r: AnyRun): "cash" | "gems" {
  return r.currency === "cash" ? "cash" : "gems";
}

function detectTitle(r: AnyRun) {
  const gid = String(r.gameId || "").trim();
  const meta = getGameMeta(gid);
  const rawTitle = String(r.title || "").trim();

  if (rawTitle) return rawTitle;
  return meta.title || "Run";
}

function detectLeftIcon(r: AnyRun) {
  const gid = String(r.gameId || "").trim();
  return getGameMeta(gid).icon;
}

function detectOutcomeLabel(r: AnyRun) {
  if (r.outcome === "win") return "WIN";
  if (r.outcome === "loss") return "LOSS";
  if (r.outcome === "completed") return "DONE";
  return null;
}

function detectOutcomeClass(r: AnyRun) {
  if (r.outcome === "win") return "bg-emerald-400/20 text-emerald-200 border-emerald-300/20";
  if (r.outcome === "loss") return "bg-rose-400/20 text-rose-200 border-rose-300/20";
  if (r.outcome === "completed") return "bg-sky-400/20 text-sky-200 border-sky-300/20";
  return "bg-white/10 text-white/70 border-white/10";
}

function detectMetaLine(r: AnyRun) {
  const parts: string[] = [];

  if (r.rewardSource === "practice") parts.push("Practice");
  else if (r.rewardSource === "cash") parts.push("Cash");
  else if (r.rewardSource === "reward") parts.push("Reward");

  if (typeof r.score === "number") parts.push(`Score ${r.score}`);
  if (r.verified === true) parts.push("Verified");
  if (r.verified === false) parts.push("Unverified");

  return parts.join(" • ");
}

export default function ResultsPage() {
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<AnyRun[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState<number>(0);

  const [gameFilter, setGameFilter] = useState<GameFilter>("all");
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>("all");
    const gameOptions = useMemo(() => {
    return listGamesMeta().map((g) => ({
      id: g.id,
      title: g.title,
    }));
  }, []);

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
        let list: AnyRun[] = [];

        if (gameFilter !== "all") {
          list = readResultsRunsByGame(gameFilter);
        } else if (currencyFilter !== "all") {
          list = readResultsRunsByCurrency(currencyFilter);
        } else {
          list = readResultsRuns();
        }

        if (gameFilter !== "all" && currencyFilter !== "all") {
          list = list.filter((r) => detectCurrency(r) === currencyFilter);
        }

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
  }, [gameFilter, currencyFilter]);

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
          Failed to load results.
          <div className="mt-2 text-xs text-white/60">{err}</div>
        </div>
      );
    }

    if (!runs.length) {
      return (
        <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
          No matches for this filter yet.
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
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-extrabold">{detectTitle(r)}</div>

                    {detectOutcomeLabel(r) ? (
                      <div
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-extrabold tracking-wide",
                          detectOutcomeClass(r)
                        )}
                      >
                        {detectOutcomeLabel(r)}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-1 text-xs text-white/60">
                    {timeAgo(ts, now || Date.now())}
                  </div>

                  {detectMetaLine(r) ? (
                    <div className="mt-1 text-[11px] text-white/45">
                      {detectMetaLine(r)}
                    </div>
                  ) : null}
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
  }, [loading, err, runs, now]);

  return (
    <main className="min-h-screen text-white">
      <div className="min-h-screen bg-[radial-gradient(1200px_800px_at_50%_-200px,rgba(255,255,255,0.18),transparent_60%),linear-gradient(180deg,#6b21a8_0%,#3b0a7a_40%,#170027_100%)]">
        <div className="mx-auto flex max-w-md flex-col px-4 pb-28 pt-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)]">
            <div className="text-lg font-extrabold">Past matches</div>
            <div className="mt-2 text-sm text-white/70">
              Recent runs with core filters by game and currency.
            </div>

            <div className="mt-4 space-y-3">
                            <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">
                  Game
                </div>

                <div className="flex flex-wrap gap-2">
                  {[{ id: "all", title: "All games" }, ...gameOptions].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setGameFilter(item.id)}
                      className={cn(
                        "rounded-2xl border px-3 py-2 text-sm font-semibold",
                        gameFilter === item.id
                          ? "border-white/20 bg-white text-black"
                          : "border-white/10 bg-white/5 text-white/80"
                      )}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">
                  Currency
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["all", "cash", "gems"] as CurrencyFilter[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCurrencyFilter(value)}
                      className={cn(
                        "rounded-2xl border px-3 py-2 text-sm font-semibold",
                        currencyFilter === value
                          ? "border-white/20 bg-white text-black"
                          : "border-white/10 bg-white/5 text-white/80"
                      )}
                    >
                      {value === "all" ? "All currencies" : value === "cash" ? "Cash" : "Gems"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {content}
        </div>
      </div>
    </main>
  );
}
// ===== FILE END: apps/web/app/(public)/results/page.tsx =====