// ===== FILE START: apps/web/app/(public)/settings/page.tsx =====
"use client";

import { useEffect, useMemo, useState } from "react";

type SettingId = "reduceMotion" | "hideFx" | "haptics" | "sounds";
type SettingsState = Record<SettingId, boolean>;

const KEY = "rt_settings_v1";

const DEFAULTS: SettingsState = {
  reduceMotion: false,
  hideFx: false,
  haptics: true,
  sounds: true,
};

function readSettings(): SettingsState {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<SettingsState>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function writeSettings(next: SettingsState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("rt_settings_changed_v1"));
}

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function ToggleRow({
  title,
  desc,
  checked,
  onChange,
  icon,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "w-full text-left rounded-3xl border border-white/10 bg-white/5 px-4 py-4",
        "hover:bg-white/10 transition",
        "shadow-[0_30px_120px_-90px_rgba(0,0,0,0.9)]"
      )}
      aria-pressed={checked}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-black/15 text-lg shrink-0">
            {icon}
          </div>

          <div className="min-w-0">
            <div className="font-semibold">{title}</div>
            <div className="mt-1 text-sm text-white/70">{desc}</div>
          </div>
        </div>

        <div
          className={cn(
            "relative h-8 w-14 shrink-0 rounded-full border",
            "ring-1 ring-white/10",
            checked
              ? "border-violet-300/30 bg-violet-400/25"
              : "border-white/10 bg-black/20"
          )}
          aria-hidden="true"
        >
          <span
            className={cn(
              "absolute top-1 h-6 w-6 rounded-full bg-white shadow",
              "transition-transform",
              checked ? "translate-x-7" : "translate-x-1"
            )}
          />
        </div>
      </div>
    </button>
  );
}

export default function SettingsPage() {
  const [s, setS] = useState<SettingsState>(DEFAULTS);

  useEffect(() => {
    setS(readSettings());
  }, []);

  const items = useMemo(
    () => [
      {
        id: "reduceMotion" as const,
        title: "Reduce motion",
        desc: "Less UI animation. Useful for older phones.",
        icon: "🌀",
      },
      {
        id: "hideFx" as const,
        title: "Hide visual FX",
        desc: "Disable heavy glow/overlays for better performance.",
        icon: "✨",
      },
      {
        id: "haptics" as const,
        title: "Haptics",
        desc: "Vibration feedback (mobile).",
        icon: "📳",
      },
      {
        id: "sounds" as const,
        title: "Sounds",
        desc: "UI click & game sounds.",
        icon: "🔊",
      },
    ],
    []
  );

  function setOne(id: SettingId, v: boolean) {
    const next = { ...s, [id]: v };
    setS(next);
    writeSettings(next);
  }

  function reset() {
    setS(DEFAULTS);
    writeSettings(DEFAULTS);
  }

  return (
    <div className="text-white">
      {/* header card (same vibe as other menu pages) */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_30px_120px_-90px_rgba(0,0,0,0.9)]">
        <div className="text-xs tracking-widest text-white/60">SETTINGS</div>
        <div className="mt-2 text-3xl font-extrabold">App Settings</div>
        <div className="mt-2 text-white/70">
          Stored on this device. Fast and simple.
        </div>

        <div className="mt-5 flex items-center justify-end">
          <button
            type="button"
            onClick={reset}
            className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 font-semibold hover:bg-white/15"
          >
            Reset
          </button>
        </div>
      </div>

      {/* toggles */}
      <div className="mt-4 space-y-3">
        {items.map((it) => (
          <ToggleRow
            key={it.id}
            title={it.title}
            desc={it.desc}
            checked={s[it.id]}
            onChange={(v) => setOne(it.id, v)}
            icon={it.icon}
          />
        ))}
      </div>

      <div className="mt-4 text-xs text-white/50">
        Next: wire these toggles into games (FX/motion/sounds).
      </div>
    </div>
  );
}
// ===== FILE END: apps/web/app/(public)/settings/page.tsx =====