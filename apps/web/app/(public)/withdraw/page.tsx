// ===== FILE START: apps/web/app/(public)/withdraw/page.tsx =====
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readPlayer } from "@/lib/playerStore";

type Wallet = {
  playerId: string;
  balances: Record<string, number>;
  bonus?: Record<string, number>;
  held: Record<string, number>;
};

async function safeJson(r: Response) {
  try {
    return await r.json();
  } catch {
    return null;
  }
}

function n2(x: any) {
  const v = Number(x || 0);
  return Number.isFinite(v) ? v : 0;
}

function fmtUsd(x: number) {
  return `$${x.toFixed(2).replace(/\.00$/, "")}`;
}

export default function WithdrawPage() {
  const player = useMemo(() => readPlayer(), []);
  const playerId = String((player as any)?.id || (player as any)?.playerId || "").trim();

  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [amountStr, setAmountStr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Blitz-like constants
  const MIN_W = 10;
  const MAX_W = 100;
  const MONTHLY_LIMIT = 30000;

  async function refreshWallet() {
    setError(null);
    setLoading(true);

    try {
      if (!playerId) {
        setError("Missing playerId");
        setWallet(null);
        return;
      }

      const r = await fetch(`/api/wallet/${encodeURIComponent(playerId)}`, {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const j = await safeJson(r);

      if (!r.ok || !j?.wallet) {
        setError(j?.error || "Failed to load wallet");
        setWallet(null);
        return;
      }

      setWallet(j.wallet as Wallet);
    } catch {
      setError("Network error");
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cash = n2(wallet?.balances?.USD);
  const bonus = n2(wallet?.bonus?.USD);
  const accountBalance = cash + bonus;

  const amount = useMemo(() => {
    // allow "10", "10.5", "10,5"
    const raw = amountStr.replace(",", ".").trim();
    const v = Number(raw);
    return Number.isFinite(v) ? v : NaN;
  }, [amountStr]);

  const canSubmit =
    !!wallet &&
    !submitting &&
    Number.isFinite(amount) &&
    amount > 0 &&
    amount >= MIN_W &&
    amount <= MAX_W &&
    amount <= cash;

  async function onSubmit() {
    if (!canSubmit || !wallet) return;

    setSubmitting(true);
    setToast(null);
    setError(null);

    try {
      const r = await fetch(`/api/wallet/withdraw`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          playerId,
          amount,
          currency: "USD",
        }),
      });

      const j = await safeJson(r);

      if (!r.ok || !j?.ok) {
        const code = String(j?.error || "withdraw_failed");

        // map backend errors -> Blitz-ish copy
        if (code === "insufficient_funds") setError("Withdrawable cash too low.");
        else if (code === "below_min_withdraw") setError(`Minimum withdrawal: ${fmtUsd(MIN_W)}`);
        else if (code === "above_max_withdraw") setError(`Maximum withdrawal: ${fmtUsd(MAX_W)}`);
        else if (code === "monthly_limit_exceeded") setError(`Monthly limit exceeded (${fmtUsd(MONTHLY_LIMIT)})`);
        else setError(code);

        return;
      }

      setToast("Withdrawal request created. Status: pending.");
      setAmountStr("");
      // refresh wallet to reflect hold + bonus forfeited
      await refreshWallet();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-24 pt-6">
      <div className="flex items-center gap-3">
        <Link
          href="/games"
          className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/90"
        >
          ←
        </Link>

        <div className="flex-1">
          <div className="text-xl font-extrabold">Withdraw</div>
          <div className="text-xs text-white/60">Cash-out your winnings</div>
        </div>

        <button
          onClick={() => void refreshWallet()}
          className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80"
        >
          Refresh
        </button>
      </div>

      {/* top banner like Blitz */}
      <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        <div className="bg-[linear-gradient(90deg,rgba(124,58,237,0.55),rgba(168,85,247,0.35))] px-4 py-3">
          {cash < MIN_W ? (
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">
                Balance is too low
                <div className="mt-1 text-xs font-normal text-white/80">
                  Win only {fmtUsd(Math.max(0, MIN_W - cash))} more to cash out!
                </div>
              </div>
              <Link
                href="/games"
                className="rounded-2xl bg-white px-4 py-2 text-xs font-extrabold text-black"
              >
                Play
              </Link>
            </div>
          ) : (
            <div className="text-sm font-semibold">
              You can withdraw now
              <div className="mt-1 text-xs font-normal text-white/80">Bonus cash will be forfeited on withdraw.</div>
            </div>
          )}
        </div>

        <div className="px-4 py-4">
          {loading ? (
            <div className="text-sm text-white/70">Loading…</div>
          ) : wallet ? (
            <div className="grid gap-3">
              <div className="rounded-3xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-white/70">Account Balance</div>
                    <div className="font-extrabold">{fmtUsd(accountBalance)}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-white/70">Bonus Cash</div>
                    <div className="font-bold">{fmtUsd(bonus)}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-white/70">Cash for Withdrawal</div>
                    <div className="font-extrabold">{fmtUsd(cash)}</div>
                  </div>
                </div>
              </div>

              {/* amount input */}
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-sm font-semibold">Amount to withdraw:</div>
                <div className="mt-3 rounded-3xl border border-white/10 bg-black/20 px-4 py-4">
                  <input
                    inputMode="decimal"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder="0"
                    className="w-full bg-transparent text-center text-3xl font-extrabold outline-none placeholder:text-white/20"
                  />
                </div>

                {/* inline validation (Blitz-like) */}
                <div className="mt-3 text-center text-xs">
                  {!amountStr ? (
                    <span className="text-white/55">Enter an amount between {fmtUsd(MIN_W)} and {fmtUsd(MAX_W)}</span>
                  ) : !Number.isFinite(amount) ? (
                    <span className="text-red-300">Invalid amount</span>
                  ) : amount > cash ? (
                    <span className="text-red-300">Withdrawable cash too low</span>
                  ) : amount < MIN_W ? (
                    <span className="text-red-300">Minimum withdrawal: {fmtUsd(MIN_W)}</span>
                  ) : amount > MAX_W ? (
                    <span className="text-red-300">Maximum withdrawal: {fmtUsd(MAX_W)}</span>
                  ) : (
                    <span className="text-emerald-200">Ready</span>
                  )}
                </div>

                {/* rules list */}
                <div className="mt-4 space-y-2 text-xs text-white/70">
                  <div className="flex gap-2">
                    <span className="mt-[2px]">⚠️</span>
                    <span>Minimum withdrawal: {fmtUsd(MIN_W)}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="mt-[2px]">⚠️</span>
                    <span>Maximum withdrawal: {fmtUsd(MAX_W)}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="mt-[2px]">📦</span>
                    <span>{fmtUsd(MONTHLY_LIMIT)} withdrawal limit per month</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="mt-[2px]">⏱️</span>
                    <span>Withdrawals usually take less than a week</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="mt-[2px]">❗</span>
                    <span className="font-semibold text-white/85">
                      All Bonus Cash is forfeited when withdrawing
                    </span>
                  </div>
                </div>
              </div>

              {/* messages */}
              {error ? (
                <div className="rounded-3xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              {toast ? (
                <div className="rounded-3xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  {toast}
                </div>
              ) : null}

              {/* confirm */}
              <button
                onClick={onSubmit}
                disabled={!canSubmit}
                className={
                  "mt-2 w-full rounded-3xl py-4 text-center text-base font-extrabold shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)] " +
                  (canSubmit
                    ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.82))] text-black"
                    : "bg-white/10 text-white/45")
                }
              >
                {submitting ? "Creating…" : "Confirm"}
              </button>

              <div className="pt-2 text-center">
                <Link href="/shop" className="text-xs font-semibold text-white/70 underline underline-offset-4">
                  Back to Shop
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-sm text-white/70">No wallet</div>
          )}
        </div>
      </div>
    </div>
  );
}
// ===== FILE END: apps/web/app/(public)/withdraw/page.tsx =====