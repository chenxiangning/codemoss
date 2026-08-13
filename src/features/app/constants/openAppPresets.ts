import type { OpenAppHostPlatform } from "../utils/openAppPlatform";
import { getOpenAppHostPlatform } from "../utils/openAppPlatform";

export type OpenAppPresetKind = "app" | "command" | "finder";

export type OpenAppPresetDef = {
  id: string;
  label: string;
  kind: OpenAppPresetKind;
  /** Default app name / bundle / open -a name (mac) or display name (win). */
  appName?: string;
  command?: string;
  platforms: OpenAppHostPlatform[];
};

/**
 * Curated open-with presets. Detection is separate (lazy probe).
 * Keep this list small — not a full Applications index.
 */
export const OPEN_APP_PRESET_CATALOG: OpenAppPresetDef[] = [
  {
    id: "vscode",
    label: "VS Code",
    kind: "app",
    appName: "Visual Studio Code",
    platforms: ["macos", "windows", "linux"],
  },
  {
    id: "cursor",
    label: "Cursor",
    kind: "app",
    appName: "Cursor",
    platforms: ["macos", "windows", "linux"],
  },
  {
    id: "zed",
    label: "Zed",
    kind: "app",
    appName: "Zed",
    platforms: ["macos", "windows", "linux"],
  },
  {
    id: "sublime",
    label: "Sublime Text",
    kind: "app",
    appName: "Sublime Text",
    platforms: ["macos", "windows", "linux"],
  },
  {
    id: "ghostty",
    label: "Ghostty",
    kind: "app",
    appName: "Ghostty",
    platforms: ["macos", "linux"],
  },
  {
    id: "antigravity",
    label: "Antigravity",
    kind: "app",
    appName: "Antigravity",
    platforms: ["macos", "windows", "linux"],
  },
  {
    id: "notepad",
    label: "Notepad",
    kind: "app",
    appName: "notepad",
    platforms: ["windows"],
  },
  {
    id: "windows-terminal",
    label: "Windows Terminal",
    kind: "command",
    command: "wt.exe",
    platforms: ["windows"],
  },
  {
    id: "finder",
    label: "File Manager",
    kind: "finder",
    platforms: ["macos", "windows", "linux"],
  },
];

export function getOpenAppPresetsForHost(
  platform: OpenAppHostPlatform = getOpenAppHostPlatform(),
): OpenAppPresetDef[] {
  return OPEN_APP_PRESET_CATALOG.filter((preset) =>
    preset.platforms.includes(platform),
  );
}
