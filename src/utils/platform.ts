import { isTauri } from "@tauri-apps/api/core";

let cachedIsWindows: boolean | null = null;
let cachedIsMac: boolean | null = null;

function getNavigatorPlatform(): string {
  if (!isTauri() || typeof navigator === "undefined") {
    return "";
  }
  return (
    (
      navigator as Navigator & {
        userAgentData?: { platform?: string };
      }
    ).userAgentData?.platform ??
    navigator.platform ??
    ""
  ).toLowerCase();
}

export function isWindowsPlatform(): boolean {
  if (cachedIsWindows !== null) {
    return cachedIsWindows;
  }
  try {
    cachedIsWindows = getNavigatorPlatform().includes("win");
  } catch {
    cachedIsWindows = false;
  }
  return cachedIsWindows;
}

export function isMacPlatform(): boolean {
  if (cachedIsMac !== null) {
    return cachedIsMac;
  }
  try {
    cachedIsMac = getNavigatorPlatform().includes("mac");
  } catch {
    cachedIsMac = false;
  }
  return cachedIsMac;
}

/**
 * Cold-start full-window click gate: all Tauri desktop shells (Win / macOS /
 * Linux). List full-catalog + early pointer freezes are not engine-specific.
 * Pure web / non-Tauri previews keep the gate off.
 */
export function isStartupGatePlatform(): boolean {
  try {
    return isTauri();
  } catch {
    return false;
  }
}
