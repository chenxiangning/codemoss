import { useMemo } from "react";
import type {
  ConversationItem,
  RateLimitSnapshot,
  RequestUserInputRequest,
  ThreadSummary,
  ThreadTokenUsage,
  TurnPlan,
} from "../../types";
import { extractPlanFromTimelineItems } from "../sections/utils";

export type ActiveSessionProjectionInput = {
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  threadsByWorkspace: Record<string, ThreadSummary[] | undefined>;
  threadStatusById: Record<
    string,
    { isProcessing?: boolean; isReviewing?: boolean } | undefined
  >;
  tokenUsageByThread: Record<string, ThreadTokenUsage | null | undefined>;
  rateLimitsByWorkspace: Record<string, RateLimitSnapshot | null | undefined>;
  planByThread: Record<string, TurnPlan | null | undefined>;
  activeItems: ConversationItem[];
  activeTurnIdByThread: Record<string, string | null | undefined>;
  userInputRequests: RequestUserInputRequest[];
};

export type ActiveSessionProjection = {
  activeThreadSummary: ThreadSummary | null;
  activeThreadEngine:
    | NonNullable<ThreadSummary["engineSource"]>
    | NonNullable<ThreadSummary["selectedEngine"]>
    | null;
  activeThreadProviderProfileId: string | null;
  activeRateLimits: RateLimitSnapshot | null;
  activeTokenUsage: ThreadTokenUsage | null;
  /** 仅从 activeItems 抽出的 plan（不含 planByThread 回退）。 */
  timelinePlan: TurnPlan | null;
  /** timelinePlan 优先，否则 planByThread[activeThreadId]。 */
  activePlan: TurnPlan | null;
  canInterrupt: boolean;
  isProcessing: boolean;
  isReviewing: boolean;
  activeTurnId: string | null;
  hasPendingUserInput: boolean;
};

/**
 * 纯函数：从 workspace/thread bags 投影「当前会话」事实。
 * S4 PR-B：把 AppShell 根上的会话派生逻辑抽成可单测、无 UI 的数据层。
 */
export function projectActiveSession(
  input: ActiveSessionProjectionInput,
): ActiveSessionProjection {
  const {
    activeWorkspaceId,
    activeThreadId,
    threadsByWorkspace,
    threadStatusById,
    tokenUsageByThread,
    rateLimitsByWorkspace,
    planByThread,
    activeItems,
    activeTurnIdByThread,
    userInputRequests,
  } = input;

  const activeThreadSummary = activeWorkspaceId
    ? (threadsByWorkspace[activeWorkspaceId]?.find(
        (thread) => thread.id === activeThreadId,
      ) ?? null)
    : null;

  const activeThreadEngine =
    activeThreadSummary?.engineSource ??
    activeThreadSummary?.selectedEngine ??
    null;

  const activeThreadProviderProfileId =
    activeThreadSummary?.providerProfileId ?? null;

  const activeRateLimits = activeWorkspaceId
    ? (rateLimitsByWorkspace[activeWorkspaceId] ?? null)
    : null;

  const activeTokenUsage = activeThreadId
    ? (tokenUsageByThread[activeThreadId] ?? null)
    : null;

  const timelinePlan = extractPlanFromTimelineItems(activeItems);
  const activePlan = activeThreadId
    ? (timelinePlan ?? planByThread[activeThreadId] ?? null)
    : timelinePlan;

  const status = activeThreadId ? threadStatusById[activeThreadId] : undefined;
  const canInterrupt = Boolean(status?.isProcessing);
  const isProcessing = Boolean(status?.isProcessing);
  const isReviewing = Boolean(status?.isReviewing);

  const activeTurnId = activeThreadId
    ? (activeTurnIdByThread[activeThreadId] ?? null)
    : null;

  // An open AskUserQuestion for the active thread holds the send queue — the CLI
  // turn is blocked awaiting the answer. Mirror AskUserQuestionDialog's filter:
  // match on workspace + thread_id (empty thread_id = current thread).
  const hasPendingUserInput = Boolean(
    activeThreadId &&
      userInputRequests.some((req) => {
        const requestThreadId = (req.params.thread_id ?? "").trim();
        if (requestThreadId && requestThreadId !== activeThreadId) {
          return false;
        }
        if (activeWorkspaceId && req.workspace_id !== activeWorkspaceId) {
          return false;
        }
        return true;
      }),
  );

  return {
    activeThreadSummary,
    activeThreadEngine,
    activeThreadProviderProfileId,
    activeRateLimits,
    activeTokenUsage,
    timelinePlan,
    activePlan,
    canInterrupt,
    isProcessing,
    isReviewing,
    activeTurnId,
    hasPendingUserInput,
  };
}

export function useActiveSessionProjection(
  input: ActiveSessionProjectionInput,
): ActiveSessionProjection {
  return useMemo(
    () => projectActiveSession(input),
    // 显式字段：避免把整 bag 引用放进 deps 导致恒失效。
    // eslint-disable-next-line react-hooks/exhaustive-deps -- projectActiveSession 纯函数；按字段粒度同步
    [
      input.activeWorkspaceId,
      input.activeThreadId,
      input.threadsByWorkspace,
      input.threadStatusById,
      input.tokenUsageByThread,
      input.rateLimitsByWorkspace,
      input.planByThread,
      input.activeItems,
      input.activeTurnIdByThread,
      input.userInputRequests,
    ],
  );
}
