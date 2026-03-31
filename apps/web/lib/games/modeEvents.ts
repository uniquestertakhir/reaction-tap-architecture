// ===== FILE START: apps/web/lib/games/modeEvents.ts =====

import type { PlatformModeTemplateId } from "@/lib/games/modeTemplates";

export type PlatformModeEvent = {
  id: string;
  title: string;

  // which templates are affected
  templateIds: PlatformModeTemplateId[];

  // optional overrides
  subtitle?: string;
  entryFeeMultiplier?: number;
  prizePoolMultiplier?: number;

  // promo flags
  limited?: boolean;
  durationMs?: number;
};

export const ACTIVE_MODE_EVENTS: PlatformModeEvent[] = [
  {
    id: "weekly-starter-rush",
    title: "Weekly Starter Rush",
    templateIds: ["cash-starter"],
    subtitle: "Weekly event",
    entryFeeMultiplier: 0.5,
    prizePoolMultiplier: 1,
    limited: true,
    durationMs: 7 * 24 * 60 * 60 * 1000,
  },
];

export function getActiveModeEvents(): PlatformModeEvent[] {
  return ACTIVE_MODE_EVENTS;
}

// ===== FILE END: apps/web/lib/games/modeEvents.ts =====