import type { EngineType } from "../../../types";
import { CLAUDE_PRICING_FIXTURES } from "./fixtures/claude";
import { CODEX_PRICING_FIXTURES } from "./fixtures/codex";
import { GEMINI_PRICING_FIXTURES } from "./fixtures/gemini";
import { OPENCODE_PRICING_FIXTURES } from "./fixtures/opencode";
import {
  DEFAULT_PRICING_STALENESS_THRESHOLD_DAYS,
  type PricingSource,
} from "./pricingTypes";

export const ENGINE_PRICING_FIXTURES = {
  claude: CLAUDE_PRICING_FIXTURES,
  codex: CODEX_PRICING_FIXTURES,
  gemini: GEMINI_PRICING_FIXTURES,
  opencode: OPENCODE_PRICING_FIXTURES,
} as const satisfies Record<EngineType, readonly PricingSource[]>;

export const DEFAULT_PRICING_SOURCES = Object.values(ENGINE_PRICING_FIXTURES)
  .flat();

function normalizeModelId(model: string): string {
  return model.trim().toLowerCase();
}

function modelMatches(source: PricingSource, model: string): boolean {
  const normalized = normalizeModelId(model);
  if (normalizeModelId(source.model) === normalized) {
    return true;
  }
  return source.aliases?.some((alias) => normalizeModelId(alias) === normalized) ?? false;
}

export function lookupPricingSource(
  engine: EngineType,
  model: string | null | undefined,
  sources: readonly PricingSource[] = DEFAULT_PRICING_SOURCES,
): PricingSource | null {
  const normalizedModel = model?.trim();
  if (!normalizedModel) {
    return null;
  }
  return sources.find((source) => source.engine === engine && modelMatches(source, normalizedModel)) ?? null;
}

export function isPricingSourceStale(
  source: PricingSource,
  now: Date = new Date(),
): boolean {
  const updatedAt = new Date(source.lastUpdatedAt);
  if (Number.isNaN(updatedAt.getTime())) {
    return true;
  }
  const thresholdDays =
    source.stalenessThresholdDays ?? DEFAULT_PRICING_STALENESS_THRESHOLD_DAYS;
  const staleAfterMs = thresholdDays * 24 * 60 * 60 * 1000;
  return now.getTime() - updatedAt.getTime() > staleAfterMs;
}
