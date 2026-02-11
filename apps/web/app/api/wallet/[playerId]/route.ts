// ===== FILE START: apps/web/app/api/wallet/[playerId]/route.ts =====
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_BASE = process.env.API_URL || "http://localhost:3001";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await ctx.params;
  const pid = String(playerId || "").trim();
  if (!pid) {
    return NextResponse.json({ ok: false, error: "bad_playerId" }, { status: 400 });
  }

  try {
    const r = await fetch(`${API_BASE}/wallet/${encodeURIComponent(pid)}`, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    const text = await r.text();
    let j: any = null;
    try {
      j = text ? JSON.parse(text) : null;
    } catch {
      j = null;
    }

    return NextResponse.json(j ?? { ok: false, error: "bad_api_response" }, { status: r.status });
  } catch {
    return NextResponse.json({ ok: false, error: "api_unreachable" }, { status: 502 });
  }
}
// ===== FILE END: apps/web/app/api/wallet/[playerId]/route.ts =====
