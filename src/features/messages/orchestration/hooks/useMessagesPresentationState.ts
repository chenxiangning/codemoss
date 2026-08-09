import { useMemo } from "react";
import type { ConversationItem, EngineType } from "../../../../types";
import { buildSuppressedUserMemoryContextMessageIdSet } from "../../utils/context/messagesMemoryContext";
import { buildSuppressedUserNoteCardContextMessageIdSet } from "../../utils/context/messagesNoteCardContext";
import { groupToolItems } from "../../utils/groupToolItems";
import {
  isAssistantMessageConversationItem,
  isReasoningConversationItem,
} from "../../utils/messageItemPredicates";
import {
  countRenderableCollapsedEntries,
  isClaudeHistoryTranscriptHeavy,
} from "../../utils/messagesRenderUtils";
import {
  buildTurnFileChangesByBoundaryId,
  mergeTurnFileChangesSummaries,
} from "../../utils/turnFileChanges";
import {
  buildAssistantFinalBoundarySet,
  buildMessagesPresentationScopeKey,
  resolveLiveAutoExpandedExploreId,
  resolveStreamingPresentationItems,
  type MessagesPresentationMode,
} from "../presentation/messagesLiveWindow";
import { buildTurnTargetBadgeVisibleItemIds } from "../../../../utils/turnBadge";
import { findItemById } from "../presentation/messagesViewModel";

type UseMessagesPresentationStateInput = {
  activeEngine: EngineType;
  claudeDockedReasoningItemCount: number;
  collapsedHistoryItemCount: number;
  deferredRenderSourceItems: ConversationItem[];
  hideClaudeReasoning: boolean;
  historyRestoredAtMs: number | null;
  isAssistantFinalizing: boolean;
  isHistoryLoading: boolean;
  isThinking: boolean;
  latestReasoningId: string | null;
  liveAssistantMessageId: string | null;
  messagesPresentationMode: MessagesPresentationMode;
  presentationRenderedItems: ConversationItem[];
  renderScopeKey: string;
  renderSourceItems: ConversationItem[];
  supportsStreamingReadableWindowRecovery: boolean;
  /**
   * 本 Messages 实例绑定的 thread。
   * 合成 spawn 已在 collapse 前注入，此处仅保留 API 兼容（嵌套详情等调用方仍传）。
   */
  threadId?: string | null;
  timelineItems: ConversationItem[];
};

export function useMessagesPresentationState({
  activeEngine,
  claudeDockedReasoningItemCount,
  collapsedHistoryItemCount,
  deferredRenderSourceItems,
  hideClaudeReasoning,
  historyRestoredAtMs,
  isAssistantFinalizing,
  isHistoryLoading,
  isThinking,
  latestReasoningId,
  liveAssistantMessageId,
  messagesPresentationMode,
  presentationRenderedItems,
  renderScopeKey,
  renderSourceItems,
  supportsStreamingReadableWindowRecovery,
  threadId: _threadId = null,
  timelineItems,
}: UseMessagesPresentationStateInput) {
  const presentationScopeKey = buildMessagesPresentationScopeKey({
    scopeKey: renderScopeKey,
    mode: messagesPresentationMode,
    collapsedHistoryItemCount,
    itemCount: presentationRenderedItems.length,
    firstItemId: presentationRenderedItems[0]?.id ?? null,
    lastItemId: presentationRenderedItems.at(-1)?.id ?? null,
  });
  const claudeRenderableEntryCount = useMemo(
    () => countRenderableCollapsedEntries(timelineItems, activeEngine),
    [activeEngine, timelineItems],
  );
  const claudeHistoryTranscriptFallbackActive = useMemo(() => {
    if (activeEngine !== "claude" || isThinking || isHistoryLoading) {
      return false;
    }
    if (historyRestoredAtMs == null || claudeRenderableEntryCount > 0) {
      return false;
    }
    return isClaudeHistoryTranscriptHeavy(timelineItems);
  }, [
    activeEngine,
    claudeRenderableEntryCount,
    historyRestoredAtMs,
    isHistoryLoading,
    isThinking,
    timelineItems,
  ]);
  // jetbrains 同帧 stick：不再 useDeferredValue 推迟 presentation DOM。
  const shouldStabilizePresentationItems =
    supportsStreamingReadableWindowRecovery && (isThinking || isAssistantFinalizing);
  const livePresentationOverrideItemIds = useMemo(() => {
    if (!liveAssistantMessageId && !latestReasoningId) {
      return undefined;
    }
    return new Set(
      [liveAssistantMessageId, latestReasoningId].filter(
        (id): id is string => Boolean(id),
      ),
    );
  }, [latestReasoningId, liveAssistantMessageId]);
  const timelinePresentationItems = useMemo(() => {
    if (claudeHistoryTranscriptFallbackActive) {
      return timelineItems;
    }
    return resolveStreamingPresentationItems(
      presentationRenderedItems,
      presentationRenderedItems,
      shouldStabilizePresentationItems,
      livePresentationOverrideItemIds,
      {
        deferredScopeKey: presentationScopeKey,
        currentScopeKey: presentationScopeKey,
      },
    );
  }, [
    claudeHistoryTranscriptFallbackActive,
    livePresentationOverrideItemIds,
    presentationRenderedItems,
    presentationScopeKey,
    shouldStabilizePresentationItems,
    timelineItems,
  ]);
  const hiddenClaudeReasoningOnly =
    activeEngine === "claude" &&
    hideClaudeReasoning &&
    deferredRenderSourceItems.length > 0 &&
    deferredRenderSourceItems.every(isReasoningConversationItem) &&
    timelinePresentationItems.length === 0 &&
    claudeDockedReasoningItemCount === 0;
  const liveAssistantItem = useMemo(() => {
    const item = findItemById(renderSourceItems, liveAssistantMessageId);
    return item && isAssistantMessageConversationItem(item) ? item : null;
  }, [liveAssistantMessageId, renderSourceItems]);
  const liveReasoningItem = useMemo(() => {
    if (!isThinking) {
      return null;
    }
    const item = findItemById(renderSourceItems, latestReasoningId);
    return item && isReasoningConversationItem(item) ? item : null;
  }, [isThinking, latestReasoningId, renderSourceItems]);

  // 合成 spawn 已在 MessagesCore → resolveCollapsedTimelineItems **之前**注入。
  // 禁止在折叠后再 inject：否则真 Agent 被 hard-unmount 后 hasBlocking 变 false，
  // 合成卡会钉回 user 后、落在「已处理」chip 外侧。
  const groupedEntries = useMemo(
    () => groupToolItems(timelinePresentationItems),
    [timelinePresentationItems],
  );
  const liveAutoExpandedExploreId = useMemo(
    () => resolveLiveAutoExpandedExploreId(groupedEntries, isThinking),
    [groupedEntries, isThinking],
  );
  const assistantFinalBoundarySet = useMemo(
    () => buildAssistantFinalBoundarySet(timelinePresentationItems),
    [timelinePresentationItems],
  );
  // File-change summary must read the uncollapsed process stream. Causal phase
  // collapse hides tool rows from the timeline, but the turn summary card still
  // needs those fileChange/edit tools as its data source.
  const turnFileChangesByBoundaryId = useMemo(
    () =>
      buildTurnFileChangesByBoundaryId(
        deferredRenderSourceItems.length > 0
          ? deferredRenderSourceItems
          : timelinePresentationItems,
      ),
    [deferredRenderSourceItems, timelinePresentationItems],
  );
  const sessionFileChangesSummary = useMemo(
    () => mergeTurnFileChangesSummaries(turnFileChangesByBoundaryId.values()),
    [turnFileChangesByBoundaryId],
  );
  const assistantLiveTurnFinalBoundarySuppressedSet = useMemo(() => {
    const ids = new Set<string>();
    if (!liveAssistantMessageId) {
      return ids;
    }
    let lastUserIndex = -1;
    for (let index = timelinePresentationItems.length - 1; index >= 0; index -= 1) {
      const entry = timelinePresentationItems[index];
      if (entry?.kind === "message" && entry.role === "user") {
        lastUserIndex = index;
        break;
      }
    }
    if (lastUserIndex < 0) {
      return ids;
    }
    for (let index = lastUserIndex + 1; index < timelinePresentationItems.length; index += 1) {
      const entry = timelinePresentationItems[index];
      if (
        entry?.kind === "message" &&
        entry.role === "assistant" &&
        entry.isFinal === true &&
        assistantFinalBoundarySet.has(entry.id) &&
        (isThinking || entry.id === liveAssistantMessageId)
      ) {
        ids.add(entry.id);
      }
    }
    return ids;
  }, [assistantFinalBoundarySet, isThinking, liveAssistantMessageId, timelinePresentationItems]);
  const suppressedUserNoteCardContextMessageIds = useMemo(
    () => buildSuppressedUserNoteCardContextMessageIdSet(timelinePresentationItems),
    [timelinePresentationItems],
  );
  const suppressedUserMemoryContextMessageIds = useMemo(
    () => buildSuppressedUserMemoryContextMessageIdSet(timelinePresentationItems),
    [timelinePresentationItems],
  );
  const turnTargetBadgeVisibleItemIds = useMemo(
    () => buildTurnTargetBadgeVisibleItemIds(timelinePresentationItems),
    [timelinePresentationItems],
  );

  return {
    assistantFinalBoundarySet,
    assistantLiveTurnFinalBoundarySuppressedSet,
    claudeHistoryTranscriptFallbackActive,
    groupedEntries,
    hiddenClaudeReasoningOnly,
    liveAssistantItem,
    liveAutoExpandedExploreId,
    liveReasoningItem,
    presentationScopeKey,
    sessionFileChangesSummary,
    suppressedUserMemoryContextMessageIds,
    suppressedUserNoteCardContextMessageIds,
    timelinePresentationItems,
    turnFileChangesByBoundaryId,
    turnTargetBadgeVisibleItemIds,
  };
}
