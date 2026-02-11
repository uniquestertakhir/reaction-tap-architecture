// ===== FILE START: apps/web/lib/cashoutAdmin.ts =====
export function cleanAdminToken(s: unknown) {
  return String(s ?? "").replace(/[^\x20-\x7E]/g, "").trim();
}

/**
 * Reads adminToken from:
 * - query string (?adminToken=...)
 * - JSON body { adminToken }
 * - header x-admin-token
 *
 * Returns cleaned token string (may be "").
 */
export async function readAdminToken(req: Request) {
  const url = new URL(req.url);

  // 1) query
  const q = cleanAdminToken(url.searchParams.get("adminToken") || "");
  if (q) return q;

  // 2) header
  const h = cleanAdminToken(req.headers.get("x-admin-token") || "");
  if (h) return h;

  // 3) json body (best-effort)
  try {
    const clone = req.clone();
    const ct = clone.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j: any = await clone.json().catch(() => null);
      const b = cleanAdminToken(j?.adminToken || "");
      if (b) return b;
    }
  } catch {}

  return "";
}

export function isValidAdminToken(token: string) {
  const expected = cleanAdminToken(process.env.CASHOUT_ADMIN_TOKEN || "");
  if (!expected) return false;
  return cleanAdminToken(token) === expected;
}
// ===== FILE END: apps/web/lib/cashoutAdmin.ts =====
