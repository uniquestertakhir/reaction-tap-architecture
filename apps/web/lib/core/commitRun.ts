import { addResultsRun, type ResultsCurrency } from "@/lib/resultsStore";
import { addCash, addGems } from "@/lib/playerStore";

type CommitRunInput = {
  gameId: string;
  title: string;

  // economy/result view
  currency: ResultsCurrency; // "cash" | "gems"
  prize: number;

  // extra
  matchId?: string | null;
  mode?: string;
  score?: number;
  serverScore?: number;

  // platform-result contract
  verified?: boolean;
  outcome?: "win" | "loss" | "completed";
  durationMs?: number;
  placement?: number | null;
  rewardSource?: "practice" | "cash" | "reward" | "unknown";

  // wallet delta (optional; if omitted, wallet is not touched)
  walletDelta?: number;
};

export function commitRun(input: CommitRunInput) {
  // 1) results history
    addResultsRun({
    gameId: input.gameId,
    title: input.title,
    currency: input.currency,
    prize: input.prize,

    matchId: input.matchId ?? null,
    mode: input.mode,
    score: input.score,
    serverScore: input.serverScore,

    verified: input.verified,
    outcome: input.outcome,
    durationMs: input.durationMs,
    placement: input.placement,
    rewardSource: input.rewardSource,
  });

  // 2) wallet (optional)
  if (typeof input.walletDelta === "number" && input.walletDelta !== 0) {
    if (input.currency === "cash") addCash(input.walletDelta);
    else addGems(input.walletDelta);
  }
}