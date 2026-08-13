import { isMacPlatform, isWindowsPlatform } from "../../../utils/platform";

export type OpenAppHostPlatform = "macos" | "windows" | "linux";

export function getOpenAppHostPlatform(): OpenAppHostPlatform {
  if (isWindowsPlatform()) {
    return "windows";
  }
  if (isMacPlatform()) {
    return "macos";
  }
  return "linux";
}

/** i18n key for the platform file manager type label. */
export function fileManagerTypeI18nKey(
  platform: OpenAppHostPlatform = getOpenAppHostPlatform(),
): string {
  if (platform === "windows") {
    return "settings.typeFileManagerWindows";
  }
  if (platform === "macos") {
    return "settings.typeFileManagerMac";
  }
  return "settings.typeFileManagerLinux";
}

export function looksLikeAbsoluteAppPath(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return false;
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("~")) {
    return true;
  }
  // Windows drive path or UNC
  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith("\\\\")) {
    return true;
  }
  return trimmed.endsWith(".app") && trimmed.includes("/");
}

export function basenameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? path;
  return last.replace(/\.app$/i, "").replace(/\.exe$/i, "");
}
