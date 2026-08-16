import {
  getClaudeProviders,
  switchClaudeProvider,
  switchCodexProvider,
  switchGrokProvider,
  switchKimiProvider,
  switchOpenCodeProvider,
} from "../../services/tauri";
import { syncModelMappingFromProviderEnv } from "@mossx/plugin-models/runtime";
import {
  CLAUDE_LOCAL_PROVIDER_PROFILE_ID,
  CODEX_DISK_PROVIDER_PROFILE_ID,
} from "../threads/constants/codexProviderProfiles";
import { dispatchVendorActiveProviderChanged } from "./vendorActiveProviderEvents";

export type ActivatableProviderEngine =
  | "claude"
  | "codex"
  | "kimi"
  | "grok"
  | "opencode";

/**
 * 把 Claude 模型选择器的 ANTHROPIC_* 映射切到指定 profile 的 env。
 * 不依赖设置页是否挂载；会话切换/菜单启用/续接后必须调用。
 */
export async function syncClaudeModelMappingForProfile(
  profileId: string,
): Promise<void> {
  const list = await getClaudeProviders();
  const provider =
    list.find((entry) => entry.id === profileId) ??
    (profileId === CLAUDE_LOCAL_PROVIDER_PROFILE_ID
      ? list.find(
          (entry) =>
            entry.id === CLAUDE_LOCAL_PROVIDER_PROFILE_ID ||
            Boolean(entry.isLocalProvider),
        )
      : undefined);
  const env = provider?.settingsConfig?.env as
    | Record<string, unknown>
    | undefined;
  syncModelMappingFromProviderEnv(env);
}

/**
 * L1 启用启动（current-only，Claude managed 不盖写 ~/.claude/settings.json）。
 * 会话发送仍以 thread.providerProfileId（L2）为准。
 */
export async function activateEngineProviderProfile(
  engine: ActivatableProviderEngine,
  profileId: string,
): Promise<void> {
  const normalized = profileId.trim();
  if (!normalized) {
    return;
  }
  // Codex 本地磁盘 sentinel 不在 managed providers map 里，switch 会 not found。
  if (engine === "codex" && normalized === CODEX_DISK_PROVIDER_PROFILE_ID) {
    return;
  }
  if (engine === "claude") {
    await switchClaudeProvider(normalized);
    await syncClaudeModelMappingForProfile(normalized);
    return;
  }
  if (engine === "codex") {
    await switchCodexProvider(normalized);
    return;
  }
  if (engine === "kimi") {
    await switchKimiProvider(normalized);
    return;
  }
  if (engine === "grok") {
    await switchGrokProvider(normalized);
    return;
  }
  await switchOpenCodeProvider(normalized);
}

export async function activateEngineProviderProfileAndNotify(
  engine: ActivatableProviderEngine,
  profileId: string,
): Promise<void> {
  await activateEngineProviderProfile(engine, profileId);
  dispatchVendorActiveProviderChanged({
    engine,
    providerProfileId: profileId.trim(),
  });
}

export function isActivatableProviderEngine(
  engine: string | null | undefined,
): engine is ActivatableProviderEngine {
  return (
    engine === "claude" ||
    engine === "codex" ||
    engine === "kimi" ||
    engine === "grok" ||
    engine === "opencode"
  );
}
