// ===== FILE START: apps/web/lib/games/modeTemplates.ts =====

export type PlatformModeTemplateId =
  | "cash-starter"
  | "cash-standard"
  | "cash-high"
  | "cash-apex"
  | "cash-bold"
  | "practice-warmup"
  | "practice-medium"
  | "practice-high";

export type PlatformModeTemplate = {
  id: PlatformModeTemplateId;

  // UI
  title: string;
  subtitle: string;

  // economy
  currency: "cash" | "gems";
  entryFee: number;
  prizePool: number;

  // multiplayer / solo
  players: number;
  playersText?: string;

  // platform promo / event flags
  limited?: boolean;
  durationMs?: number;

  // optional progression
  requiresLevel?: number;
};

export const PLATFORM_MODE_TEMPLATES: Record<
  PlatformModeTemplateId,
  PlatformModeTemplate
> = {
  "cash-starter": {
    id: "cash-starter",
    title: "Starter Clash",
    subtitle: "Limited time only!",
    currency: "cash",
    entryFee: 0.3,
    prizePool: 0.55,
    players: 2,
    playersText: "2 PLAYERS",
    limited: true,
    durationMs: 6 * 60 * 60 * 1000,
  },

  "cash-standard": {
    id: "cash-standard",
    title: "Quick Cash",
    subtitle: "Real match",
    currency: "cash",
    entryFee: 1,
    prizePool: 1.8,
    players: 2,
    playersText: "2 PLAYERS",
  },

  "cash-high": {
    id: "cash-high",
    title: "High Stakes",
    subtitle: "Real match",
    currency: "cash",
    entryFee: 3,
    prizePool: 5.4,
    players: 2,
    playersText: "2 PLAYERS",
    requiresLevel: 6,
  },

  "cash-apex": {
    id: "cash-apex",
    title: "Apex Clash",
    subtitle: "Real match",
    currency: "cash",
    entryFee: 5,
    prizePool: 9,
    players: 2,
    playersText: "2 PLAYERS",
  },

  "cash-bold": {
    id: "cash-bold",
    title: "Bold Clash",
    subtitle: "Real match",
    currency: "cash",
    entryFee: 10,
    prizePool: 18,
    players: 2,
    playersText: "2 PLAYERS",
  },

  "practice-warmup": {
    id: "practice-warmup",
    title: "Warm up",
    subtitle: "Practice-style",
    currency: "gems",
    entryFee: 50,
    prizePool: 120,
    players: 1,
  },

  "practice-medium": {
    id: "practice-medium",
    title: "Speed Builder",
    subtitle: "Practice-style",
    currency: "gems",
    entryFee: 200,
    prizePool: 420,
    players: 1,
  },

  "practice-high": {
    id: "practice-high",
    title: "Board Master",
    subtitle: "Practice-style",
    currency: "gems",
    entryFee: 500,
    prizePool: 1050,
    players: 1,
  },
};

export function getModeTemplate(
  templateId: PlatformModeTemplateId
): PlatformModeTemplate {
  return PLATFORM_MODE_TEMPLATES[templateId];
}

export function listModeTemplates(): PlatformModeTemplate[] {
  return Object.values(PLATFORM_MODE_TEMPLATES);
}

// ===== FILE END: apps/web/lib/games/modeTemplates.ts =====