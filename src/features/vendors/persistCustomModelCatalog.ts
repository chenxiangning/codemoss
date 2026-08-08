import {
  updateClaudeProvider,
  updateCodexProvider,
} from "../../services/tauri";
import { buildProviderCustomModelsPatches } from "./customModelProviderBinding";
import type {
  CodexCustomModel,
  CodexProviderConfig,
  ProviderConfig,
} from "./types";
import { LOCAL_SETTINGS_PROVIDER_ID } from "./types";
import { notifyProviderTargetCatalogChanged } from "../composer/components/ChatInputBox/hooks/useProviderTargetCatalogOwners";

type PersistEngine = "claude" | "codex";

/**
 * Serial queue per engine so rapid add/edit/delete cannot reorder
 * full-replace provider writes (last completed older write would drop models).
 */
const persistChains = new Map<PersistEngine, Promise<void>>();

function enqueuePersist(
  engine: PersistEngine,
  task: () => Promise<void>,
): Promise<void> {
  const previous = persistChains.get(engine) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(task);
  // Keep chain alive after failures so later saves still serialize.
  persistChains.set(
    engine,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return fallback;
}

async function writeCodexPatches(
  nextModels: CodexCustomModel[],
  providers: readonly CodexProviderConfig[],
): Promise<void> {
  const patches = buildProviderCustomModelsPatches(providers, nextModels);
  for (const patch of patches) {
    const provider = providers.find((item) => item.id === patch.providerId);
    if (!provider) {
      continue;
    }
    await updateCodexProvider(patch.providerId, {
      ...provider,
      customModels:
        patch.customModels.length > 0 ? patch.customModels : undefined,
    });
  }
  if (patches.length > 0) {
    notifyProviderTargetCatalogChanged();
  }
}

async function writeClaudePatches(
  nextModels: CodexCustomModel[],
  providers: readonly ProviderConfig[],
): Promise<void> {
  const managed = providers.filter((provider) => {
    const id = provider.id.trim();
    if (!id || id === LOCAL_SETTINGS_PROVIDER_ID) {
      return false;
    }
    if (provider.isLocalProvider) {
      return false;
    }
    return true;
  });
  const patches = buildProviderCustomModelsPatches(managed, nextModels);
  for (const patch of patches) {
    const provider = managed.find((item) => item.id === patch.providerId);
    if (!provider) {
      continue;
    }
    await updateClaudeProvider(patch.providerId, {
      ...provider,
      customModels:
        patch.customModels.length > 0 ? patch.customModels : undefined,
    });
  }
  if (patches.length > 0) {
    notifyProviderTargetCatalogChanged();
  }
}

/**
 * Dual-write Codex custom models into managed provider profiles.
 * Catalog (localStorage) is updated by the caller first; this only patches providers.
 * Errors are thrown so UI can surface them without rolling back catalog silently mid-batch
 * (caller owns optimistic catalog; user can retry).
 */
export function persistCodexCustomModelCatalog(
  nextModels: CodexCustomModel[],
  providers: readonly CodexProviderConfig[],
): Promise<void> {
  return enqueuePersist("codex", async () => {
    try {
      await writeCodexPatches(nextModels, providers);
    } catch (error) {
      throw new Error(
        getErrorMessage(error, "Failed to sync Codex custom models to providers."),
      );
    }
  });
}

export function persistClaudeCustomModelCatalog(
  nextModels: CodexCustomModel[],
  providers: readonly ProviderConfig[],
): Promise<void> {
  return enqueuePersist("claude", async () => {
    try {
      await writeClaudePatches(nextModels, providers);
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          "Failed to sync Claude custom models to providers.",
        ),
      );
    }
  });
}

/** Test helper: wait for in-flight queues to settle. */
export function flushCustomModelPersistQueuesForTests(): Promise<void> {
  return Promise.all([
    persistChains.get("codex") ?? Promise.resolve(),
    persistChains.get("claude") ?? Promise.resolve(),
  ]).then(() => undefined);
}
