// ===== FILE START: apps/web/app/api/leaderboard/top/route.ts =====
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const base = process.env.API_BASE_URL || "http://localhost:3001";

    const r = await fetch(`${base}/leaderboard/top`, { cache: "no-store" });
    const text = await r.text();

    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!r.ok) {
      return NextResponse.json(
        { items: [], error: "api_error", status: r.status, body: data ?? text ?? "" },
        { status: 200 }
      );
    }

    return NextResponse.json(data ?? { items: [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { items: [], error: "proxy_error", message: String(e?.message || e) },
      { status: 200 }
    );
  }
}
// ===== FILE END: apps/web/app/api/leaderboard/top/route.ts =====
