import type { AppSettings, OpenAppTarget } from "../../../types";
import { DEFAULT_OPEN_APP_ID } from "../constants";
import { getClientStoreSync } from "../../../services/clientStorage";
import { openWorkspaceIn, revealInFileManager } from "../../../services/tauri";

export async function openPathInTarget(
  path: string,
  target: OpenAppTarget,
): Promise<void> {
  if (target.kind === "finder") {
    await revealInFileManager(path);
    return;
  }
  if (target.kind === "command") {
    if (!target.command) {
      return;
    }
    await openWorkspaceIn(path, {
      command: target.command,
      args: target.args,
    });
    return;
  }
  const appName = target.appName || target.label;
  if (!appName) {
    return;
  }
  await openWorkspaceIn(path, { appName, args: target.args });
}

export function normalizeOpenAppTargets(targets: OpenAppTarget[]): OpenAppTarget[] {
  return targets
    .map((target) => ({
      ...target,
      label: target.label.trim(),
      appName: (target.appName?.trim() ?? "") || null,
      command: (target.command?.trim() ?? "") || null,
      args: Array.isArray(target.args) ? target.args.map((arg) => arg.trim()) : [],
    }))
    .filter((target) => target.label && target.id);
}

export function getOpenAppTargets(settings: AppSettings): OpenAppTarget[] {
  return normalizeOpenAppTargets(settings.openAppTargets ?? []);
}

export function getSelectedOpenAppId(settings: AppSettings): string {
  const targets = getOpenAppTargets(settings);
  const selected =
    settings.selectedOpenAppId ||
    getClientStoreSync<string>("app", "openWorkspaceApp") ||
    DEFAULT_OPEN_APP_ID;
  return targets.some((target) => target.id === selected)
    ? selected
    : targets[0]?.id ?? DEFAULT_OPEN_APP_ID;
}
