// ===== FILE START: apps/web/app/api/wallet/withdraw/route.ts =====
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_BASE = process.env.API_URL || "http://localhost:3001";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  try {
    const r = await fetch(`${API_BASE}/wallet/withdraw`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await r.text();
    try {
      return NextResponse.json(JSON.parse(text), { status: r.status });
    } catch {
      return new NextResponse(text, { status: r.status });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "api_unreachable" }, { status: 502 });
  }
}
// ===== FILE END: apps/web/app/api/wallet/withdraw/route.ts =====
