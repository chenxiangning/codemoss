import type { OpenAppTarget } from "../../../types";
import { looksLikeAbsoluteAppPath } from "./openAppPlatform";

export type OpenAppHealth = "ok" | "missing" | "broken" | "unknown";

export type OpenAppPresetProbe = {
  id: string;
  installed: boolean;
  resolvedPath?: string | null;
};

export type OpenAppTargetHealthEntry = {
  status: OpenAppHealth;
  resolvedPath?: string | null;
};

function normalizeProbeStatus(status: string | undefined, installed: boolean): OpenAppHealth {
  if (status === "ok" || status === "missing" || status === "broken") {
    return status;
  }
  return installed ? "ok" : "unknown";
}

/**
 * Resolve health using:
 * 1) per-target probe map (absolute paths / re-verify)
 * 2) curated preset probe map
 * 3) structural fallbacks
 */
export function resolveOpenAppHealth(
  target: Pick<OpenAppTarget, "id" | "kind" | "appName" | "command">,
  probeById: Record<string, OpenAppPresetProbe>,
  targetHealthById: Record<string, OpenAppTargetHealthEntry> = {},
): OpenAppHealth {
  const targetProbe = targetHealthById[target.id];
  if (targetProbe?.status) {
    return targetProbe.status;
  }

  if (target.kind === "finder") {
    return "ok";
  }
  if (target.kind === "command") {
    return target.command?.trim() ? "unknown" : "broken";
  }

  const appName = target.appName?.trim() ?? "";
  if (!appName) {
    return "broken";
  }

  const byId = probeById[target.id];
  if (byId) {
    return byId.installed ? "ok" : "missing";
  }

  // Match probe by known preset resolved path / name heuristics
  const byName = Object.values(probeById).find((probe) => {
    const resolved = probe.resolvedPath?.trim();
    if (!resolved) {
      return false;
    }
    return (
      resolved === appName ||
      resolved.endsWith(appName) ||
      appName.endsWith(resolved) ||
      resolved.toLowerCase().includes(appName.toLowerCase()) ||
      appName.toLowerCase().includes(resolved.toLowerCase())
    );
  });
  if (byName) {
    return byName.installed ? "ok" : "missing";
  }

  if (looksLikeAbsoluteAppPath(appName)) {
    // Absolute path needs explicit probe (auto or click-to-refresh).
    return "unknown";
  }

  return "unknown";
}

export function healthFromTargetProbe(result: {
  status?: string;
  installed?: boolean;
}): OpenAppHealth {
  return normalizeProbeStatus(result.status, Boolean(result.installed));
}
