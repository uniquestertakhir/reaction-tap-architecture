// ===== FILE START: apps/web/app/api/cashout/[id]/reject/route.ts =====
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE = (process.env.API_URL || "http://localhost:3001").replace(/\/+$/, "");

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const p: any = await Promise.resolve(ctx.params as any);
  const id = String(p?.id || "").trim();

  if (!id) return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // ✅ token can come from body or header or env
  const tokenFromBody = typeof body?.adminToken === "string" ? body.adminToken : "";
  const tokenFromHeader = req.headers.get("x-admin-token") || "";
  const tokenFromEnv = process.env.CASHOUT_ADMIN_TOKEN || "";
  const adminToken = String(tokenFromBody || tokenFromHeader || tokenFromEnv || "").trim();

  // do NOT pass adminToken upstream in JSON body
  const { adminToken: _drop, ...cleanBody } = (body ?? {}) as any;

  try {
    const r = await fetch(`${API_BASE}/cashout/${encodeURIComponent(id)}/reject`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(adminToken ? { "x-admin-token": adminToken } : {}),
      },
      cache: "no-store",
      body: JSON.stringify(cleanBody),
    });

    const text = await r.text();
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
// ===== FILE END: apps/web/app/api/cashout/[id]/reject/route.ts =====
