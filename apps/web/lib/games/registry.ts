// ===== FILE START: apps/web/lib/games/registry.ts =====

import type { RegisteredGame } from "./types";

export const GAMES_REGISTRY: Record<string, RegisteredGame> = {
  "reaction-tap": {
    id: "reaction-tap",
    title: "Reaction Tap",
    icon: "🎯",
    href: "/games/reaction-tap",
    subtitle: "Tap-fast skill game",
    theme: "violet",
        routes: {
      modesHref: "/games/reaction-tap/modes",
      practiceHref: "/games/reaction-tap/play",
      cashHref: "/games/reaction-tap/play",
    },
  },

  "block-puzzle": {
    id: "block-puzzle",
    title: "Block Puzzle",
    icon: "🧩",
    href: "/games/block-puzzle",
    subtitle: "Block Blast-style puzzle",
    theme: "blue",
        routes: {
      modesHref: "/games/block-puzzle/modes",
      practiceHref: "/games/block-puzzle/play",
      cashHref: "/games/block-puzzle/play",
    },
  },

  bingo: {
    id: "bingo",
    title: "Bingo",
    icon: "🎱",
    href: "/games/bingo",
    subtitle: "Fast bingo brawl",
    theme: "green",
        routes: {
      modesHref: "/games/bingo/modes",
      practiceHref: "/games/bingo/play",
      cashHref: "/games/bingo/play",
    },
  },

  blackjack: {
    id: "blackjack",
    title: "21 Blackjack",
    icon: "🃏",
    href: "/games/blackjack",
    subtitle: "Fast 21 stack duel",
    theme: "blue",
        routes: {
      modesHref: "/games/blackjack/modes",
      practiceHref: "/games/blackjack/play",
      cashHref: "/games/blackjack/play",
    },
  },

      "match-3-rush": {
    id: "match-3-rush",
    title: "Match 3 Rush",
    icon: "💎",
    href: "/games/match-3-rush",
    subtitle: "Fast match-3 battle",
    theme: "pink",
    routes: {
      modesHref: "/games/match-3-rush/modes",
      practiceHref: "/games/match-3-rush/play",
      cashHref: "/games/match-3-rush/play",
    },
  },

  solitaire: {
    id: "solitaire",
    title: "Solitaire",
    icon: "🃏",
    href: "/games/solitaire",
    subtitle: "Coming soon",
    requiresLevel: 6,
    theme: "gold",
    routes: {
      modesHref: "/games/solitaire",
      practiceHref: "/games/solitaire",
      cashHref: "/games/solitaire",
    },
  },

  "tile-match": {
    id: "tile-match",
    title: "Tile Match",
    icon: "🧱",
    href: "/games/tile-match",
    subtitle: "Coming soon",
    requiresLevel: 6,
    theme: "pink",
    routes: {
      modesHref: "/games/tile-match",
      practiceHref: "/games/tile-match",
      cashHref: "/games/tile-match",
    },
  },
};

export function getGameMeta(gameId: string | null | undefined): RegisteredGame {
  const key = String(gameId || "").trim().toLowerCase();

  if (key && GAMES_REGISTRY[key]) {
    return GAMES_REGISTRY[key];
  }

  return {
    id: key || "unknown",
    title: "Unknown Game",
    icon: "🕹️",
    href: "/games",
    subtitle: "Unknown game",
    theme: "violet",
    routes: {
      modesHref: "/games",
      practiceHref: "/games",
      cashHref: "/games",
    },
  };
}

export function listGamesMeta(): RegisteredGame[] {
  return Object.values(GAMES_REGISTRY);
}

// ===== FILE END: apps/web/lib/games/registry.ts =====