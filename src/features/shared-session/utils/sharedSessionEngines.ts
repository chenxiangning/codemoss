import type { EngineType } from "../../../types";

export type SharedSessionSupportedEngine =
  | "claude"
  | "codex"
  | "kimi"
  | "grok"
  | "opencode"
  | "pi";

const SHARED_SESSION_SUPPORTED_ENGINES = new Set<EngineType>([
  "claude",
  "codex",
  "kimi",
  "grok",
  "opencode",
  "pi",
]);

export function isSharedSessionSupportedEngine(
  engine: EngineType | null | undefined,
): engine is SharedSessionSupportedEngine {
  return Boolean(engine && SHARED_SESSION_SUPPORTED_ENGINES.has(engine));
}

export function normalizeSharedSessionEngine(
  engine: EngineType | null | undefined,
): SharedSessionSupportedEngine {
  return isSharedSessionSupportedEngine(engine) ? engine : "claude";
}
