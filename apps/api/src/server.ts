// ===== FILE START: apps/api/src/server.ts =====
import Fastify from "fastify";

import { verifyRun, storeVerifiedRun, getRunsByMatch, getBestScoreByMatch, getBestRunByMatch } from "./services/game.service.js";
import { createMatch, getMatch, startMatch, endMatch, placeStake } from "./services/match.service.js";
import { fundWallet, getWallet, takeFromWallet } from "./services/wallet.service.js";
import {
  createCashout,
  listCashouts,
  approveCashout,
  rejectCashout,
  resetCashouts,
  checkCashoutAdminToken,
} from "./services/cashout.service.js";






console.log("BOOT SERVER FILE:", import.meta.url);

// timers for auto-ending matches (in-memory)
const matchEndTimers = new Map<string, any>();


async function main() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ ok: true }));


   // ---- wallet ----
  app.post("/wallet/fund", async (req, reply) => {
  // ✅ DEV ONLY: never allow funding in production
  const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  if (isProd) {
    reply.code(403);
    return { ok: false, error: "forbidden" };
  }

  const body = (req.body ?? {}) as any;
  const playerId = String(body?.playerId || "").trim();
  const amount = Number(body?.amount || 0);
  const currency = String(body?.currency || "USD").toUpperCase();

  if (!playerId) return { ok: false, error: "bad_playerId" };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "bad_amount" };
  if (currency !== "USD") return { ok: false, error: "bad_currency" };

  const wallet = fundWallet(playerId, amount, currency);
  return { ok: true, playerId, currency, balance: wallet.balances[currency] ?? 0, wallet };
});

// ===== INSERT START: GET /wallet/:playerId =====
app.get<{ Params: { playerId: string } }>("/wallet/:playerId", async (req) => {
  const playerId = String(req.params.playerId || "").trim();
  if (!playerId) return { ok: false, error: "bad_playerId" };
  const wallet = getWallet(playerId);
  return { ok: true, wallet };
});
// ===== INSERT END: GET /wallet/:playerId =====


  // ---- cashout (withdraw pipeline) ----
  // /wallet/withdraw -> creates pending cashout request + deducts wallet (inside createCashout)
  app.post("/wallet/withdraw", async (req, reply) => {
    const body = (req.body ?? {}) as any;
    const playerId = String(body?.playerId || "").trim();
    const amount = Number(body?.amount || 0);
    const currency = String(body?.currency || "USD").toUpperCase();

    const r = createCashout(playerId, amount, currency);
    if (!r.ok) {
      reply.code(r.error === "insufficient_funds" ? 409 : 400);
      return { ok: false, error: r.error };
    }

    // ✅ возвращаем созданную заявку + актуальный кошелёк
    return { ok: true, request: r.request, wallet: r.wallet };
  });

  // optional alias: explicit create
  app.post("/cashout/create", async (req, reply) => {
    const body = (req.body ?? {}) as any;
    const playerId = String(body?.playerId || "").trim();
    const amount = Number(body?.amount || 0);
    const currency = String(body?.currency || "USD").toUpperCase();

    const r = createCashout(playerId, amount, currency);
    if (!r.ok) {
      reply.code(r.error === "insufficient_funds" ? 409 : 400);
      return { ok: false, error: r.error };
    }

    return { ok: true, request: r.request, wallet: r.wallet };
  });

     app.get("/cashout/list", async (req) => {
    const q = (req.query ?? {}) as any;
    const playerId = String(q?.playerId || "").trim();
    const limit = Number(q?.limit || 50);
    const items = listCashouts({ playerId: playerId || undefined, limit });
    return { ok: true, items };
  });

  // ✅ DEV: reset all cashouts (in-memory only)
app.post("/cashout/reset", async (req, reply) => {
  // ✅ optional admin guard (single source of truth)
  const got = String((req.headers as any)["x-admin-token"] || "").trim();
  const guard = checkCashoutAdminToken(got);
  if (!guard.ok) {
    reply.code(401);
    return { ok: false, error: "unauthorized" };
  }

  const r = resetCashouts();
  return { ok: true, cleared: (r as any).cleared ?? 0 };
});


  app.post<{ Params: { id: string } }>("/cashout/:id/approve", async (req, reply) => {
    // ✅ optional admin guard (single source of truth)
    const got = String((req.headers as any)["x-admin-token"] || "").trim();
    const guard = checkCashoutAdminToken(got);
    if (!guard.ok) {
      reply.code(401);
      return { ok: false, error: "unauthorized" };
    }

    const id = String((req.params as any)?.id || "").trim();

    const r = await approveCashout(id);
    if (!r.ok) {
      reply.code(r.error === "not_found" ? 404 : 409);
      return { ok: false, error: r.error };
    }

    return { ok: true, request: r.request, wallet: r.wallet };
  });

  app.post<{ Params: { id: string } }>("/cashout/:id/reject", async (req, reply) => {
    // ✅ optional admin guard (single source of truth)
    const got = String((req.headers as any)["x-admin-token"] || "").trim();
    const guard = checkCashoutAdminToken(got);
    if (!guard.ok) {
      reply.code(401);
      return { ok: false, error: "unauthorized" };
    }

    const id = String((req.params as any)?.id || "").trim();
    const body = (req.body ?? {}) as any;
    const note = body?.note ? String(body.note) : undefined;

    const r = await rejectCashout(id, note);
    if (!r.ok) {
      reply.code(r.error === "not_found" ? 404 : 409);
      return { ok: false, error: r.error };
    }

    return { ok: true, request: r.request, wallet: r.wallet };
  });





  // ---- match ----
  app.post("/match/create", async (req) => {
    const body = (req.body ?? {}) as any;
    const gameId = typeof body?.gameId === "string" ? body.gameId : "reaction-tap";
    const match = createMatch({ gameId, currency: "USD" });
    return { match };
  });

  app.get<{ Params: { id: string } }>("/match/:id", async (req) => {
    const id = req.params.id;
    const match = getMatch(id);
    if (!match) return { error: "not_found" };

    // finalize if ended but missing winner score (safety)
    if (match.status === "ended" && typeof match.serverScore !== "number") {
      const best = getBestRunByMatch(id);
      if (best) {
        const m2 = endMatch(id, {
          serverScore: best.serverScore,
          winnerRunId: best.id,
          winnerPlayerId: best.playerId,
        });
        if (m2) return { match: m2 };
      }
    }

    return { match };
  });

  // ✅ stake: takes money from wallet -> escrow
  app.post<{ Params: { id: string } }>("/match/:id/stake", async (req, reply) => {
    const id = req.params.id;
    const m = getMatch(id);
    if (!m) {
      reply.code(404);
      return { ok: false, error: "not_found" };
    }
    if (m.status !== "created") {
      reply.code(409);
      return { ok: false, error: "match_not_accepting_stakes", match: m };
    }

    const body = (req.body ?? {}) as any;
    const playerId = String(body?.playerId || "").trim();
    const amount = Number(body?.amount || 0);
    const currency = String(body?.currency || "USD").toUpperCase();

    if (!playerId) {
      reply.code(400);
      return { ok: false, error: "bad_playerId" };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      reply.code(400);
      return { ok: false, error: "bad_amount" };
    }
    if (currency !== "USD") {
      reply.code(400);
      return { ok: false, error: "bad_currency" };
    }

    // ✅ take from wallet
    const ok = takeFromWallet(playerId, amount, currency);
    if (!ok) {
      reply.code(409);
      return { ok: false, error: "insufficient_funds" };
    }

    const match = placeStake(id, playerId, amount);
    const wallet = getWallet(playerId);

    return { ok: true, match, wallet };
  });

    app.post<{ Params: { id: string } }>("/match/:id/start", async (req, reply) => {
    const id = req.params.id;
    const res = startMatch(id);

    if (!res.ok) {
      if (res.reason === "not_found") {
        reply.code(404);
        return { error: "not_found" };
      }
      if (res.reason === "ended") {
        reply.code(409);
        return { error: "match_ended", match: res.match ?? null };
      }
      if (res.reason === "escrow_not_ready") {
        reply.code(409);
        return { error: "escrow_not_ready", match: res.match, details: (res as any).details };
      }

      reply.code(409);
      return { error: "cannot_start", match: (res as any).match ?? null };
    }

    // ✅ auto-end timer: only schedule when match just started
    if (!res.alreadyStarted) {
      // clear previous timer if any (safety)
      const prev = matchEndTimers.get(id);
      if (prev) {
        clearTimeout(prev);
        matchEndTimers.delete(id);
      }

      const ms = Number(res.match?.durationMs || 30_000);
      const t = setTimeout(() => {
        try {
          const m = getMatch(id);
          if (!m || m.status === "ended") return;

          const best = getBestRunByMatch(id);
          if (!best) {
            // no runs -> just end with serverScore 0 (winner unknown)
            endMatch(id, { serverScore: 0, winnerRunId: "none", winnerPlayerId: "none" });
            return;
          }

          endMatch(id, {
            serverScore: best.serverScore,
            winnerRunId: best.id,
            winnerPlayerId: best.playerId,
          });
        } catch (e) {
          app.log.error({ err: e }, "auto-end failed");
        } finally {
          matchEndTimers.delete(id);
        }
      }, Math.max(1000, ms + 250));

      matchEndTimers.set(id, t);
    }

    return { match: res.match, alreadyStarted: !!res.alreadyStarted };
  });


      // ✅ end: finalize match using best verified run (idempotent + always returns payout/winnerWallet)
  app.post<{ Params: { id: string } }>("/match/:id/end", async (req, reply) => {
    const id = req.params.id;
    const m = getMatch(id);

    if (!m) {
      reply.code(404);
      return { ok: false, error: "not_found" };
    }

    // stop auto-end timer if exists
    const t = matchEndTimers.get(id);
    if (t) {
      clearTimeout(t);
      matchEndTimers.delete(id);
    }

    // already ended -> still return payout + winnerWallet
    if (m.status === "ended") {
      const winnerId = String(m.paidOutTo || m.winnerPlayerId || "").trim();
      const amount = Number(m.paidOutAmount ?? m.escrowTotal ?? 0);
      const payout =
        winnerId && Number.isFinite(amount) && amount > 0
          ? { playerId: winnerId, amount, currency: "USD" }
          : null;

      const winnerWallet = winnerId ? getWallet(winnerId) : null;

      return { ok: true, match: m, alreadyEnded: true, payout, winnerWallet };
    }

    const best = getBestRunByMatch(id);
    if (!best) {
      reply.code(409);
      return { ok: false, error: "no_verified_runs" };
    }

    // ✅ endMatch() does payout ONCE (idempotent) inside match.service.ts
    const m2 = endMatch(id, {
      serverScore: best.serverScore,
      winnerRunId: best.id,
      winnerPlayerId: best.playerId,
    });

    if (!m2) {
      reply.code(500);
      return { ok: false, error: "end_failed" };
    }

    const winnerId = String(m2.paidOutTo || m2.winnerPlayerId || "").trim();
    const amount = Number(m2.paidOutAmount ?? m2.escrowTotal ?? 0);
    const payout =
      winnerId && Number.isFinite(amount) && amount > 0
        ? { playerId: winnerId, amount, currency: "USD" }
        : null;

    const winnerWallet = winnerId ? getWallet(winnerId) : null;

    return {
      ok: true,
      match: m2,
      payout,
      winnerWallet,
      winner: { playerId: best.playerId, runId: best.id, serverScore: best.serverScore },
    };
  });



  // ---- runs ----
  app.get<{ Params: { id: string } }>("/match/:id/runs", async (req) => {
    const id = req.params.id;
    const items = getRunsByMatch(id, 50);
    return { items };
  });

  // ---- verify ----
  app.post("/run/verify", async (req, reply) => {
    const body = (req.body ?? {}) as any;

    const matchIdStr = typeof body?.matchId === "string" ? String(body.matchId) : null;
    if (matchIdStr) {
      const m = getMatch(matchIdStr);
      if (!m) {
        reply.code(404);
        return { verified: false, reason: "match_not_found" };
      }
      if (m.status === "ended") {
        reply.code(409);
        return { verified: false, reason: "match_ended", match: m };
      }
            // ✅ only staked players can submit verified runs for this match
      const pid = String(body?.playerId || "").trim();
      const stake = Number((m.stakes || {})[pid] || 0);
      if (!pid || !Number.isFinite(stake) || stake <= 0) {
        reply.code(409);
        return { verified: false, reason: "player_not_staked", match: m };
      }

    }

    const vr = verifyRun(body);
    if (!vr.ok) {
      reply.code(400);
      return { verified: false, reason: vr.reason };
    }

    const stored = storeVerifiedRun(body, vr.serverScore);
    const mid = typeof (stored as any).matchId === "string" ? String((stored as any).matchId) : null;

    return {
      verified: true,
      serverScore: vr.serverScore,
      runId: stored.id,
      playerId: (stored as any).playerId ?? null,
      matchId: (stored as any).matchId ?? null,
      run: stored,
      best: mid ? getBestRunByMatch(mid) : null,
    };
  });

  const port = Number(process.env.PORT || 3001);
  await app.listen({ port, host: "0.0.0.0" });
}

main();


// ===== FILE END: apps/api/src/server.ts =====
