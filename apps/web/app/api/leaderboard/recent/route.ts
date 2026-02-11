// ===== FILE START: apps/web/app/api/leaderboard/recent/route.ts =====
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = process.env.API_BASE || "http://localhost:3001";

  try {
    const r = await fetch(`${base}/leaderboard/recent`, {
      cache: "no-store",
    });

    const text = await r.text();

    try {
      const json = JSON.parse(text);
      return NextResponse.json(json, { status: r.status });
    } catch {
      return new NextResponse(text, { status: r.status });
    }
  } catch {
    return NextResponse.json(
      { error: "proxy_error" },
      { status: 502 }
    );
  }
}
// ===== FILE END: apps/web/app/api/leaderboard/recent/route.ts =====
