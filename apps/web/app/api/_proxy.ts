// ===== FILE START: apps/web/app/api/_proxy.ts =====
export const API_BASE = process.env.API_BASE_URL || "http://localhost:3001";

export async function proxyJson(
  path: string,
  init: RequestInit & { bodyJson?: unknown } = {}
) {
  const { bodyJson, ...rest } = init;

  const headers = new Headers(rest.headers);

  let body: string | undefined = undefined;

  // Если bodyJson задан — отправляем JSON
  if (bodyJson !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(bodyJson);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
    body,
    // важно для локальной разработки: не кешировать
    cache: "no-store",
  });

  const text = await res.text();

  // Попытка распарсить JSON; если не JSON — вернем как текст
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: "bad_json_from_api", raw: text };
  }

  return { res, data };
}
// ===== FILE END: apps/web/app/api/_proxy.ts =====
