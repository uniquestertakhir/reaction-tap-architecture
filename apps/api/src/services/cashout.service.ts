// ===== FILE START: apps/api/src/services/cashout.service.ts =====
import { getWallet, holdFunds, releaseHold, captureHold, type Currency } from "./wallet.service.js";
import { getPayoutProvider } from "./payout.provider.js";

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";




export type CashoutStatus = "pending" | "approved" | "rejected";

export type CashoutRequest = {
  id: string;
  playerId: string;
  amount: number;
  currency: Currency;

  status: CashoutStatus;
  createdAt: number;

  decidedAt?: number;
  decidedBy?: string;
  note?: string;

  // ✅ future-proof: external payout reference (stripe transfer id, crypto tx hash, etc.)
  payoutRef?: string;
};

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error: string };

const cashouts = new Map<string, CashoutRequest>();

// ===== INSERT START: cashout persistence (DEV file) =====
const DATA_DIR = path.resolve(process.cwd(), "data");
const CASHOUTS_FILE = path.join(DATA_DIR, "cashouts.json");

async function loadCashoutsFromDisk() {
  try {
    const raw = await readFile(CASHOUTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : parsed?.items;

    if (Array.isArray(items)) {
      cashouts.clear();
      for (const it of items) {
        if (it && typeof it.id === "string") cashouts.set(it.id, it as CashoutRequest);
      }
    }
  } catch {
    // ok: file not found on first run
  }
}

async function saveCashoutsToDisk() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const items = Array.from(cashouts.values());
    await writeFile(CASHOUTS_FILE, JSON.stringify({ items }, null, 2), "utf8");
  } catch {
    // dev-friendly: ignore disk errors
  }
}

// fire and forget init
void loadCashoutsFromDisk();
// ===== INSERT END: cashout persistence (DEV file) =====


function uuid() {
  const g: any = globalThis as any;
  if (g.crypto && typeof g.crypto.randomUUID === "function") return g.crypto.randomUUID();
  return `c_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function normCurrency(v: any): Currency | null {
  const c = String(v || "").toUpperCase();
  if (c === "USD") return "USD";
  return null;
}

/**
 * ---- admin token (optional) ----
 * Use ONE env var everywhere:
 *   CASHOUT_ADMIN_TOKEN
 */
export function checkCashoutAdminToken(token?: string): Ok<{}> | Err {
  const need = String(process.env.CASHOUT_ADMIN_TOKEN || "").trim();

  // if not configured -> allow (dev-friendly)
  if (!need) return { ok: true };

  const got = String(token || "").trim();
  if (!got) return { ok: false, error: "forbidden" };
  if (got !== need) return { ok: false, error: "forbidden" };

  return { ok: true };
}

/**
 * createCashout:
 * - ✅ moves money from balances -> held (freeze)
 * - creates a pending cashout request
 */
export function createCashout(
  playerId: string,
  amount: number,
  currency: Currency | string
): Ok<{ request: CashoutRequest; wallet: ReturnType<typeof getWallet> }> | Err {
  const pid = String(playerId || "").trim();
  const cur = normCurrency(currency);
  const amt = Number(amount);

  if (!pid) return { ok: false, error: "bad_playerId" };
  if (!cur) return { ok: false, error: "bad_currency" };
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, error: "bad_amount" };

  const h = holdFunds(pid, amt, cur);
  if (!h.ok) return { ok: false, error: h.error };

  const req: CashoutRequest = {
    id: uuid(),
    playerId: pid,
    amount: h.amount,
    currency: h.currency,
    status: "pending",
    createdAt: Date.now(),
  };

   cashouts.set(req.id, req);
  void saveCashoutsToDisk();

  const wallet = getWallet(pid);
  return { ok: true, request: req, wallet };

}

export function listCashouts(opts?: { playerId?: string; limit?: number }): CashoutRequest[] {
  const pid = String(opts?.playerId || "").trim();
  const lim = Math.max(1, Math.min(500, Number(opts?.limit || 50)));

  const all = Array.from(cashouts.values())
    .filter((x) => (pid ? x.playerId === pid : true))
    .sort((a, b) => b.createdAt - a.createdAt);

  return all.slice(0, lim);
}

/**
 * approveCashout:
 * - ✅ here we would call external payout provider (Stripe/Lemon/crypto/manual)
 * - ✅ then captureHold => money leaves the internal system
 */
export async function approveCashout(
  id: string,
  decidedBy = "admin"
): Promise<Ok<{ request: CashoutRequest; wallet: ReturnType<typeof getWallet> | null }> | Err> {

  const cid = String(id || "").trim();
  if (!cid) return { ok: false, error: "bad_id" };

  const req = cashouts.get(cid);
  if (!req) return { ok: false, error: "not_found" };
  if (req.status !== "pending") return { ok: false, error: "already_decided" };

    // ✅ external payout (MVP = manual provider, later Stripe/Lemon/Crypto)
  const provider = getPayoutProvider();
  const pr = await provider.createPayout({
    cashoutId: req.id,
    playerId: req.playerId,
    amount: req.amount,
    currency: req.currency,
  });
  if (!pr.ok) return { ok: false, error: pr.error };
  const payoutRef = pr.payoutRef;


  const cap = captureHold(req.playerId, req.amount, req.currency);
  if (!cap.ok) return { ok: false, error: cap.error };

  req.status = "approved";
  req.decidedAt = Date.now();
  req.decidedBy = decidedBy;
  req.payoutRef = payoutRef;

    cashouts.set(req.id, req);
  void saveCashoutsToDisk();

  return { ok: true, request: req, wallet: getWallet(req.playerId) };

}

/**
 * rejectCashout:
 * - ✅ releaseHold => held back to balances
 */
export function rejectCashout(
  id: string,
  note?: string,
  decidedBy = "admin"
): Ok<{ request: CashoutRequest; wallet: ReturnType<typeof getWallet> | null }> | Err {
  const cid = String(id || "").trim();
  if (!cid) return { ok: false, error: "bad_id" };

  const req = cashouts.get(cid);
  if (!req) return { ok: false, error: "not_found" };
  if (req.status !== "pending") return { ok: false, error: "already_decided" };

  const rel = releaseHold(req.playerId, req.amount, req.currency);
  if (!rel.ok) return { ok: false, error: rel.error };

  req.status = "rejected";
  req.decidedAt = Date.now();
  req.decidedBy = decidedBy;
  req.note = note;

    cashouts.set(req.id, req);
  void saveCashoutsToDisk();

  return { ok: true, request: req, wallet: getWallet(req.playerId) };

}

/**
 * resetCashouts (DEV):
 * - clears in-memory cashout requests
 * - useful when you spam clicks in UI and want a clean slate
 */
export function resetCashouts(): Ok<{ cleared: number }> {
  const cleared = cashouts.size;
    cashouts.clear();
  void saveCashoutsToDisk();
  return { ok: true, cleared };

}

// ===== FILE END: apps/api/src/services/cashout.service.ts =====
