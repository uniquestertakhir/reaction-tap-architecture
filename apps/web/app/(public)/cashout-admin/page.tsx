// ===== FILE START: apps/web/app/(public)/cashout-admin/page.tsx =====
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CashoutStatus = "pending" | "approved" | "rejected";

type CashoutRequest = {
  id: string;
  createdAt: number;
  updatedAt?: number;
  playerId: string;
  amount: number;
  currency: string;
  status: CashoutStatus;
  note?: string;
  approvedAt?: number;
  rejectedAt?: number;

  // ✅ from API (set on approve)
  payoutRef?: string;
};



async function safeJson(r: Response) {
  try {
    return await r.json();
  } catch {
    return null;
  }
}

// ===== INSERT START: admin gate helpers =====
function cleanToken(s: string) {
  return String(s || "").replace(/[^\x20-\x7E]/g, "").trim();
}

function getLocalAdminToken() {
  try {
    return cleanToken(String(localStorage.getItem("rt_admin_token_v1") || ""));
  } catch {
    return "";
  }
}
// ===== INSERT END: admin gate helpers =====


export default function CashoutAdminPage() {
   // ===== INSERT START: admin gate state =====
  const [adminToken, setAdminToken] = useState<string>("");
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    setAdminToken(getLocalAdminToken());
  }, []);
  // ===== INSERT END: admin gate state =====
  const [playerId, setPlayerId] = useState("");
  const [items, setItems] = useState<CashoutRequest[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

    const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  // ✅ DEV: reset all cashouts (server in-memory store)
  const [resetting, setResetting] = useState(false);


  async function load() {
  setStatus("loading");
  setErr(null);

  const qs = new URLSearchParams();
  if (playerId.trim()) qs.set("playerId", playerId.trim());
  qs.set("limit", "50");

  const token = cleanToken(adminToken || getLocalAdminToken());
  if (!token) {
    setItems([]);
    setStatus("error");
    setErr("unauthorized");
    setUnauthorized(true);
    return;
  }

  const r = await fetch(`/api/cashout/list?${qs.toString()}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      "x-admin-token": token,
    },
    cache: "no-store",
  });

  const j = await safeJson(r);


if (r.status === 401) {
  setItems([]);
  setStatus("error");
  setErr("unauthorized");
  setUnauthorized(true);
  return;
}



  // runtime validation
  const ok = r.ok && j && typeof j === "object" && (j as any).ok === true && Array.isArray((j as any).items);

  if (!ok) {
    setItems([]);
    setStatus("error");
    setErr((j as any)?.error || `load_failed_${r.status}`);
    return;
  }

  setItems((j as any).items);
  setStatus("ok");
}

 async function resetAll() {
  setResetting(true);
  setErr(null);

  const token = cleanToken(adminToken || getLocalAdminToken());
  if (!token) {
    setErr("unauthorized");
    setUnauthorized(true);
    setResetting(false);
    return;
  }

  try {
    const r = await fetch("/api/cashout/reset", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify({}), // токен идёт в header
    });

    const j = await safeJson(r);

    if (r.status === 401) {
      setErr("unauthorized");
      setUnauthorized(true);
      return;
    }

    if (!r.ok || j?.ok === false) {
      setErr(j?.error || `reset_failed_${r.status}`);
      return;
    }

    await load();
  } finally {
    setResetting(false);
  }
}






  // ===== REPLACE START: approve(id) =====
async function approve(id: string) {
  setActionBusyId(id);
  setErr(null);

  try {
    const token = cleanToken(adminToken || getLocalAdminToken());
    if (!token) {
      setErr("unauthorized");
      setUnauthorized(true);
      return;
    }

    const r = await fetch(`/api/cashout/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify({}),
    });

    const j = await safeJson(r);

    if (r.status === 401) {
      setErr("unauthorized");
      setUnauthorized(true);
      return;
    }

    if (!r.ok || j?.ok === false) {
      setErr(j?.error || `approve_failed_${r.status}`);
      return;
    }

    await load();
  } finally {
    setActionBusyId(null);
  }
}
// ===== REPLACE END: approve(id) =====



  // ===== REPLACE START: reject(id) =====
async function reject(id: string) {
  setActionBusyId(id);
  setErr(null);

  try {
    const note = (noteById[id] || "").trim() || undefined;

    const token = cleanToken(adminToken || getLocalAdminToken());
    if (!token) {
      setErr("unauthorized");
      setUnauthorized(true);
      return;
    }

    const r = await fetch(`/api/cashout/${encodeURIComponent(id)}/reject`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify({ note }),
    });

    const j = await safeJson(r);

    if (r.status === 401) {
      setErr("unauthorized");
      setUnauthorized(true);
      return;
    }

    if (!r.ok || j?.ok === false) {
      setErr(j?.error || `reject_failed_${r.status}`);
      return;
    }

    await load();
  } finally {
    setActionBusyId(null);
  }
}
// ===== REPLACE END: reject(id) =====



  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return copy;
  }, [items]);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Cashout Admin</h1>
          <Link href="/lobby" className="text-sm text-white/70 hover:text-white">
            Back
          </Link>
        </div>

        <p className="mt-2 text-sm text-white/60">
          Pending/approved/rejected cashout requests. This is DEV/MVP admin UI.
        </p>

        <div className="mt-6 flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-white/70">Admin token</label>
<input
  value={adminToken}
  onChange={(e) => {
    const v = cleanToken(e.target.value);
    setAdminToken(v);
    try {
      localStorage.setItem("rt_admin_token_v1", v);
    } catch {}
  }}
  placeholder="CASHOUT_ADMIN_TOKEN"
  className="w-[360px] max-w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm outline-none placeholder:text-white/30"
/>

            <label className="text-sm text-white/70">Filter by playerId</label>
            <input
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              placeholder="p_..."
              className="w-[360px] max-w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm outline-none placeholder:text-white/30"
            />
                        <button
              onClick={load}
              className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Refresh
            </button>

            <button
              onClick={resetAll}
              disabled={resetting}
              className={
                "rounded-2xl px-4 py-2 text-sm font-medium " +
                (resetting
                  ? "cursor-not-allowed bg-white/10 text-white/40"
                  : "border border-red-400/40 text-red-200 hover:bg-red-400/10")
              }
              title="DEV only: clears in-memory cashouts on API"
            >
              {resetting ? "Resetting…" : "Reset (DEV)"}
            </button>


            <div className="ml-auto text-xs text-white/50">
              {status === "loading" ? "Loading…" : status === "error" ? "Error" : "Live"}
            </div>
          </div>

          {err ? (
  <div className="text-sm text-red-300">
    Error: {err === "unauthorized" ? "unauthorized (set admin token)" : err}
  </div>
) : null}

        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-white/10">
          {sorted.length === 0 ? (
            <div className="p-6 text-sm text-white/60">No cashout requests.</div>
          ) : (
            <ul className="divide-y divide-white/10">
              {sorted.map((c) => {
                const busy = actionBusyId === c.id;
                const isPending = c.status === "pending";

                return (
                  <li key={c.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <div className="font-semibold">{c.amount} {c.currency}</div>
                          <div
                            className={
                              "rounded-full px-3 py-1 text-xs " +
                              (c.status === "pending"
                                ? "bg-yellow-400/15 text-yellow-200"
                                : c.status === "approved"
                                ? "bg-green-400/15 text-green-200"
                                : "bg-red-400/15 text-red-200")
                            }
                          >
                            {c.status}
                          </div>
                        </div>

                        <div className="mt-1 text-xs text-white/60">
                          id: <span className="text-white/80">{c.id}</span>
                        </div>
                        <div className="mt-1 text-xs text-white/60">
                          playerId: <span className="text-white/80">{c.playerId}</span>
                        </div>
                        <div className="mt-1 text-xs text-white/50">
                          created: {new Date(c.createdAt).toLocaleString()}
                        </div>

                        {c.note ? (
                          <div className="mt-2 text-xs text-white/70">
                            note: <span className="text-white/80">{c.note}</span>
                          </div>
                        ) : null}
                        {/* ===== INSERT START: payoutRef ===== */}
{c.payoutRef ? (
  <div className="mt-2 text-xs text-white/70">
    payoutRef: <span className="font-mono text-white/80">{String(c.payoutRef)}</span>
  </div>
) : null}
{/* ===== INSERT END: payoutRef ===== */}

                      </div>

                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[320px]">
                        <input
                          value={noteById[c.id] ?? ""}
                          onChange={(e) => setNoteById((m) => ({ ...m, [c.id]: e.target.value }))}
                          placeholder="Reject note (optional)"
                          className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm outline-none placeholder:text-white/30"
                          disabled={!isPending || busy}
                        />

                        <div className="flex gap-2">
                          <button
                            onClick={() => approve(c.id)}
                            disabled={!isPending || busy}
                            className={
                              "flex-1 rounded-2xl px-4 py-2 text-sm font-medium " +
                              (!isPending || busy
                                ? "bg-white/10 text-white/40"
                                : "bg-white text-black")
                            }
                          >
                            {busy ? "Working…" : "Approve"}
                          </button>

                          <button
                            onClick={() => reject(c.id)}
                            disabled={!isPending || busy}
                            className={
                              "flex-1 rounded-2xl border px-4 py-2 text-sm font-medium " +
                              (!isPending || busy
                                ? "border-white/10 text-white/40"
                                : "border-red-400/40 text-red-200 hover:bg-red-400/10")
                            }
                          >
                            {busy ? "Working…" : "Reject"}
                          </button>
                        </div>

                        {!isPending ? (
                          <div className="text-xs text-white/40">
                            This request is already {c.status}.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-6 text-xs text-white/50">
          Tip: create a request via <code className="text-white/70">/api/wallet/withdraw</code> or your UI,
          then refresh here and approve.
        </div>
      </div>
    </main>
  );
}
// ===== FILE END: apps/web/app/(public)/cashout-admin/page.tsx =====
