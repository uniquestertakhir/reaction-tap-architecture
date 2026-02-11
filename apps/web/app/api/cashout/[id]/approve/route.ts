// ===== FILE START: apps/web/app/api/cashout/[id]/approve/route.ts =====
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE = (process.env.API_URL || "http://localhost:3001").replace(/\/+$/, "");

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const p: any = await Promise.resolve(ctx.params as any);
  const id = String(p?.id || "").trim();

  if (!id) {
    return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  }

  // ✅ token can come from body or header or env
  let adminToken = "";
  try {
    const raw = await req.text().catch(() => "");
    if (raw && raw.trim()) {
      try {
        const j = JSON.parse(raw);
        if (typeof j?.adminToken === "string") adminToken = j.adminToken;
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  const tokenFromHeader = req.headers.get("x-admin-token") || "";
  const tokenFromEnv = process.env.CASHOUT_ADMIN_TOKEN || "";
  adminToken = String(adminToken || tokenFromHeader || tokenFromEnv || "").trim();

  try {
    const r = await fetch(`${API_BASE}/cashout/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      headers: {
        accept: "application/json",
        ...(adminToken ? { "x-admin-token": adminToken } : {}),
      },
      cache: "no-store",
      body: "{}", // upstream body not needed
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
// ===== FILE END: apps/web/app/api/cashout/[id]/approve/route.ts =====
