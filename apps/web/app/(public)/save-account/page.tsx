// ===== FILE START: apps/web/app/(public)/save-account/page.tsx =====
"use client";

import { useEffect, useMemo, useState } from "react";
import { readPlayer, writePlayer, type PlayerState } from "@/lib/playerStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportPayload = {
  v: 1;
  player: PlayerState;
  createdAt: number;
};

function clampNum(n: any, min: number, max: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function safeParseJSON(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function toBase64Url(str: string) {
  // utf-8 safe
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(b64url: string) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizePlayer(p: any): PlayerState | null {
  if (!p || typeof p !== "object") return null;

  const playerId = String(p.playerId || "").trim();
  if (!playerId) return null;

  return {
    playerId,
    gems: clampNum(p.gems, 0, 1_000_000_000),
    cash: clampNum(p.cash, 0, 1_000_000_000),
    level: clampNum(p.level, 1, 10_000_000),
    xp: clampNum(p.xp, 0, 1_000_000_000),
  };
}

export default function SaveAccountPage() {
  const [mounted, setMounted] = useState(false);

  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const payload: ExportPayload = {
      v: 1,
      player: readPlayer(),
      createdAt: Date.now(),
    };
    const json = JSON.stringify(payload);
    const code = toBase64Url(json);
    setExportText(code);
  }, []);

  const exportPreview = useMemo(() => {
    if (!mounted) return "";
    const p = readPlayer();
    return `playerId=${p.playerId} | gems=${p.gems} | cash=$${p.cash.toFixed(2)} | level=${p.level} | xp=${p.xp}`;
  }, [mounted]);

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportText);
      setMsg("Copied.");
      setTimeout(() => setMsg(null), 1200);
    } catch {
      setMsg("Copy failed. Select text and copy manually.");
      setTimeout(() => setMsg(null), 2000);
    }
  }

  function regenerate() {
    const payload: ExportPayload = {
      v: 1,
      player: readPlayer(),
      createdAt: Date.now(),
    };
    setExportText(toBase64Url(JSON.stringify(payload)));
    setMsg("Updated.");
    setTimeout(() => setMsg(null), 1200);
  }

  function applyImport() {
    const raw = (importText || "").trim();
    if (!raw) {
      setMsg("Paste a code first.");
      setTimeout(() => setMsg(null), 1500);
      return;
    }

    // Accept:
    // 1) base64url code (our default)
    // 2) raw JSON payload
    // 3) raw JSON player
    let decoded = raw;
    let parsed: any = null;

    // try base64url -> json
    try {
      decoded = fromBase64Url(raw);
      parsed = safeParseJSON(decoded);
    } catch {
      // ignore
    }

    if (!parsed) {
      parsed = safeParseJSON(raw);
    }

    if (!parsed) {
      setMsg("Invalid code/JSON.");
      setTimeout(() => setMsg(null), 1800);
      return;
    }

    const candidatePlayer =
      parsed?.player && parsed?.v ? parsed.player : parsed;

    const next = normalizePlayer(candidatePlayer);
    if (!next) {
      setMsg("Invalid player payload.");
      setTimeout(() => setMsg(null), 1800);
      return;
    }

    // ✅ write full state (keeps HUD synced via playerStore emit)
    writePlayer(next);

    // refresh export to match imported state
    const payload: ExportPayload = {
      v: 1,
      player: readPlayer(),
      createdAt: Date.now(),
    };
    setExportText(toBase64Url(JSON.stringify(payload)));

    setImportText("");
    setMsg("Imported. HUD should update.");
    setTimeout(() => setMsg(null), 1600);
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)]">
      <div className="text-xs font-semibold tracking-[0.22em] text-white/60">
        SAVE ACCOUNT
      </div>

      <div className="mt-2 text-4xl font-extrabold leading-tight">
        Export / Import
      </div>

      <div className="mt-2 text-white/70">
        MVP sync: copy a code to move your profile to another device.
      </div>

      {msg ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
          {msg}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4">
        {/* EXPORT */}
        <div className="rounded-3xl border border-white/10 bg-black/15 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Export code</div>
              <div className="mt-1 text-xs text-white/60">
                Keep it private. Anyone with the code can load your profile on
                this device.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={regenerate}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={copyExport}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/50">Preview:</div>
            <div className="mt-1 text-sm font-semibold text-white">
              {exportPreview}
            </div>
          </div>

          <textarea
            value={exportText}
            readOnly
            className="mt-4 h-28 w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/80 outline-none"
          />
        </div>

        {/* IMPORT */}
        <div className="rounded-3xl border border-white/10 bg-black/15 p-5">
          <div className="text-sm font-semibold">Import code</div>
          <div className="mt-1 text-xs text-white/60">
            Paste a code from another device. Import overwrites your local profile.
          </div>

          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste export code here..."
            className="mt-4 h-28 w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white placeholder:text-white/35 outline-none focus:border-white/20"
          />

          <div className="mt-4 flex items-center justify-end">
            <button
              type="button"
              onClick={applyImport}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90"
            >
              Import
            </button>
          </div>

          <div className="mt-3 text-xs text-white/50">
            Tip: after import, open HUD → Profile to confirm values updated.
          </div>
        </div>
      </div>
    </div>
  );
}
// ===== FILE END: apps/web/app/(public)/save-account/page.tsx =====