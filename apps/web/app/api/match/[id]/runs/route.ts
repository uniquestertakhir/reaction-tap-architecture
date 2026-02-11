// ===== FILE START: apps/web/app/api/match/[id]/runs/route.ts =====
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function apiBase() {
  return process.env.API_BASE_URL || "http://localhost:3001";
}

function readIdFromUrl(req: Request) {
  const u = new URL(req.url);
  // ожидаем: /api/match/:id/runs
  const m = u.pathname.match(/\/api\/match\/([^/]+)\/runs\/?$/);
  return m ? decodeURIComponent(m[1]) : "";
}

export async function GET(
  req: Request,
  ctx: { params?: Promise<{ id?: string }> | { id?: string } } // params может быть Promise в Next
) {
  const p = await Promise.resolve(ctx?.params as any);
  const id = String(p?.id || readIdFromUrl(req) || "").trim();

  if (!id) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  const url = `${apiBase()}/match/${encodeURIComponent(id)}/runs`;

  const r = await fetch(url, { cache: "no-store" });
  const text = await r.text();

  return new NextResponse(text, {
    status: r.status,
    headers: {
      "content-type": r.headers.get("content-type") || "application/json",
      "cache-control": "no-store",
    },
  });
}

// ===== FILE END: apps/web/app/api/match/[id]/runs/route.ts =====
