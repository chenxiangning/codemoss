import type { SelectedAgentOption } from "../types";

function resolveThreadEngine(threadId: string): "claude" | "gemini" | "opencode" | "codex" | null {
  if (threadId.startsWith("claude:") || threadId.startsWith("claude-pending-")) {
    return "claude";
  }
  if (threadId.startsWith("gemini:") || threadId.startsWith("gemini-pending-")) {
    return "gemini";
  }
  if (threadId.startsWith("opencode:") || threadId.startsWith("opencode-pending-")) {
    return "opencode";
  }
  if (threadId.startsWith("codex:") || threadId.startsWith("codex-pending-")) {
    return "codex";
  }
  return null;
}

export function shouldApplyDraftAgentToThread(input: {
  candidate: SelectedAgentOption | null;
  shouldApplyDraftToNextThread: boolean;
  draftSelectedAgent: SelectedAgentOption | null;
  activeThreadId: string | null;
}): boolean {
  return Boolean(
    !input.candidate
      && input.shouldApplyDraftToNextThread
      && input.draftSelectedAgent
      && input.activeThreadId
      && input.activeThreadId.includes("-pending-"),
  );
}

export function shouldMigrateSelectedAgentBetweenThreadIds(input: {
  previousThreadId: string | null;
  activeThreadId: string | null;
  previousSessionKey: string | null;
  activeSessionKey: string | null;
  hasSourceSelection: boolean;
  hasTargetSelection: boolean;
  resolveCanonicalThreadId: (threadId: string) => string;
}): boolean {
  const {
    previousThreadId,
    activeThreadId,
    previousSessionKey,
    activeSessionKey,
    hasSourceSelection,
    hasTargetSelection,
    resolveCanonicalThreadId,
  } = input;

  const previousEngine = previousThreadId ? resolveThreadEngine(previousThreadId) : null;
  const activeEngine = activeThreadId ? resolveThreadEngine(activeThreadId) : null;
  const hasEngineMismatch =
    previousEngine !== null
      && activeEngine !== null
      && previousEngine !== activeEngine;
  const hasForwardFinalizeTransition = Boolean(
    previousThreadId
      && activeThreadId
      && previousThreadId.includes("-pending-")
      && !activeThreadId.includes("-pending-"),
  );
  const hasCanonicalMatch = Boolean(
    previousThreadId
      && activeThreadId
      && resolveCanonicalThreadId(previousThreadId)
        === resolveCanonicalThreadId(activeThreadId),
  );

  return Boolean(
    previousThreadId
      && activeThreadId
      && previousThreadId !== activeThreadId
      && previousSessionKey
      && activeSessionKey
      && hasSourceSelection
      && !hasTargetSelection
      && !hasEngineMismatch
      && (hasForwardFinalizeTransition || hasCanonicalMatch),
  );
}
