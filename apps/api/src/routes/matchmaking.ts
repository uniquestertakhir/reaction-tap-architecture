// ===== FILE START: apps/api/src/routes/matchmaking.ts =====
import type { FastifyInstance } from "fastify";

// простая in-memory очередь (MVP). Для продакшена позже заменим на Redis/Postgres.
type QueueKey = string;

type WaitingItem = {
  key: QueueKey;
  matchId: string;
  createdAt: number;
  gameId: string;
  mode: string;
  currency: string; // "USD"
  entry: number;    // e.g. 0.3
};

const WAITING_BY_KEY = new Map<QueueKey, WaitingItem>();

function makeKey(params: { gameId: string; mode: string; currency: string; entry: number }) {
  const g = String(params.gameId || "").trim();
  const m = String(params.mode || "").trim().toLowerCase();
  const c = String(params.currency || "").trim().toUpperCase();
  const e = Number(params.entry || 0);
  return `${g}::${m}::${c}::${e}`;
}

function now() {
  return Date.now();
}

// чистим протухшие ожидания (чтобы очередь не зарастала)
function sweep(ttlMs = 2 * 60 * 1000) {
  const t = now();
  for (const [k, v] of WAITING_BY_KEY.entries()) {
    if (t - v.createdAt > ttlMs) WAITING_BY_KEY.delete(k);
  }
}

export async function registerMatchmakingRoutes(app: FastifyInstance) {
  // POST /matchmaking/join
  // body: { playerId, gameId, mode, currency, entry }
    // ===== INSERT START: GET /matchmaking/join (hint) =====
  app.get("/matchmaking/join", async (_req, reply) => {
    reply.code(405);
    return { ok: false, error: "method_not_allowed", hint: "Use POST /matchmaking/join" };
  });
  // ===== INSERT END: GET /matchmaking/join (hint) =====
  app.post("/matchmaking/join", async (req, reply) => {
    sweep();

    const body: any = (req.body as any) || {};
    const playerId = String(body.playerId || "").trim();
    const gameId = String(body.gameId || "reaction-tap").trim();
    const mode = String(body.mode || "").trim().toLowerCase();
    const currency = String(body.currency || "USD").trim().toUpperCase();
    const entry = Number(body.entry);

    if (!playerId) return reply.code(400).send({ ok: false, error: "missing_playerId" });
    if (!gameId) return reply.code(400).send({ ok: false, error: "missing_gameId" });
    if (!Number.isFinite(entry) || entry <= 0) return reply.code(400).send({ ok: false, error: "bad_entry" });
    if (currency !== "USD") return reply.code(400).send({ ok: false, error: "bad_currency" });

    const key = makeKey({ gameId, mode, currency, entry });

    // 1) если уже кто-то ждёт — берём его матч и присоединяем
    const waiting = WAITING_BY_KEY.get(key);
    if (waiting) {
      WAITING_BY_KEY.delete(key);

      // ✅ ставим ставку игрока в существующий матч
      // ВАЖНО: у тебя уже должен быть route stake на /match/:id/stake
      // Мы просто дергаем твою внутреннюю логику через inject, чтобы не дублировать код.
      const stakeRes = await app.inject({
        method: "POST",
        url: `/match/${encodeURIComponent(waiting.matchId)}/stake`,
        payload: { playerId, amount: entry, currency: "USD", gameId },
        headers: { "content-type": "application/json", accept: "application/json" },
      });

      const j: any = stakeRes.json();

      if (stakeRes.statusCode >= 400 || j?.ok === false) {
        return reply.code(500).send({
          ok: false,
          error: "stake_failed",
          reason: j?.error || j?.reason || String(stakeRes.statusCode),
        });
      }

      return reply.send({
        ok: true,
        action: "joined_existing",
        matchId: waiting.matchId,
        match: j?.match || null,
        wallet: j?.wallet || null,
      });
    }

    // 2) иначе — создаём матч и ставим ставку, кладём в ожидание
    const createRes = await app.inject({
      method: "POST",
      url: "/match/create",
      payload: { gameId },
      headers: { "content-type": "application/json", accept: "application/json" },
    });

    const created: any = createRes.json();

    const matchId = String(created?.match?.id || created?.id || "").trim();
    if (createRes.statusCode >= 400 || !matchId) {
      return reply.code(500).send({ ok: false, error: "create_match_failed" });
    }

    const stakeRes = await app.inject({
      method: "POST",
      url: `/match/${encodeURIComponent(matchId)}/stake`,
      payload: { playerId, amount: entry, currency: "USD", gameId },
      headers: { "content-type": "application/json", accept: "application/json" },
    });

    const j: any = stakeRes.json();

    if (stakeRes.statusCode >= 400 || j?.ok === false) {
      return reply.code(500).send({
        ok: false,
        error: "stake_failed_on_new_match",
        reason: j?.error || j?.reason || String(stakeRes.statusCode),
      });
    }

    WAITING_BY_KEY.set(key, {
      key,
      matchId,
      createdAt: now(),
      gameId,
      mode,
      currency,
      entry,
    });

    return reply.send({
      ok: true,
      action: "created_waiting",
      matchId,
      match: j?.match || null,
      wallet: j?.wallet || null,
    });
  });

  // POST /matchmaking/cancel
  // body: { gameId, mode, currency, entry, matchId }
  app.post("/matchmaking/cancel", async (req, reply) => {
    sweep();
    const body: any = (req.body as any) || {};
    const gameId = String(body.gameId || "reaction-tap").trim();
    const mode = String(body.mode || "").trim().toLowerCase();
    const currency = String(body.currency || "USD").trim().toUpperCase();
    const entry = Number(body.entry);
    const matchId = String(body.matchId || "").trim();

    if (!Number.isFinite(entry) || entry <= 0) return reply.code(400).send({ ok: false, error: "bad_entry" });
    if (!matchId) return reply.code(400).send({ ok: false, error: "missing_matchId" });

    const key = makeKey({ gameId, mode, currency, entry });
    const waiting = WAITING_BY_KEY.get(key);
    if (waiting && waiting.matchId === matchId) {
      WAITING_BY_KEY.delete(key);
      return reply.send({ ok: true, removed: true });
    }
    return reply.send({ ok: true, removed: false });
  });
}
// ===== FILE END: apps/api/src/routes/matchmaking.ts =====