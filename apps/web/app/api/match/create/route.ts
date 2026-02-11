// ===== FILE START: apps/web/app/api/match/create/route.ts =====
import { NextResponse } from "next/server";
import { proxyJson } from "../../_proxy";

export const dynamic = "force-dynamic";

export async function POST() {
  // Fastify ругается, если Content-Type: application/json и пустое тело.
  // Поэтому всегда шлем {}.
  const { res, data } = await proxyJson("/match/create", {
    method: "POST",
    bodyJson: {},
  });

  return NextResponse.json(data, { status: res.status });
}
// ===== FILE END: apps/web/app/api/match/create/route.ts =====
