// ===== FILE START: apps/web/lib/games/resolveGameModes.ts =====

import { getGameModeTemplateIds } from "@/lib/games/gameModeTemplateMap";
import { getModeTemplate } from "@/lib/games/modeTemplates";
import {
  getGameModeTemplateOverrides,
  type GameModeTemplateOverride,
} from "@/lib/games/gameModeTemplateOverrides";
import { getActiveModeEvents } from "@/lib/games/modeEvents";
import type { GameMode } from "@/lib/games/catalog";

function buildModeId(gameId: string, templateId: string) {
  return `${gameId}-${templateId}`;
}

function buildModeSlug(templateId: string) {
  switch (templateId) {
    case "cash-starter":
      return "starter";
    case "cash-standard":
      return "standard";
    case "cash-high":
      return "high";
    case "cash-apex":
      return "apex";
    case "cash-bold":
      return "bold";
    case "practice-warmup":
      return "warm-up";
    case "practice-medium":
      return "practice-medium";
    case "practice-high":
      return "practice-high";
    default:
      return templateId;
  }
}

function findOverride(
  overrides: GameModeTemplateOverride[],
  templateId: string
) {
  return overrides.find((item) => item.templateId === templateId) || null;
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

export function resolveGameModes(gameId: string): GameMode[] {
  const gid = String(gameId || "").trim().toLowerCase();
  const templateIds = getGameModeTemplateIds(gid);
  const overrides = getGameModeTemplateOverrides(gid);
  const events = getActiveModeEvents();

  return templateIds.map((templateId) => {
    const tpl = getModeTemplate(templateId);
    const override = findOverride(overrides, templateId);
    const event = events.find((item) => item.templateIds.includes(tpl.id)) || null;

    const baseEntryFee = override?.entryFee ?? tpl.entryFee;
    const basePrizePool = override?.prizePool ?? tpl.prizePool;

    const finalEntryFee = event?.entryFeeMultiplier
      ? roundMoney(baseEntryFee * event.entryFeeMultiplier)
      : baseEntryFee;

    const finalPrizePool = event?.prizePoolMultiplier
      ? roundMoney(basePrizePool * event.prizePoolMultiplier)
      : basePrizePool;

    return {
      id: override?.modeId || buildModeId(gid, tpl.id),
      mode: override?.mode || buildModeSlug(tpl.id),
      title: override?.title || tpl.title,
      subtitle: event?.subtitle || override?.subtitle || tpl.subtitle,
      players: override?.players ?? tpl.players,
      playersText: override?.playersText ?? tpl.playersText,
      currency: tpl.currency,
      entryFee: finalEntryFee,
      prizePool: finalPrizePool,
      limited: event?.limited ?? override?.limited ?? tpl.limited,
      durationMs: event?.durationMs ?? override?.durationMs ?? tpl.durationMs,
      requiresLevel: override?.requiresLevel ?? tpl.requiresLevel,
    };
  });
}

// ===== FILE END: apps/web/lib/games/resolveGameModes.ts =====