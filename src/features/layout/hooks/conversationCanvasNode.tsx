import type { ComponentProps, ReactNode } from "react";

import {
  MessageForkConfirmDialog,
  Messages,
  type MessagesProps,
} from "../../messages";
import {
  shallowEqual,
  useActiveCanvasSelector,
  type ActiveCanvasSnapshot,
} from "./activeCanvasStore";

export type ConversationCanvasNodeInput = {
  messagesProps: ComponentProps<typeof Messages>;
  forkConfirmDialogProps: ComponentProps<typeof MessageForkConfirmDialog>;
  continuationContextNode?: ReactNode;
  /** 主幕布时间线尾部（随 messages.scrollable 滚动） */
  timelineTrailingNode?: ReactNode;
  isProviderContinuation?: boolean;
};

// 刻意不选 heartbeatPulse:opencode 心跳(约 5s 一次)会 bump 该计数,若选入这里,
// 每次心跳都会击穿 shallowEqual 并整树重渲染 <Messages>(单次 ~200ms)。
// WorkingIndicator 的心跳提示改经 conversationState.meta.heartbeatPulse 送达,
// 与 conversationState 的重建节奏一致,不再单独驱动大树渲染。
const selectActiveCanvasMessagesProps = (
  snapshot: ActiveCanvasSnapshot,
): Pick<
  MessagesProps,
  | "items"
  | "threadId"
  | "workspaceId"
  | "workspacePath"
  | "userInputRequests"
  | "approvals"
  | "conversationState"
  | "plan"
  | "isThinking"
  | "isHistoryLoading"
  | "historyLoadingProgress"
  | "historyRecoveryFailureReason"
  | "isContextCompacting"
  | "processingStartedAt"
  | "lastDurationMs"
  | "codexSilentSuspectedAt"
  | "taskRuns"
> => ({
  items: snapshot.items,
  threadId: snapshot.threadId,
  workspaceId: snapshot.workspaceId,
  workspacePath: snapshot.workspacePath,
  userInputRequests: snapshot.userInputRequests,
  approvals: snapshot.approvals,
  conversationState: snapshot.conversationState,
  plan: snapshot.plan,
  isThinking: snapshot.isThinking,
  isHistoryLoading: snapshot.isHistoryLoading,
  historyLoadingProgress: snapshot.historyLoadingProgress,
  historyRecoveryFailureReason: snapshot.historyRecoveryFailureReason,
  isContextCompacting: snapshot.isContextCompacting,
  processingStartedAt: snapshot.processingStartedAt,
  lastDurationMs: snapshot.lastDurationMs,
  codexSilentSuspectedAt: snapshot.codexSilentSuspectedAt,
  taskRuns: snapshot.taskRuns,
});

function ActiveCanvasMessages({
  messagesProps,
}: {
  messagesProps: ComponentProps<typeof Messages>;
}) {
  const activeCanvasMessagesProps = useActiveCanvasSelector(
    selectActiveCanvasMessagesProps,
    shallowEqual,
  );

  return <Messages {...messagesProps} {...activeCanvasMessagesProps} />;
}

export function buildConversationCanvasNode({
  messagesProps,
  forkConfirmDialogProps,
  continuationContextNode,
  timelineTrailingNode = null,
  isProviderContinuation = false,
}: ConversationCanvasNodeInput): ReactNode {
  return (
    <>
      <ActiveCanvasMessages
        messagesProps={{
          ...messagesProps,
          timelineLeadingNode: continuationContextNode ?? null,
          timelineTrailingNode: timelineTrailingNode ?? null,
          isProviderContinuation,
        }}
      />
      <MessageForkConfirmDialog {...forkConfirmDialogProps} />
    </>
  );
}
