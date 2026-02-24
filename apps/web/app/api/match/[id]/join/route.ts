// ===== FILE START: apps/web/app/api/match/[id]/join/route.ts =====
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// ===== INSERT START: getApiBase =====
function getApiBase(): string {
  const v =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_URL ||
    "http://localhost:3001";

  return v.replace(/\/+$/, "");
}
// ===== INSERT END: getApiBase =====

export async function POST(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params;
  const id = String(p?.id || "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing match id" }, { status: 400 });
  }

  const apiBase = getApiBase();

  const contentType = req.headers.get("content-type") || "";
  const bodyText = await req.text().catch(() => "");

  const upstream = await fetch(`${apiBase}/api/match/${encodeURIComponent(id)}/join`, {
    method: "POST",
    headers: {
      ...(contentType ? { "content-type": contentType } : {}),
    },
    body: bodyText || undefined,
    cache: "no-store",
  }).catch((e) => {
    return new Response(JSON.stringify({ ok: false, error: "Upstream fetch failed", detail: String(e) }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  });

  const text = await upstream.text().catch(() => "");

  return new Response(text, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/json",
    },
  });
}
// ===== FILE END: apps/web/app/api/match/[id]/join/route.ts =====