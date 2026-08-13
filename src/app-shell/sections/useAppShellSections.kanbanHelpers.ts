import type { ComposerSessionSelection } from "../domains/selectedComposerSession";

const KANBAN_TAG_REGEX = /&@[^\s]+/g;

export function stripComposerKanbanTagsPreserveFormatting(text: string): string {
  if (!text || !text.includes("&@")) {
    return text;
  }
  const stripped = text.replace(KANBAN_TAG_REGEX, "");
  return stripped
    .replace(/[ \t]+(\r?\n)/g, "$1")
    .replace(/(\r?\n)[ \t]+/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function resolveTaskThreadId(
  threadId: string | null | undefined,
  resolveCanonicalThreadId?: ((threadId: string) => string) | null,
): string | null {
  if (!threadId) {
    return null;
  }
  if (!resolveCanonicalThreadId) {
    return threadId;
  }
  const canonical = resolveCanonicalThreadId(threadId);
  return canonical || threadId;
}

export function resolvePendingSessionThreadCandidate(params: {
  pendingThreadId: string;
  workspaceThreadIds: string[];
  occupiedThreadIds: Set<string>;
}): string | null {
  const isClaudePending = params.pendingThreadId.startsWith("claude-pending-");
  const isOpenCodePending = params.pendingThreadId.startsWith("opencode-pending-");
  if (!isClaudePending && !isOpenCodePending) {
    return null;
  }
  const sessionPrefix = isClaudePending ? "claude:" : "opencode:";
  const candidates = params.workspaceThreadIds.filter(
    (threadId) =>
      threadId.startsWith(sessionPrefix) &&
      !params.occupiedThreadIds.has(threadId),
  );
  return candidates.length === 1 ? candidates[0] : null;
}

export function shouldSyncComposerEngineForKanbanExecution(params: {
  activate?: boolean;
}): boolean {
  return params.activate !== false;
}

export async function syncKanbanExecutionEngineAndModel(params: {
  activate?: boolean;
  engine: "claude" | "codex";
  modelId?: string | null;
  setActiveEngine: (engine: "claude" | "codex") => Promise<void> | void;
}): Promise<{
  shouldSyncComposerSelection: boolean;
  outboundModel?: string;
  composerSelection: ComposerSessionSelection | null;
}> {
  const shouldSyncComposerSelection = shouldSyncComposerEngineForKanbanExecution({
    activate: params.activate,
  });
  if (shouldSyncComposerSelection) {
    await params.setActiveEngine(params.engine);
  }
  if (!params.modelId) {
    return {
      shouldSyncComposerSelection,
      outboundModel: undefined,
      composerSelection: null,
    };
  }
  if (!shouldSyncComposerSelection) {
    return {
      shouldSyncComposerSelection,
      outboundModel: params.modelId,
      composerSelection: null,
    };
  }
  return {
    shouldSyncComposerSelection,
    outboundModel: undefined,
    composerSelection: {
      modelId: params.modelId,
      effort: null,
    },
  };
}

export function isRewindSupportedThreadId(threadId: string): boolean {
  const normalized = threadId.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized.startsWith("claude:") || normalized.startsWith("codex:")) {
    return true;
  }
  if (
    normalized.startsWith("claude-pending-") ||
    normalized.startsWith("codex-pending-") ||
    normalized.startsWith("gemini:") ||
    normalized.startsWith("gemini-pending-") ||
    normalized.startsWith("grok:") ||
    normalized.startsWith("grok-pending-") ||
    normalized.startsWith("kimi:") ||
    normalized.startsWith("kimi-pending-") ||
    normalized.startsWith("opencode:") ||
    normalized.startsWith("opencode-pending-")
  ) {
    return false;
  }
  if (normalized.includes(":")) {
    return false;
  }
  return true;
}
