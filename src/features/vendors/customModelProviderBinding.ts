import type { CodexCustomModel } from "./types";

/** UI / form sentinel: local configuration (no managed provider). */
export const LOCAL_CUSTOM_MODEL_PROVIDER_OPTION_ID = "";

export type CustomModelProviderOption = {
  id: string;
  name: string;
};

export type ProviderCustomModelsOwner = {
  id: string;
  customModels?: CodexCustomModel[];
};

/** Strip catalog-only fields before writing into provider.customModels. */
export function toProviderStoredCustomModel(
  model: CodexCustomModel,
): CodexCustomModel {
  const id = model.id.trim();
  const label = model.label?.trim() || id;
  const description = model.description?.trim();
  return {
    id,
    label,
    description:
      description && description.length > 0 ? description : undefined,
  };
}

export function normalizeProviderProfileId(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === LOCAL_CUSTOM_MODEL_PROVIDER_OPTION_ID) {
    return null;
  }
  return trimmed;
}

export function resolveDefaultProviderOptionId(
  options: readonly CustomModelProviderOption[],
  preferredProviderProfileId?: string | null,
  activeProviderProfileId?: string | null,
): string {
  const preferred = normalizeProviderProfileId(preferredProviderProfileId);
  if (preferred && options.some((option) => option.id === preferred)) {
    return preferred;
  }
  const active = normalizeProviderProfileId(activeProviderProfileId);
  if (active && options.some((option) => option.id === active)) {
    return active;
  }
  return LOCAL_CUSTOM_MODEL_PROVIDER_OPTION_ID;
}

function stableModelKey(model: CodexCustomModel): string {
  return [
    model.id.trim(),
    (model.label ?? "").trim(),
    (model.description ?? "").trim(),
  ].join("\u0000");
}

function sortedStableKeys(models: readonly CodexCustomModel[]): string[] {
  return models.map(stableModelKey).sort();
}

export function providerCustomModelsEqual(
  left: readonly CodexCustomModel[] | undefined,
  right: readonly CodexCustomModel[] | undefined,
): boolean {
  const a = sortedStableKeys(left ?? []);
  const b = sortedStableKeys(right ?? []);
  if (a.length !== b.length) {
    return false;
  }
  return a.every((key, index) => key === b[index]);
}

/**
 * For each managed provider, compute desired customModels from the engine catalog.
 * Returns only providers whose stored list differs.
 */
export function buildProviderCustomModelsPatches(
  providers: readonly ProviderCustomModelsOwner[],
  nextCatalogModels: readonly CodexCustomModel[],
): Array<{ providerId: string; customModels: CodexCustomModel[] }> {
  const patches: Array<{ providerId: string; customModels: CodexCustomModel[] }> =
    [];

  for (const provider of providers) {
    const providerId = provider.id.trim();
    if (!providerId) {
      continue;
    }
    const desired = nextCatalogModels
      .filter(
        (model) =>
          normalizeProviderProfileId(model.providerProfileId) === providerId,
      )
      .map(toProviderStoredCustomModel);
    if (providerCustomModelsEqual(provider.customModels, desired)) {
      continue;
    }
    patches.push({ providerId, customModels: desired });
  }

  return patches;
}

export function buildManagedProviderOptions(
  providers: readonly {
    id: string;
    name: string;
    isLocalProvider?: boolean;
    isLocal?: boolean;
  }[],
  localOptionLabel: string,
  localProviderIds: readonly string[] = [],
): CustomModelProviderOption[] {
  const localIdSet = new Set(
    localProviderIds.map((id) => id.trim()).filter(Boolean),
  );
  const managed = providers
    .filter((provider) => {
      const id = provider.id.trim();
      if (!id) {
        return false;
      }
      if (provider.isLocalProvider || provider.isLocal) {
        return false;
      }
      if (localIdSet.has(id)) {
        return false;
      }
      return true;
    })
    .map((provider) => ({
      id: provider.id.trim(),
      name: provider.name.trim() || provider.id.trim(),
    }));

  return [
    { id: LOCAL_CUSTOM_MODEL_PROVIDER_OPTION_ID, name: localOptionLabel },
    ...managed,
  ];
}

export function providerDisplayName(
  providerProfileId: string | null | undefined,
  nameById: ReadonlyMap<string, string>,
  localLabel: string,
): string {
  const id = normalizeProviderProfileId(providerProfileId);
  if (!id) {
    return localLabel;
  }
  return nameById.get(id) ?? id;
}
