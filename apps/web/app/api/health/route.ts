// ===== FILE START: apps/web/app/api/health/route.ts =====
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = process.env.API_BASE || "http://localhost:3001";

  try {
    const r = await fetch(`${base}/health`, { cache: "no-store" });
    const text = await r.text();

    // Fastify отдаёт JSON, но на всякий случай подстрахуемся
    try {
      const json = JSON.parse(text);
      return NextResponse.json(json, { status: r.status });
    } catch {
      return new NextResponse(text, { status: r.status });
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "proxy_error" },
      { status: 502 }
    );
  }
}
// ===== FILE END: apps/web/app/api/health/route.ts =====
