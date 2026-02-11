// ===== FILE START: apps/web/app/api/match/[id]/stake/route.ts =====
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_BASE = process.env.API_URL || "http://localhost:3001";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  try {
    const r = await fetch(`${API_BASE}/match/${encodeURIComponent(id)}/stake`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body), // ✅ stringify ТОЛЬКО 1 раз
      cache: "no-store",
    });

    const text = await r.text();
    let j: any = null;
    try {
      j = text ? JSON.parse(text) : null;
    } catch {
      j = null;
    }

    return NextResponse.json(
      j ?? { ok: false, error: "bad_api_response" },
      { status: r.status }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "api_unreachable" }, { status: 502 });
  }
}
// ===== FILE END: apps/web/app/api/match/[id]/stake/route.ts =====
