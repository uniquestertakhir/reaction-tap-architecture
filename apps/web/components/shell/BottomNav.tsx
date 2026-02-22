"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TabItem = {
  href: string;
  label: string;
  icon: string;
  center?: boolean;
};

const TABS: TabItem[] = [
  { href: "/shop", label: "Shop", icon: "🛍️" },
  { href: "/results", label: "Results", icon: "🏁" },
  { href: "/games", label: "Games", icon: "🎮", center: true },
  { href: "/rewards", label: "Rewards", icon: "🎁" },
  { href: "/leagues", label: "Leagues", icon: "🏆" },
];

export default function BottomNav() {
  const path = usePathname() || "/";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/80 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-5 px-2 py-2">
        {TABS.map((t) => {
          const active = path === t.href || path.startsWith(t.href + "/");

          if (t.center) {
            return (
              <Link
                key={t.href}
                href={t.href}
                className="relative -mt-6 flex flex-col items-center justify-center"
              >
                <div
                  className={
                    "flex h-14 w-14 items-center justify-center rounded-full border " +
                    (active
                      ? "border-violet-300/40 bg-violet-500 text-black"
                      : "border-white/15 bg-white/5 text-white")
                  }
                >
                  <span className="text-xl">{t.icon}</span>
                </div>
                <div
                  className={
                    "mt-1 text-[11px] " +
                    (active ? "text-white" : "text-white/60")
                  }
                >
                  {t.label}
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={t.href}
              href={t.href}
              className={
                "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 " +
                (active
                  ? "bg-white/5 text-white"
                  : "text-white/70 hover:text-white")
              }
            >
              <div
                className={
                  "text-lg " + (active ? "" : "opacity-80")
                }
              >
                {t.icon}
              </div>
              <div className="text-[11px]">{t.label}</div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
