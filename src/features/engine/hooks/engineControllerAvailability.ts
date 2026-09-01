import type { EngineStatus, EngineType } from "../../../types";
import { isEngineExecutionEnabled } from "../../../utils/engineExecutionPolicy";
import {
  BUILTIN_ENGINE_TYPES,
  getEngineRegistryEntry,
} from "../engineRegistry";

export type EngineDisplayInfo = {
  type: EngineType;
  displayName: string;
  shortName: string;
  installed: boolean;
  version: string | null;
  error: string | null;
  availabilityState?:
    | "loading"
    | "ready"
    | "requires-login"
    | "unavailable"
    | "failed";
  availabilityLabelKey?: string | null;
};

export const ENABLED_ENGINE_TYPES: readonly EngineType[] = Object.freeze(
  BUILTIN_ENGINE_TYPES.filter((engineType) =>
    isEngineExecutionEnabled(engineType),
  ),
);

/** All registered engines stay visible; execution policy is enforced separately. */
export const DISPLAY_ENGINE_TYPES: readonly EngineType[] = Object.freeze(
  [...BUILTIN_ENGINE_TYPES],
);

export function buildAvailableEngines(
  engineStatuses: readonly EngineStatus[],
  isInitialized: boolean,
  detectFailed = false,
): EngineDisplayInfo[] {
  return DISPLAY_ENGINE_TYPES.map((engineType) => {
    const status =
      engineStatuses.find((entry) => entry.engineType === engineType) ?? null;
    const registryEntry = getEngineRegistryEntry(engineType);
    let availabilityState: EngineDisplayInfo["availabilityState"] =
      "unavailable";
    let availabilityLabelKey: string | null = "sidebar.cliNotInstalled";
    const executionEnabled = isEngineExecutionEnabled(engineType);

    if (!isInitialized) {
      availabilityState = "loading";
      availabilityLabelKey = "workspace.engineStatusLoading";
    } else if (!executionEnabled) {
      // Registry visibility must not imply runtime permission. Gemini remains
      // policy-disabled; OMP is executable through its ACP/native path.
      availabilityState = "unavailable";
      availabilityLabelKey = "workspace.engineComingSoon";
    } else if (detectFailed) {
      // B5：检测失败/超时 MUST 落 failed 态（「检测中」不得永久停留），
      // 重试成功后由 controller 清除 detectFailed 恢复 ready。
      availabilityState = "failed";
      availabilityLabelKey = "workspace.engineStatusFailed";
    } else if (status?.installed && status.authState === "requires_login") {
      // B6：登录态二段式——已安装但 phase 2 探测确认未登录。
      availabilityState = "requires-login";
      availabilityLabelKey = "workspace.engineStatusRequiresLogin";
    } else if (status?.installed) {
      availabilityState = "ready";
      availabilityLabelKey = null;
    }

    return {
      type: engineType,
      displayName: registryEntry?.displayName ?? engineType,
      shortName: registryEntry?.shortName ?? engineType,
      installed: executionEnabled && (status?.installed ?? false),
      version:
        !executionEnabled || availabilityState === "loading"
          ? null
          : (status?.version ?? null),
      error: status?.error ?? null,
      availabilityState,
      availabilityLabelKey,
    };
  });
}
