// ===== FILE START: apps/web/components/game/BlackjackRuntime.tsx =====
"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  getPreviewScore,
  getRuntimeSummary,
  isBlackjackBust,
  isBlackjackClear,
  placeActiveCard,
  runtimeProgress,
  startBlackjackRuntime,
  type BlackjackLane,
  type BlackjackRuntimeState,
  type Card,
} from "@/lib/games/blackjackRuntime";
import { commitRun } from "@/lib/core/commitRun";
import { getGameMeta } from "@/lib/games/registry";
import { getGameConfig } from "@/lib/games/catalog";

function cardColor(suit: Card["suit"]) {
  return suit === "♥" || suit === "♦" ? "text-rose-500" : "text-slate-900";
}

function laneTone(score: number, busted: boolean) {
  if (busted) return "border-rose-400/60 bg-rose-500/15";
  if (score === 21) return "border-emerald-400/60 bg-emerald-500/15";
  if (score >= 17) return "border-amber-300/50 bg-amber-500/10";
  return "border-white/10 bg-white/5";
}

function statPill(label: string, value: React.ReactNode, valueClass = "") {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-center">
      <div className="text-[10px] font-semibold tracking-widest text-white/55">
        {label}
      </div>
      <div className={"mt-1 text-lg font-extrabold text-white " + valueClass}>
        {value}
      </div>
    </div>
  );
}

function PlayingCard({
  card,
  small = false,
  lifted = false,
}: {
  card: Card;
  small?: boolean;
  lifted?: boolean;
}) {
  return (
    <div
      className={
        "relative select-none rounded-2xl border border-white/20 bg-white shadow-[0_20px_40px_rgba(0,0,0,0.28)] transition-transform duration-200 " +
        (small ? "h-[72px] w-[52px]" : "h-[104px] w-[76px]") +
        (lifted ? " -translate-y-1 scale-[1.03]" : "")
      }
    >
      <div
        className={
          "absolute left-2 top-1 font-extrabold " +
          (small ? "text-sm" : "text-lg") +
          " " +
          cardColor(card.suit)
        }
      >
        {card.rank}
      </div>
      <div
        className={
          "absolute right-2 top-1 font-bold " +
          (small ? "text-xs" : "text-sm") +
          " " +
          cardColor(card.suit)
        }
      >
        {card.suit}
      </div>

      <div className="absolute inset-0 grid place-items-center">
        <div
          className={
            "font-black leading-none " +
            (small ? "text-2xl" : "text-4xl") +
            " " +
            cardColor(card.suit)
          }
        >
          {card.suit}
        </div>
      </div>

      <div
        className={
          "absolute bottom-1 right-2 rotate-180 font-extrabold " +
          (small ? "text-sm" : "text-lg") +
          " " +
          cardColor(card.suit)
        }
      >
        {card.rank}
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.45),transparent_35%)]" />
    </div>
  );
}

function EmptyCardGhost() {
  return (
    <div className="h-[104px] w-[76px] rounded-2xl border border-dashed border-white/15 bg-white/[0.03]" />
  );
}

function LanePreview({
  lane,
  activeCard,
  onPlace,
  disabled,
}: {
  lane: BlackjackLane;
  activeCard: Card | null;
  onPlace: () => void;
  disabled: boolean;
}) {
  const preview = getPreviewScore(lane, activeCard);
  const bust = activeCard ? isBlackjackBust(preview.total) : false;
  const clear = activeCard ? isBlackjackClear(preview.total) : false;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPlace}
      className={
        "relative overflow-hidden rounded-[26px] border p-3 text-left shadow-[0_24px_80px_-55px_rgba(0,0,0,0.95)] transition-all duration-200 " +
        laneTone(lane.score, lane.busted) +
        (disabled ? " opacity-75" : " hover:scale-[1.01] active:scale-[0.99]")
      }
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-semibold tracking-[0.18em] text-white/55">
            STACK {lane.id + 1}
          </div>
          <div className="mt-1 text-2xl font-black">{lane.score}</div>
        </div>

        <div className="text-right">
          <div className="text-[10px] font-semibold tracking-[0.18em] text-white/55">
            PREVIEW
          </div>
          <div
            className={
              "mt-1 text-2xl font-black " +
              (clear ? "text-emerald-300" : bust ? "text-rose-300" : "text-white")
            }
          >
            {activeCard ? preview.total : "—"}
          </div>
        </div>
      </div>

      <div className="mt-3 flex min-h-[118px] items-end gap-2 overflow-x-auto pb-1">
        {lane.cards.length === 0 ? <EmptyCardGhost /> : null}

        {lane.cards.map((card) => (
          <PlayingCard key={card.id} card={card} />
        ))}

        {activeCard ? (
          <div className="ml-1 flex items-center">
            <div className="text-2xl font-black text-white/35">+</div>
            <div className="ml-2">
              <PlayingCard card={activeCard} lifted />
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <div className="text-white/60">
          {lane.busted
            ? "Bust on previous move"
            : clear
            ? "Exact 21 → clear"
            : bust
            ? "Would bust"
            : "Place card here"}
        </div>

        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 font-semibold text-white/80">
          Clears: {lane.cleared}
        </div>
      </div>

      {clear ? (
        <div className="pointer-events-none absolute inset-0 rounded-[26px] border border-emerald-300/40 bg-emerald-400/10" />
      ) : null}

      {bust ? (
        <div className="pointer-events-none absolute inset-0 rounded-[26px] border border-rose-300/35 bg-rose-400/10" />
      ) : null}
    </button>
  );
}

type Props = {
  returnTo?: string;
};

export default function BlackjackRuntime({ returnTo: returnToProp }: Props) {
  const sp = useSearchParams();
  const meta = getGameMeta("blackjack");
  const defaultReturnTo = meta.routes?.modesHref || "/games/blackjack/modes";
  const returnTo = (returnToProp || sp.get("returnTo") || defaultReturnTo).trim();

  const mode = (sp.get("mode") || "warm-up").trim();
  const modeId = (sp.get("modeId") || "").trim();
  const entry = Number(sp.get("entry") || "0");
  const prize = Number(sp.get("prize") || "0");
  const currencyParam = (sp.get("currency") || "gems").trim().toLowerCase();
  const resultCurrency = currencyParam === "cash" ? "cash" : "gems";

  const gameConfig = getGameConfig("blackjack");
  const resolvedModeMeta =
    gameConfig.modes.find((m) => m.id === modeId) ||
    gameConfig.modes.find((m) => m.mode === mode) ||
    null;

  const resolvedModeTitle = resolvedModeMeta?.title || mode;

  const [state, setState] = React.useState<BlackjackRuntimeState>(() =>
    startBlackjackRuntime()
  );
  const [placingLaneId, setPlacingLaneId] = React.useState<number | null>(null);

  const committedRef = React.useRef(false);

  React.useEffect(() => {
    if (!state.finished) return;
    if (committedRef.current) return;

    committedRef.current = true;

    const resultPrize =
      state.result === "won"
        ? Math.max(120, Math.floor(state.score / 8))
        : Math.max(1, Math.floor(state.score / 30));

    commitRun({
      gameId: "blackjack",
      title: `21 Blackjack · ${resolvedModeTitle}`,
      currency: resultCurrency,
      prize:
        resultCurrency === "cash" && Number.isFinite(prize) && prize > 0
          ? prize
          : resultPrize,
      mode,
      score: state.score,
      serverScore: state.score,

      verified: true,
      outcome: state.result === "won" ? "win" : "loss",
      durationMs: 0,
      placement: state.result === "won" ? 1 : null,
      rewardSource: resultCurrency === "cash" ? "cash" : "practice",

      walletDelta: resultCurrency === "gems" ? resultPrize : 0,
    });
  }, [
    state.finished,
    state.result,
    state.score,
    resultCurrency,
    prize,
    mode,
    modeId,
    resolvedModeTitle,
  ]);

  function restart() {
    committedRef.current = false;
    setPlacingLaneId(null);
    setState(startBlackjackRuntime());
  }

  function placeToLane(laneId: number) {
    if (state.finished) return;
    if (!state.activeCard) return;

    setPlacingLaneId(laneId);

    window.setTimeout(() => {
      setState((prev) => placeActiveCard(prev, laneId));
      setPlacingLaneId(null);
    }, 140);
  }

  const summary = getRuntimeSummary(state);
  const progress = runtimeProgress(state);

  return (
    <main className="min-h-screen text-white">
      <div className="min-h-screen bg-[radial-gradient(1200px_720px_at_50%_-80px,rgba(255,255,255,0.18),transparent_55%),radial-gradient(1000px_700px_at_15%_20%,rgba(59,130,246,0.14),transparent_60%),radial-gradient(1000px_700px_at_85%_15%,rgba(34,197,94,0.12),transparent_60%),linear-gradient(180deg,#0f172a_0%,#0f3b2f_46%,#07111d_100%)]">
        <div className="mx-auto flex min-h-screen max-w-md flex-col px-3 pb-24 pt-3">
          <div className="flex items-center justify-between">
            <Link
              href={returnTo}
              className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/10 text-xl"
            >
              ←
            </Link>

            <div className="text-center">
              <div className="text-sm font-semibold text-white/80">
                21 Blackjack
              </div>
              <div className="text-4xl font-extrabold text-emerald-300 drop-shadow-[0_0_18px_rgba(52,211,153,0.25)]">
                {state.score}
              </div>
            </div>

            <button
              type="button"
              onClick={restart}
              className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/10 text-xl"
              title="Restart"
            >
              ↺
            </button>
          </div>

          <div className="mt-4 rounded-[28px] border border-white/10 bg-white/10 p-4 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)] backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold tracking-[0.18em] text-white/60">
                  ACTIVE CARD
                </div>
                <div className="mt-1 text-sm font-semibold text-white/80">
                  Drag-style quick placement loop
                </div>
              </div>

              <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-white/75">
                {state.finished ? "Finished" : "Playing"}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="flex min-h-[112px] flex-1 items-center justify-center rounded-[24px] border border-white/10 bg-black/20 px-3 py-3">
                {state.activeCard ? (
                  <PlayingCard card={state.activeCard} />
                ) : (
                  <div className="text-center">
                    <div className="text-3xl font-black text-emerald-300">
                      {state.result === "won" ? "WIN" : "END"}
                    </div>
                    <div className="mt-1 text-sm text-white/60">
                      {state.result === "won" ? "Deck completed" : "Run finished"}
                    </div>
                  </div>
                )}
              </div>

              <div className="w-[112px] shrink-0 space-y-2">
                {statPill("CLEARS", summary.clears, "text-emerald-200")}
                {statPill("BUSTS", summary.busts, "text-rose-200")}
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-[11px] text-white/60">
                <span>Deck progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full border border-white/10 bg-black/20">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#34d399,#60a5fa)] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {statPill("STREAK", summary.streak, "text-yellow-200")}
            {statPill("MOVES", state.moves, "text-sky-200")}
            {statPill(
              "RESULT",
              summary.result === "playing" ? "RUN" : summary.result.toUpperCase()
            )}
          </div>

          <div className="mt-4 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(0,0,0,0.18))] p-3 shadow-[0_32px_140px_-80px_rgba(0,0,0,0.95)] backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold tracking-[0.18em] text-white/55">
                  TABLE
                </div>
                <div className="mt-1 text-xl font-black">Build 21 stacks</div>
              </div>

              <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-white/75">
                Place current card into any stack
              </div>
            </div>

            <div className="space-y-3">
              {state.lanes.map((lane) => (
                <LanePreview
                  key={lane.id}
                  lane={lane}
                  activeCard={state.activeCard}
                  disabled={state.finished || placingLaneId !== null}
                  onPlace={() => placeToLane(lane.id)}
                />
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-white/75">
            <div className="text-base font-extrabold text-white">
              How this version works
            </div>
            <div className="mt-2 space-y-1">
              <div>• Place the active card into one of the 4 stacks.</div>
              <div>• Reach exactly 21 to clear a stack and score big.</div>
              <div>• Go above 21 and you bust that stack.</div>
              <div>• Too many busts ends the run.</div>
            </div>
          </div>

          {state.finished ? (
            <div className="mt-5 rounded-[28px] border border-white/10 bg-black/25 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <div className="text-center text-3xl font-extrabold">
                {state.result === "won" ? "Run Complete!" : "Run Over"}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-base">
                <div className="rounded-2xl bg-white/5 px-4 py-3">
                  <div className="text-white/60">Total Score</div>
                  <div className="mt-1 text-2xl font-black">{state.score}</div>
                </div>

                <div className="rounded-2xl bg-white/5 px-4 py-3">
                  <div className="text-white/60">Clears</div>
                  <div className="mt-1 text-2xl font-black text-emerald-300">
                    {state.clears}
                  </div>
                </div>

                <div className="rounded-2xl bg-white/5 px-4 py-3">
                  <div className="text-white/60">Busts</div>
                  <div className="mt-1 text-2xl font-black text-rose-300">
                    {state.busts}
                  </div>
                </div>

                <div className="rounded-2xl bg-white/5 px-4 py-3">
                  <div className="text-white/60">Streak</div>
                  <div className="mt-1 text-2xl font-black text-yellow-200">
                    {state.streak}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={restart}
                  className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-black"
                >
                  Play again
                </button>

                <Link
                  href={returnTo}
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center text-sm font-semibold text-white"
                >
                  Back
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
// ===== FILE END: apps/web/components/game/BlackjackRuntime.tsx =====