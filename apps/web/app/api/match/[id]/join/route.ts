// apps/web/app/api/match/[id]/join/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({
    ok: true,
    matchId: params.id,
  });
}