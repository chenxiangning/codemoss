const STORAGE_KEY = "ccgui.agentOrchestrationV1";

function parseFlag(value: string | null | undefined): boolean | null {
  if (value == null) return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "on", "yes"].includes(normalized)) return true;
  if (["0", "false", "off", "no"].includes(normalized)) return false;
  return null;
}

export function isMultiAgentEnabled(): boolean {
  if (typeof window !== "undefined") {
    try {
      const stored = parseFlag(window.localStorage.getItem(STORAGE_KEY));
      if (stored !== null) return stored;
      // 兼容旧 key
      const legacy = parseFlag(
        window.localStorage.getItem("ccgui.squadOrchestrationV1"),
      );
      if (legacy !== null) return legacy;
    } catch {
      // ignore storage failures
    }
  }
  return (
    parseFlag(import.meta.env.VITE_CCGUI_AGENT_ORCHESTRATION_V1) ??
    parseFlag(import.meta.env.VITE_CCGUI_SQUAD_ORCHESTRATION_V1) ??
    true
  );
}
