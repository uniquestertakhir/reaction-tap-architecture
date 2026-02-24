// ===== FILE START: apps/web/app/api/wallet/fund/route.ts =====
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getApiBase() {
  return (process.env.API_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
}

export async function POST(req: Request) {
  try {
    const apiBase = getApiBase();
    const body = await req.json().catch(() => ({}));

    const upstream = await fetch(`${apiBase}/wallet/fund`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });

    const data = await upstream.json().catch(() => null);

    return NextResponse.json(data ?? { ok: false, error: "bad_upstream_json" }, {
      status: upstream.status,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "proxy_error", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
// ===== FILE END: apps/web/app/api/wallet/fund/route.ts =====