// ===== FILE START: apps/web/app/api/cashout/reset/route.ts =====
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = (process.env.API_URL || "http://localhost:3001").replace(/\/+$/, "");

export async function POST(req: Request) {
  try {
    const rawText = await req.text().catch(() => "{}");

    // 1) adminToken can come from body (preferred) or header or env
    let bodyObj: any = null;
    try {
      bodyObj = rawText && rawText.trim() ? JSON.parse(rawText) : {};
    } catch {
      bodyObj = {};
    }

    const tokenFromBody = typeof bodyObj?.adminToken === "string" ? bodyObj.adminToken : "";
    const tokenFromHeader = req.headers.get("x-admin-token") || "";
    const tokenFromEnv = process.env.CASHOUT_ADMIN_TOKEN || "";

    const adminToken = (tokenFromBody || tokenFromHeader || tokenFromEnv || "").trim();

    const upstream = await fetch(`${API_BASE}/cashout/reset`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(adminToken ? { "x-admin-token": adminToken } : {}),
      },
      body: "{}",
      cache: "no-store",
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") || "application/json" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "proxy_failed", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
// ===== FILE END: apps/web/app/api/cashout/reset/route.ts =====
