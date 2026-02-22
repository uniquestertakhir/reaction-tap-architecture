// ===== FILE START: apps/web/lib/games/reactionTapVariants.ts =====

export type ReactionTapVariant = {
  id: string;

  // UI
  title: string;
  subtitle: string;

  // matchmaking params
  gameId: "reaction-tap";
  mode: string;

  // economy
  currency: "usd" | "gems";
  entry: number; // per-player entry stake (USD) or entry cost (gems)

  // multiplayer size (Blitz-like)
  players: 2 | 4 | 8;

  // payout model (for USD modes)
  payout?: {
    // percent of total pot for ranks 1..3, sum <= 1
    r1: number;
    r2: number;
    r3: number;
  };

  locked?: boolean;
};

export const REACTION_TAP_VARIANTS: ReactionTapVariant[] = [
  // ===== PRACTICE (gems) =====
  {
    id: "practice-warmup",
    title: "Warm Up",
    subtitle: "Practice · Earn 💎",
    gameId: "reaction-tap",
    mode: "warm-up",
    currency: "gems",
    entry: 0,
    players: 2,
  },

  // ===== USD — 1v1 =====
  {
    id: "usd-1v1-030",
    title: "$0.30 · 1v1",
    subtitle: "Fast duel",
    gameId: "reaction-tap",
    mode: "starter-brawl",
    currency: "usd",
    entry: 0.3,
    players: 2,
    payout: { r1: 1.0, r2: 0.0, r3: 0.0 }, // 1v1 winner takes pot (MVP)
  },
  {
    id: "usd-1v1-100",
    title: "$1 · 1v1",
    subtitle: "Fast duel",
    gameId: "reaction-tap",
    mode: "starter-brawl",
    currency: "usd",
    entry: 1.0,
    players: 2,
    payout: { r1: 1.0, r2: 0.0, r3: 0.0 },
  },
  {
    id: "usd-1v1-300",
    title: "$3 · 1v1",
    subtitle: "Fast duel",
    gameId: "reaction-tap",
    mode: "starter-brawl",
    currency: "usd",
    entry: 3.0,
    players: 2,
    payout: { r1: 1.0, r2: 0.0, r3: 0.0 },
    locked: true,
  },

  // ===== USD — 4 players (top 3 get payout like Blitz) =====
  {
    id: "usd-4p-030",
    title: "$0.30 · 4 players",
    subtitle: "1st/2nd/3rd get paid",
    gameId: "reaction-tap",
    mode: "starter-brawl-4p",
    currency: "usd",
    entry: 0.3,
    players: 4,
    payout: { r1: 0.6, r2: 0.3, r3: 0.1 },
  },
  {
    id: "usd-4p-100",
    title: "$1 · 4 players",
    subtitle: "1st/2nd/3rd get paid",
    gameId: "reaction-tap",
    mode: "starter-brawl-4p",
    currency: "usd",
    entry: 1.0,
    players: 4,
    payout: { r1: 0.6, r2: 0.3, r3: 0.1 },
    locked: true,
  },

  // ===== USD — 8 players (more “room-like” Blitz feel) =====
  {
    id: "usd-8p-030",
    title: "$0.30 · 8 players",
    subtitle: "Top 3 split pot",
    gameId: "reaction-tap",
    mode: "starter-brawl-8p",
    currency: "usd",
    entry: 0.3,
    players: 8,
    payout: { r1: 0.55, r2: 0.3, r3: 0.15 },
    locked: true,
  },
];

// ===== FILE END: apps/web/lib/games/reactionTapVariants.ts =====