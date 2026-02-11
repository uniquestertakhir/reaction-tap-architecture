// ===== FILE START: apps/api/src/app.ts =====
import Fastify, { type FastifyInstance } from "fastify";

import {
  verifyRun,
  storeVerifiedRun,
  getRunsByMatch,
  getBestRunByMatch,
} from "./services/game.service.js";

import {
  createMatch,
  getMatch,
  startMatch,
  endMatch,
} from "./services/match.service.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ ok: true }));

  // ---- match ----
  app.post("/match/create", async () => {
    const match = createMatch();
    return { match };
  });

  app.get<{ Params: { id: string } }>("/match/:id", async (req) => {
    const id = req.params.id;
    const match = getMatch(id);
    if (!match) return { error: "not_found" };
    return { match };
  });

  app.post<{ Params: { id: string } }>("/match/:id/start", async (req, reply) => {
    const res = startMatch(req.params.id);

    if (!res.ok) {
      if (res.reason === "not_found") {
        reply.code(404);
        return { error: "not_found" };
      }
      reply.code(409);
      return { error: "match_ended", match: res.match ?? null };
    }

    return { match: res.match, alreadyStarted: !!res.alreadyStarted };
  });

  // finalize winner (allowed only when match already ended)
  app.post<{ Params: { id: string } }>("/match/:id/end", async (req, reply) => {
    const id = req.params.id;

    const m = getMatch(id);
    if (!m) {
      reply.code(404);
      return { error: "not_found" };
    }
    if (m.status !== "ended") {
      reply.code(409);
      return { error: "match_not_ended_yet", match: m };
    }

    const bestRun = getBestRunByMatch(id);
    if (!bestRun) {
      reply.code(409);
      return { error: "no_runs_yet" };
    }

    const match = endMatch(id, {
      serverScore: bestRun.serverScore,
      winnerRunId: bestRun.id,
      winnerPlayerId: bestRun.playerId,
    });

    return {
      match,
      bestScore: bestRun.serverScore,
      bestRunId: bestRun.id,
      bestPlayerId: bestRun.playerId,
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

  return app;
}
// ===== FILE END: apps/api/src/app.ts =====
