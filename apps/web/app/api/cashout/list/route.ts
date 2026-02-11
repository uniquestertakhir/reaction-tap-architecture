// ===== FILE START: apps/web/app/api/cashout/list/route.ts =====
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE = (process.env.API_URL || "http://localhost:3001").replace(/\/+$/, "");

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const playerId = (url.searchParams.get("playerId") || "").trim();
    const limit = (url.searchParams.get("limit") || "").trim();

    const qs = new URLSearchParams();
    if (playerId) qs.set("playerId", playerId);
    if (limit) qs.set("limit", limit);

    const target = `${API_BASE}/cashout/list${qs.toString() ? `?${qs.toString()}` : ""}`;

    const r = await fetch(target, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    const text = await r.text();

    // Fastify отдаёт JSON, но на всякий случай подстрахуемся
    try {
      const json = text ? JSON.parse(text) : null;
      return NextResponse.json(json, { status: r.status });
    } catch {
      return new NextResponse(text, { status: r.status });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "proxy_error" }, { status: 502 });
  }
}
// ===== FILE END: apps/web/app/api/cashout/list/route.ts =====
