/**
 * Claude custom model facts from localStorage.
 *
 * providerProfileId is optional provenance for managed-provider-owned customs.
 * It MUST NOT be invented when absent — open-session / Shared hydrate and
 * Native create still treat missing ownership as unbound (see
 * useAppShellComposerModelSection: Claude resolvedProviderProfileId stays null
 * from model pick; session target remains thread/snapshot authority).
 */
export type ClaudeCustomModelFact = {
  id: string;
  model: string;
  label: string;
  description?: string;
  /** Optional managed-provider ownership; omit/undefined = local/unscoped. */
  providerProfileId?: string;
  source: "custom";
  catalogSource: "configured";
  provider: string;
  protocol: "anthropic-messages";
  provenance: "local-storage:claude-custom-models";
};

export function normalizeClaudeCustomModels(input: unknown): ClaudeCustomModelFact[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const seenIds = new Set<string>();
  const models: ClaudeCustomModelFact[] = [];

  for (const entry of input) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const idValue = (entry as { id?: unknown }).id;
    if (typeof idValue !== "string") {
      continue;
    }
    const id = idValue.trim();
    if (!id || seenIds.has(id)) {
      continue;
    }

    const labelValue = (entry as { label?: unknown }).label;
    const descriptionValue = (entry as { description?: unknown }).description;
    const providerProfileRaw = (entry as { providerProfileId?: unknown })
      .providerProfileId;
    const label =
      typeof labelValue === "string" && labelValue.trim().length > 0
        ? labelValue.trim()
        : id;
    const description =
      typeof descriptionValue === "string" && descriptionValue.trim().length > 0
        ? descriptionValue.trim()
        : undefined;
    const providerProfileId =
      typeof providerProfileRaw === "string" && providerProfileRaw.trim().length > 0
        ? providerProfileRaw.trim()
        : undefined;

    models.push({
      id,
      model: id,
      label,
      description,
      ...(providerProfileId ? { providerProfileId } : {}),
      source: "custom",
      catalogSource: "configured",
      provider: "anthropic",
      protocol: "anthropic-messages",
      provenance: "local-storage:claude-custom-models",
    });
    seenIds.add(id);
  }

  return models;
}

export function readClaudeCustomModelsFromStorage(storageKey: string): ClaudeCustomModelFact[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return [];
    }
    return normalizeClaudeCustomModels(JSON.parse(stored));
  } catch {
    return [];
  }
}
