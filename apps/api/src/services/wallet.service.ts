// ===== FILE START: apps/api/src/services/wallet.service.ts =====
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type Currency = "USD";

export type Wallet = {
  playerId: string;

  /** available (can be staked / withdrawn request) */
  balances: Record<string, number>; // e.g. { "USD": 50 }

  /** held (frozen for pending cashout) */
  held: Record<string, number>; // e.g. { "USD": 10 }
};

// in-memory wallet store
const wallets = new Map<string, Wallet>();

// ===== INSERT START: wallet persistence (DEV file) =====
const DATA_DIR = path.resolve(process.cwd(), "data");
const WALLETS_FILE = path.join(DATA_DIR, "wallets.json");

async function loadWalletsFromDisk() {
  try {
    const raw = await readFile(WALLETS_FILE, "utf8");
    const parsed = JSON.parse(raw);

    const items = Array.isArray(parsed)
      ? parsed
      : parsed?.items;

    if (Array.isArray(items)) {
      wallets.clear();
      for (const w of items) {
        if (w?.playerId) {
          wallets.set(w.playerId, w);
        }
      }
    }
  } catch {
    // first run — ok
  }
}

async function saveWalletsToDisk() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const items = Array.from(wallets.values());
    await writeFile(
      WALLETS_FILE,
      JSON.stringify({ items }, null, 2),
      "utf8"
    );
  } catch {
    // dev: ignore
  }
}

void loadWalletsFromDisk();
// ===== INSERT END: wallet persistence (DEV file) =====


function normCurrency(v: any): Currency | null {
  const c = String(v || "").toUpperCase();
  if (c === "USD") return "USD";
  return null;
}

function ensureWallet(playerId: string): Wallet {
  let w = wallets.get(playerId);
  if (!w) {
    w = { playerId, balances: {}, held: {} };
    wallets.set(playerId, w);
    void saveWalletsToDisk(); // ✅ persist new wallet
  }
  if (!w.balances) w.balances = {};
  if (!w.held) w.held = {};
  return w;
}


export function getWallet(playerId: string): Wallet {
  const pid = String(playerId || "").trim();
  return ensureWallet(pid);
}

export function fundWallet(playerId: string, amount: number, currency: Currency | string): Wallet {
  const pid = String(playerId || "").trim();
  const cur = normCurrency(currency) ?? "USD";
  const amt = Number(amount);

  const w = ensureWallet(pid);
  const prev = Number(w.balances[cur] || 0);
  const next = prev + (Number.isFinite(amt) && amt > 0 ? amt : 0);

  w.balances[cur] = next;
  void saveWalletsToDisk(); // ✅ persist

  return w;
}


/**
 * takeFromWallet:
 * - moves money from available (balances)
 * - returns false if insufficient
 */
export function takeFromWallet(playerId: string, amount: number, currency: Currency | string): boolean {
  const pid = String(playerId || "").trim();
  const cur = normCurrency(currency);
  const amt = Number(amount);

  if (!pid) return false;
  if (!cur) return false;
  if (!Number.isFinite(amt) || amt <= 0) return false;

  const w = ensureWallet(pid);
  const bal = Number(w.balances[cur] || 0);

  if (bal < amt) return false;

  w.balances[cur] = bal - amt;
  void saveWalletsToDisk(); // ✅ persist

  return true;
}


/**
 * holdFunds:
 * - moves money from balances -> held (freeze for pending cashout)
 */
export function holdFunds(
  playerId: string,
  amount: number,
  currency: Currency | string
): { ok: true; amount: number; currency: Currency } | { ok: false; error: string } {
  const pid = String(playerId || "").trim();
  const cur = normCurrency(currency);
  const amt = Number(amount);

  if (!pid) return { ok: false, error: "bad_playerId" };
  if (!cur) return { ok: false, error: "bad_currency" };
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, error: "bad_amount" };

  const w = ensureWallet(pid);
  const bal = Number(w.balances[cur] || 0);

  if (bal < amt) return { ok: false, error: "insufficient_funds" };

  w.balances[cur] = bal - amt;
  w.held[cur] = Number(w.held[cur] || 0) + amt;

  void saveWalletsToDisk(); // ✅ persist

  return { ok: true, amount: amt, currency: cur };
}


/**
 * releaseHold:
 * - moves money from held -> balances (when cashout rejected/canceled)
 */
export function releaseHold(
  playerId: string,
  amount: number,
  currency: Currency | string
): { ok: true; amount: number; currency: Currency } | { ok: false; error: string } {
  const pid = String(playerId || "").trim();
  const cur = normCurrency(currency);
  const amt = Number(amount);

  if (!pid) return { ok: false, error: "bad_playerId" };
  if (!cur) return { ok: false, error: "bad_currency" };
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, error: "bad_amount" };

  const w = ensureWallet(pid);
  const h = Number(w.held[cur] || 0);

  if (h < amt) return { ok: false, error: "insufficient_held" };

  w.held[cur] = h - amt;
  w.balances[cur] = Number(w.balances[cur] || 0) + amt;

  void saveWalletsToDisk(); // ✅ persist

  return { ok: true, amount: amt, currency: cur };
}


/**
 * captureHold:
 * - finalizes cashout: money leaves the system (held decreases)
 */
export function captureHold(
  playerId: string,
  amount: number,
  currency: Currency | string
): { ok: true; amount: number; currency: Currency } | { ok: false; error: string } {
  const pid = String(playerId || "").trim();
  const cur = normCurrency(currency);
  const amt = Number(amount);

  if (!pid) return { ok: false, error: "bad_playerId" };
  if (!cur) return { ok: false, error: "bad_currency" };
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, error: "bad_amount" };

  const w = ensureWallet(pid);
  const h = Number(w.held[cur] || 0);

  if (h < amt) return { ok: false, error: "insufficient_held" };

  w.held[cur] = h - amt;

  void saveWalletsToDisk(); // ✅ persist

  return { ok: true, amount: amt, currency: cur };
}


// ===== ADD BLOCK START: withdrawFromWallet =====
export function withdrawFromWallet(
  playerId: string,
  amount: number,
  currency: Currency | string
): { ok: true; amount: number; currency: Currency } | { ok: false; error: string } {

  const pid = String(playerId || "").trim();
  const cur = normCurrency(currency);
  const amt = Number(amount);

  if (!pid) return { ok: false, error: "bad_playerId" };
  if (!cur) return { ok: false, error: "bad_currency" };
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, error: "bad_amount" };

  const w = ensureWallet(pid);
  const bal = Number(w.balances[cur] || 0);

  if (bal < amt) return { ok: false, error: "insufficient_funds" };

  w.balances[cur] = bal - amt;

  void saveWalletsToDisk(); // ✅ persist

  return { ok: true, amount: amt, currency: cur };
}

// ===== ADD BLOCK END: withdrawFromWallet =====


// ===== FILE END: apps/api/src/services/wallet.service.ts =====
