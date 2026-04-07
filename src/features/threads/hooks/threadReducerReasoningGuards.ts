type ReasoningGuardState = {
  activeTurnIdByThread: Record<string, string | null | undefined>;
  threadStatusById: Record<
    string,
    {
      isProcessing: boolean;
    } | undefined
  >;
};

export function isLocalCliReasoningThread(threadId: string) {
  return (
    threadId.startsWith("claude:") ||
    threadId.startsWith("claude-pending-") ||
    threadId.startsWith("gemini:") ||
    threadId.startsWith("gemini-pending-") ||
    threadId.startsWith("opencode:") ||
    threadId.startsWith("opencode-pending-")
  );
}

export function isGeminiReasoningThread(threadId: string) {
  return threadId.startsWith("gemini:") || threadId.startsWith("gemini-pending-");
}

export function isClaudeReasoningThread(threadId: string) {
  return threadId.startsWith("claude:") || threadId.startsWith("claude-pending-");
}

export function shouldAcceptReasoningDelta(
  state: ReasoningGuardState,
  threadId: string,
) {
  // Gemini may emit reasoning fallback snapshots after processing settles.
  // Keep these deltas so realtime reasoning stays consistent with history.
  if (isGeminiReasoningThread(threadId)) {
    return true;
  }
  if (!isLocalCliReasoningThread(threadId)) {
    return true;
  }
  const hasActiveTurn = (state.activeTurnIdByThread[threadId] ?? null) !== null;
  const isProcessing = Boolean(state.threadStatusById[threadId]?.isProcessing);
  return hasActiveTurn || isProcessing;
}
