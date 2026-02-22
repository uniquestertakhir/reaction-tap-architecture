// ===== FILE START: apps/web/app/(public)/shop/page.tsx =====
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { readPlayer, updatePlayer } from "@/lib/playerStore";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Icon({ name }: { name: string }) {
  return (
    <span
      className="grid h-6 w-6 place-items-center rounded-md border border-white/15 bg-white/5 text-[11px] font-bold text-white/80"
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

type OfferSlide =
  | {
      id: "double";
      title: "DOUBLE FIRST DEPOSIT";
      priceLabel: "$100";
      metaLeft: "$100";
      metaRight: "+ BONUS $100";
      metaExtra?: string;
    }
  | {
      id: "starter";
      title: "STARTER PACK";
      priceLabel: "$10";
      metaLeft: "$10";
      metaRight: "+ BONUS $5";
      metaExtra: "+ 1K 💎";
    };

const SLIDES: OfferSlide[] = [
  {
    id: "double",
    title: "DOUBLE FIRST DEPOSIT",
    priceLabel: "$100",
    metaLeft: "$100",
    metaRight: "+ BONUS $100",
  },
  {
    id: "starter",
    title: "STARTER PACK",
    priceLabel: "$10",
    metaLeft: "$10",
    metaRight: "+ BONUS $5",
    metaExtra: "+ 1K 💎",
  },
];

type CashPack = { usd: number; bonusUsd?: number; badge?: string; badgeTone?: string };
type GemsPack = { gems: number; usd: number; bonusUsd?: number; badge?: string; badgeTone?: string };

const CASH_PACKS: CashPack[] = [
  { usd: 3, bonusUsd: 3, badge: "BEST VALUE", badgeTone: "bg-amber-400/95 text-black" },
  { usd: 5, bonusUsd: 0.5, badge: "10%", badgeTone: "bg-white/15 text-white" },
  { usd: 15, bonusUsd: 2, badge: "14%", badgeTone: "bg-white/15 text-white" },
  { usd: 25, bonusUsd: 4, badge: "16%", badgeTone: "bg-white/15 text-white" },
  { usd: 25, bonusUsd: 25, badge: "BEST VALUE", badgeTone: "bg-amber-400/95 text-black" },
  { usd: 35, bonusUsd: 7, badge: "20%", badgeTone: "bg-white/15 text-white" },
];

const GEMS_PACKS: GemsPack[] = [
  { gems: 400, usd: 3, bonusUsd: 3, badge: "", badgeTone: "" },
  { gems: 700, usd: 5, bonusUsd: 5, badge: "MOST POPULAR", badgeTone: "bg-rose-400/95 text-black" },
  { gems: 1500, usd: 10, bonusUsd: 10, badge: "BEST VALUE", badgeTone: "bg-amber-400/95 text-black" },
];

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function safeReturnTo(raw: string) {
  const s = (raw || "").trim();
  // allow only relative paths to avoid weird redirects
  if (!s.startsWith("/")) return "";
  // block protocol-like strings
  if (s.startsWith("//")) return "";
  return s;
}

function pickBestIndex(values: number[], needAmount: number) {
  // choose minimal pack >= need; else choose max
  let best = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i] >= needAmount) {
      best = i;
      break;
    }
  }
  return best === -1 ? values.length - 1 : best;
}

export default function ShopPage() {
  const router = useRouter();
  const sp = useSearchParams();

  // hydration-safe: first render must match SSR (zeros), then load from localStorage on mount
  const [player, setPlayer] = useState(() => ({
    level: 0,
    xp: 0,
    gems: 0,
    cash: 0,
  }));

  useEffect(() => {
    setPlayer(readPlayer());
    const onStorage = () => setPlayer(readPlayer());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // query params
  const tab = (sp.get("tab") || "").toLowerCase(); // "cash" | "gems"
  const needKind = (sp.get("need") || "").toLowerCase(); // "cash" | "gems" | ""
  const amountRaw = (sp.get("amount") || "").trim();
  const amount = amountRaw ? Number(amountRaw) : null;

  const returnTo = safeReturnTo(sp.get("returnTo") || "");

  // which section should we target
  const targetKind: "cash" | "gems" | "" =
    needKind === "cash" || needKind === "gems"
      ? (needKind as "cash" | "gems")
      : tab === "cash" || tab === "gems"
      ? (tab as "cash" | "gems")
      : "";

  const cashRef = useRef<HTMLDivElement | null>(null);
  const gemsRef = useRef<HTMLDivElement | null>(null);

  // recommended indices
  const cashTargetIndex = useMemo(() => {
    if (targetKind !== "cash") return null;
    if (typeof amount !== "number" || Number.isNaN(amount)) return null;
    return pickBestIndex(
      CASH_PACKS.map((p) => p.usd),
      amount
    );
  }, [targetKind, amount]);

  const gemsTargetIndex = useMemo(() => {
    if (targetKind !== "gems") return null;
    if (typeof amount !== "number" || Number.isNaN(amount)) return null;
    return pickBestIndex(
      GEMS_PACKS.map((p) => p.gems),
      amount
    );
  }, [targetKind, amount]);

  // auto-scroll to requested section
  useEffect(() => {
    const target =
      targetKind === "gems" ? gemsRef.current : targetKind === "cash" ? cashRef.current : null;
    if (!target) return;

    const t = window.setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);

    return () => window.clearTimeout(t);
  }, [targetKind]);

  const [slideIndex, setSlideIndex] = useState(0);
  const slide = SLIDES[slideIndex % SLIDES.length];

  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<number | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastT.current) window.clearTimeout(toastT.current);
    toastT.current = window.setTimeout(() => setToast(null), 1600);
  }

    function goBackAfterBuy(delayMs = 350) {
    if (!returnTo) return;
    // let toast flash briefly
    window.setTimeout(() => router.push(returnTo), delayMs);
  }

  function grantFreeGems() {
    const next = updatePlayer({ gems: player.gems + 30 });
    setPlayer(next);
    showToast("+30 💎 added");
  }

  function buyCashPack(p: CashPack) {
    const add = p.usd + (p.bonusUsd || 0);
    const next = updatePlayer({ cash: player.cash + add });
    setPlayer(next);
    showToast(`+${money(add)} added`);
    goBackAfterBuy(350);
  }

  function buyGemsPack(p: GemsPack) {
    const next = updatePlayer({
      gems: player.gems + p.gems,
      cash: player.cash + (p.bonusUsd || 0),
    });
    setPlayer(next);
    showToast(`+${p.gems} 💎 added`);
    goBackAfterBuy(350);
  }

  function buyOffer(s: OfferSlide) {
    if (s.id === "starter") {
      const next = updatePlayer({ cash: player.cash + 15, gems: player.gems + 1000 });
      setPlayer(next);
      showToast("Starter Pack claimed");
      goBackAfterBuy(350);
      return;
    }
    const next = updatePlayer({ cash: player.cash + 200 });
    setPlayer(next);
    showToast("Deposit bonus claimed");
    goBackAfterBuy();
  }

  return (
    <main className="min-h-screen text-white">
      <div className="min-h-screen bg-[radial-gradient(1200px_800px_at_50%_-200px,rgba(255,255,255,0.18),transparent_60%),linear-gradient(180deg,#6b21a8_0%,#3b0a7a_40%,#170027_100%)]">
                <div className="mx-auto flex max-w-md flex-col px-4 pb-28 pt-4">
          {returnTo ? (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => router.push(returnTo)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90"
              >
                ← Back
              </button>
            </div>
          ) : null}

          {/* FREE GEMS */}
          <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_30px_120px_-90px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/10 text-lg">
                  💎
                </div>
                <div>
                  <div className="text-[11px] text-white/70">FREE GEMS</div>
                  <div className="text-lg font-extrabold">30</div>
                </div>
              </div>

              <button
                type="button"
                onClick={grantFreeGems}
                className="rounded-2xl bg-emerald-400 px-6 py-2 text-sm font-extrabold text-black shadow-[0_20px_70px_-45px_rgba(0,0,0,0.9)]"
              >
                FREE
              </button>
            </div>
          </div>

          {/* EXCLUSIVE OFFERS */}
          <div className="mt-6 text-center text-sm font-extrabold tracking-wide">EXCLUSIVE OFFERS</div>

          <div className="mt-3 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
            <div className="p-4">
              <div className="rounded-3xl border border-white/10 bg-[radial-gradient(800px_500px_at_30%_-10%,rgba(255,255,255,0.20),transparent_60%),linear-gradient(135deg,rgba(34,197,94,0.25),rgba(17,24,39,0.35))] p-4">
                <div className="text-center text-xl font-extrabold">{slide.title}</div>

                <div className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-white/90">
                  <span className="rounded-xl bg-black/20 px-3 py-1">{slide.metaLeft}</span>
                  <span className="rounded-xl bg-black/20 px-3 py-1">{slide.metaRight}</span>
                  {slide.metaExtra ? (
                    <span className="rounded-xl bg-black/20 px-3 py-1">{slide.metaExtra}</span>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSlideIndex((v) => (v - 1 + SLIDES.length) % SLIDES.length)}
                      className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/5 text-white/80"
                      aria-label="Prev offer"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlideIndex((v) => (v + 1) % SLIDES.length)}
                      className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/5 text-white/80"
                      aria-label="Next offer"
                    >
                      ›
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => buyOffer(slide)}
                    className="rounded-2xl bg-white px-8 py-2 text-sm font-extrabold text-black"
                  >
                    {slide.priceLabel}
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-center gap-2">
                {SLIDES.map((s, i) => (
                  <span
                    key={s.id}
                    className={cn("h-2 w-2 rounded-full", i === slideIndex ? "bg-white" : "bg-white/30")}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* CASH */}
          <div ref={cashRef} className="mt-6 text-center text-sm font-extrabold tracking-wide">
            CASH
          </div>

          {targetKind === "cash" && typeof amount === "number" && !Number.isNaN(amount) ? (
            <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white/85">
              Need: <span className="font-extrabold">{money(amount)}</span>
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-3 gap-3">
            {CASH_PACKS.map((p, idx) => {
              const bonus = p.bonusUsd || 0;
              const badge = p.badge;
              const badgeTone = p.badgeTone || "bg-white/15 text-white";
              const isRec = cashTargetIndex === idx;

              return (
                <button
                  key={`${p.usd}-${idx}`}
                  type="button"
                  onClick={() => buyCashPack(p)}
                  className={cn(
                    "relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-3 text-left shadow-[0_30px_120px_-90px_rgba(0,0,0,0.9)]",
                    isRec && "ring-2 ring-amber-300/90 shadow-[0_0_0_6px_rgba(252,211,77,0.12)]"
                  )}
                >
                  {isRec ? (
                    <div className="absolute right-2 top-2 rounded-full bg-amber-400/95 px-2 py-1 text-[10px] font-extrabold text-black">
                      RECOMMENDED
                    </div>
                  ) : null}

                  {badge ? (
                    <div className={cn("absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-extrabold", badgeTone)}>
                      {badge}
                    </div>
                  ) : null}

                  <div className="mt-8">
                    <div className="text-2xl font-extrabold">{money(p.usd)}</div>
                    <div className="mt-2 rounded-xl bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/80">
                      {bonus > 0 ? `+${money(bonus)} BONUS` : "First deposit!"}
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl bg-emerald-400 px-3 py-2 text-center text-sm font-extrabold text-black">
                    {money(p.usd)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* GEMS */}
          <div ref={gemsRef} className="mt-7 text-center text-sm font-extrabold tracking-wide">
            GEMS
          </div>

          {targetKind === "gems" && typeof amount === "number" && !Number.isNaN(amount) ? (
            <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white/85">
              Need: <span className="font-extrabold">💎 {amount}</span>
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-3 gap-3">
            {GEMS_PACKS.map((p, idx) => {
              const isRec = gemsTargetIndex === idx;

              return (
                <button
                  key={`${p.gems}-${idx}`}
                  type="button"
                  onClick={() => buyGemsPack(p)}
                  className={cn(
                    "relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-3 text-left shadow-[0_30px_120px_-90px_rgba(0,0,0,0.9)]",
                    isRec && "ring-2 ring-amber-300/90 shadow-[0_0_0_6px_rgba(252,211,77,0.12)]"
                  )}
                >
                  {isRec ? (
                    <div className="absolute right-2 top-2 rounded-full bg-amber-400/95 px-2 py-1 text-[10px] font-extrabold text-black">
                      RECOMMENDED
                    </div>
                  ) : null}

                  {p.badge ? (
                    <div className={cn("absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-extrabold", p.badgeTone)}>
                      {p.badge}
                    </div>
                  ) : null}

                  <div className="mt-8">
                    <div className="text-xl font-extrabold">
                      {p.gems >= 1000 ? `${(p.gems / 1000).toFixed(1)}K` : p.gems}
                    </div>
                    <div className="mt-1 text-[11px] text-white/70">💎 Gems</div>

                    <div className="mt-2 rounded-xl bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/80">
                      {p.bonusUsd ? `+${money(p.bonusUsd)} $` : "Bonus"}
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl bg-emerald-400 px-3 py-2 text-center text-sm font-extrabold text-black">
                    {money(p.usd)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* payment row */}
          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-white/65">
            <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"> Pay</span>
            <span className="font-extrabold">VISA</span>
            <span className="font-extrabold">PayPal</span>
            <span className="font-extrabold">Mastercard</span>
          </div>

                    {/* support / promo / withdraw */}
          <div className="mt-6 flex flex-col gap-3">
            {[
              { key: "help", title: "Need Help?", subtitle: "Tap here to contact support", ico: "👤" as const },
              { key: "promo", title: "Promo Code", subtitle: "Tap here to add a code", ico: "🏷️" as const },
              { key: "withdraw", title: "Withdraw", subtitle: "Tap here to request a withdrawal", ico: "💵" as const },
            ].map((x) => (
              <button
                key={x.key}
                type="button"
                onClick={() => {
                  if (x.key === "withdraw") {
                    router.push("/withdraw");
                    return;
                  }
                  showToast(`${x.title} (next)`);
                }}
                className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-left shadow-[0_30px_120px_-95px_rgba(0,0,0,0.9)]"
              >
                <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/10">
                  {x.ico}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-extrabold">{x.title}</div>
                  <div className="mt-1 text-xs text-white/70">{x.subtitle}</div>
                </div>
                <div className="text-white/60">→</div>
              </button>
            ))}
          </div>
        </div>

        {/* toast */}
        {toast ? (
          <div className="fixed left-0 right-0 top-4 z-[60] flex justify-center">
            <div className="rounded-2xl border border-white/15 bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
              {toast}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
// ===== FILE END: apps/web/app/(public)/shop/page.tsx =====