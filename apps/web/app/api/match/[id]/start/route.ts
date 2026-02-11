// ===== FILE START: apps/web/app/api/match/[id]/start/route.ts =====
import { NextResponse } from "next/server";
import { proxyJson } from "../../../_proxy";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const { res, data } = await proxyJson(
    `/match/${encodeURIComponent(id)}/start`,
    {
      method: "POST",
      bodyJson: {}, // на всякий, чтобы не словить пустой JSON body проблему
    }
  );

  return NextResponse.json(data, { status: res.status });
}
// ===== FILE END: apps/web/app/api/match/[id]/start/route.ts =====
