// ===== FILE START: apps/web/app/api/match/[id]/route.ts =====
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function apiBase() {
  return process.env.API_ORIGIN || "http://localhost:3001";
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const params = await Promise.resolve(ctx.params);
  const id = String(params.id || "").trim();

  const url = `${apiBase()}/match/${encodeURIComponent(id)}`;

  const r = await fetch(url, { cache: "no-store" });
  const text = await r.text();

  return new NextResponse(text, {
    status: r.status,
    headers: { "content-type": r.headers.get("content-type") || "application/json" },
  });
}
// ===== FILE END: apps/web/app/api/match/[id]/route.ts =====
