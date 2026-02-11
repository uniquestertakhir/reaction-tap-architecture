import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_BASE = process.env.API_URL || "http://localhost:3001";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  // body optional (GameCanvas may send nothing)
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  try {
    const r = await fetch(`${API_BASE}/match/${encodeURIComponent(id)}/end`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: body ? JSON.stringify(body) : "{}",
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
