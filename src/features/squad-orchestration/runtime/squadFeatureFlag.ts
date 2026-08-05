const STORAGE_KEY = "ccgui.squadOrchestrationV1";

function parseFlag(value: string | null | undefined): boolean | null {
  if (value == null) return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "on", "yes"].includes(normalized)) return true;
  if (["0", "false", "off", "no"].includes(normalized)) return false;
  return null;
}

export function isSquadOrchestrationEnabled(): boolean {
  if (typeof window !== "undefined") {
    try {
      const stored = parseFlag(window.localStorage.getItem(STORAGE_KEY));
      if (stored !== null) return stored;
    } catch {
      // Storage may be unavailable in hardened webviews; build/default flag still applies.
    }
  }
  return parseFlag(import.meta.env.VITE_CCGUI_SQUAD_ORCHESTRATION_V1) ?? true;
}
