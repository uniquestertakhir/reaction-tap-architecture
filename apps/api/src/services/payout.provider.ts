// ===== FILE START: apps/api/src/services/payout.provider.ts =====
import type { Currency } from "./wallet.service.js";

export type PayoutResult =
  | { ok: true; payoutRef: string }
  | { ok: false; error: string };

export type PayoutInput = {
  cashoutId: string;
  playerId: string;
  amount: number;
  currency: Currency;
};

export interface PayoutProvider {
  createPayout(input: PayoutInput): Promise<PayoutResult>;
}

/**
 * MVP provider: just returns a reference, no real money movement.
 * Later you will replace with Stripe/Lemon/Crypto provider.
 */
class ManualPayoutProvider implements PayoutProvider {
  async createPayout(input: PayoutInput): Promise<PayoutResult> {
    // keep deterministic-ish and traceable
    return { ok: true, payoutRef: `manual_${input.cashoutId}_${Date.now()}` };
  }
}

export function getPayoutProvider(): PayoutProvider {
  const name = String(process.env.PAYOUT_PROVIDER || "manual").toLowerCase();

  // future: "stripe" | "lemon" | "crypto"
  switch (name) {
    case "manual":
    default:
      return new ManualPayoutProvider();
  }
}
// ===== FILE END: apps/api/src/services/payout.provider.ts =====
