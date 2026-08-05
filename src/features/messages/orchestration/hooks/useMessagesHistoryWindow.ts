import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConversationItem } from "../../../../types";
import { VISIBLE_MESSAGE_WINDOW } from "../../utils/messagesRenderUtils";
import {
  buildRenderedItemsWindow,
  resolveMessagesPresentationMode,
  type MessagesHistoryExpansionMode,
} from "../presentation/messagesLiveWindow";
import {
  findLatestAssistantTextLength,
  mergeReadableRecoveryItems,
  type PreservedReadableWindow,
} from "../presentation/messagesViewModel";

type UseMessagesHistoryWindowInput = {
  firstItemId: string | null;
};

export function useMessagesHistoryWindow({ firstItemId }: UseMessagesHistoryWindowInput) {
  const [showAllHistoryItems, setShowAllHistoryItems] = useState(false);
  const [historyExpansionMode, setHistoryExpansionMode] =
    useState<MessagesHistoryExpansionMode>(null);
  const [pendingJumpMessageId, setPendingJumpMessageId] = useState<string | null>(null);
  const pendingHistoryExpansionModeRef = useRef<MessagesHistoryExpansionMode>(null);
  const firstItemIdRef = useRef<string | null>(firstItemId);

  useEffect(() => {
    if (firstItemId !== firstItemIdRef.current) {
      // pre-dispatch：默认态不得换新引用 / 虚写（#185 防御）
      setShowAllHistoryItems((previous) => (previous ? false : previous));
      setHistoryExpansionMode((previous) =>
        previous === null ? previous : null,
      );
      setPendingJumpMessageId((previous) =>
        previous === null ? previous : null,
      );
      pendingHistoryExpansionModeRef.current = null;
    }
    firstItemIdRef.current = firstItemId;
  }, [firstItemId]);

  const revealAllHistoryItems = useCallback((mode: "manual" | "jump") => {
    pendingHistoryExpansionModeRef.current = mode;
    setHistoryExpansionMode(mode);
    setShowAllHistoryItems(true);
  }, []);
  const consumePendingHistoryExpansionMode = useCallback(() => {
    const mode = pendingHistoryExpansionModeRef.current;
    pendingHistoryExpansionModeRef.current = null;
    return mode;
  }, []);
  const discardPendingHistoryExpansion = useCallback(() => {
    pendingHistoryExpansionModeRef.current = null;
  }, []);
  const requestPendingJumpMessage = useCallback((messageId: string) => {
    setPendingJumpMessageId((previous) => (previous === messageId ? previous : messageId));
  }, []);
  const clearPendingJumpMessage = useCallback(() => {
    setPendingJumpMessageId(null);
  }, []);
  const resetHistoryScope = useCallback(() => {
    setShowAllHistoryItems((previous) => (previous ? false : previous));
    setHistoryExpansionMode((previous) => (previous === null ? previous : null));
    setPendingJumpMessageId((previous) => (previous === null ? previous : null));
    pendingHistoryExpansionModeRef.current = null;
  }, []);

  return {
    clearPendingJumpMessage,
    consumePendingHistoryExpansionMode,
    discardPendingHistoryExpansion,
    historyExpansionMode,
    pendingJumpMessageId,
    requestPendingJumpMessage,
    resetHistoryScope,
    revealAllHistoryItems,
    showAllHistoryItems,
  };
}

type LiveTailWorkingSet = {
  omittedBeforeWorkingSetCount: number;
  preservedUserMessageId: string | null;
};

type UseMessagesHistoryPresentationWindowInput = {
  activeTurnId: string | null;
  blankingRecoveryActive: boolean;
  effectiveItemsLength: number;
  historyExpansionMode: MessagesHistoryExpansionMode;
  isThinking: boolean;
  isWorking: boolean;
  liveTailWorkingSet: LiveTailWorkingSet;
  readableWindowRecoveryActive: boolean;
  showAllHistoryItems: boolean;
  supportsStreamingReadableWindowRecovery: boolean;
  threadId: string | null;
  timelineItems: ConversationItem[];
  visibleStallRecoveryActive: boolean;
  workspaceId: string | null;
};

export function useMessagesHistoryPresentationWindow({
  activeTurnId,
  blankingRecoveryActive,
  effectiveItemsLength,
  historyExpansionMode,
  isThinking,
  isWorking,
  liveTailWorkingSet,
  readableWindowRecoveryActive,
  showAllHistoryItems,
  supportsStreamingReadableWindowRecovery,
  threadId,
  timelineItems,
  visibleStallRecoveryActive,
  workspaceId,
}: UseMessagesHistoryPresentationWindowInput) {
  const preservedReadableWindowRef = useRef<PreservedReadableWindow>({
    workspaceId: null,
    threadId: null,
    turnId: null,
    renderedItems: [],
    visibleCollapsedHistoryItemCount: 0,
  });
  const timelineCollapsedHistoryItemCount =
    !showAllHistoryItems && timelineItems.length > VISIBLE_MESSAGE_WINDOW
      ? timelineItems.length - VISIBLE_MESSAGE_WINDOW
      : 0;
  const collapsedHistoryItemCount =
    liveTailWorkingSet.omittedBeforeWorkingSetCount + timelineCollapsedHistoryItemCount;
  const renderedItemsWindow = useMemo(
    () =>
      buildRenderedItemsWindow(
        timelineItems,
        timelineCollapsedHistoryItemCount,
        liveTailWorkingSet.preservedUserMessageId,
      ),
    [
      liveTailWorkingSet.preservedUserMessageId,
      timelineCollapsedHistoryItemCount,
      timelineItems,
    ],
  );
  const renderedItems = renderedItemsWindow.renderedItems;
  const visibleCollapsedHistoryItemCount =
    collapsedHistoryItemCount > 0
      ? renderedItemsWindow.visibleCollapsedHistoryItemCount +
        liveTailWorkingSet.omittedBeforeWorkingSetCount
      : 0;
  const messagesPresentationMode = resolveMessagesPresentationMode({
    historyExpansionMode,
    isWorking,
    showAllHistoryItems,
    visibleCollapsedHistoryItemCount,
  });
  const currentLatestAssistantTextLength = useMemo(
    () => findLatestAssistantTextLength(renderedItems),
    [renderedItems],
  );

  useEffect(() => {
    const currentWorkspaceId = workspaceId ?? null;
    const currentThreadId = threadId ?? null;
    const currentTurnId = activeTurnId;
    if (
      preservedReadableWindowRef.current.workspaceId !== currentWorkspaceId ||
      preservedReadableWindowRef.current.threadId !== currentThreadId ||
      preservedReadableWindowRef.current.turnId !== currentTurnId
    ) {
      preservedReadableWindowRef.current = {
        workspaceId: currentWorkspaceId,
        threadId: currentThreadId,
        turnId: currentTurnId,
        renderedItems: renderedItems.length > 0 ? renderedItems : [],
        visibleCollapsedHistoryItemCount:
          renderedItems.length > 0 ? visibleCollapsedHistoryItemCount : 0,
      };
      return;
    }
    if (renderedItems.length > 0) {
      if (readableWindowRecoveryActive) {
        return;
      }
      preservedReadableWindowRef.current = {
        workspaceId: currentWorkspaceId,
        threadId: currentThreadId,
        turnId: currentTurnId,
        renderedItems,
        visibleCollapsedHistoryItemCount,
      };
      return;
    }
    if (!isThinking) {
      preservedReadableWindowRef.current = {
        workspaceId: currentWorkspaceId,
        threadId: currentThreadId,
        turnId: null,
        renderedItems: [],
        visibleCollapsedHistoryItemCount: 0,
      };
    }
  }, [
    activeTurnId,
    isThinking,
    readableWindowRecoveryActive,
    renderedItems,
    threadId,
    visibleCollapsedHistoryItemCount,
    workspaceId,
  ]);

  const preservedReadableWindowSnapshot = preservedReadableWindowRef.current;
  const preservedLatestAssistantTextLength = findLatestAssistantTextLength(
    preservedReadableWindowSnapshot.renderedItems,
  );
  const hasPreservedReadableWindow =
    (readableWindowRecoveryActive || supportsStreamingReadableWindowRecovery) &&
    preservedReadableWindowSnapshot.workspaceId === (workspaceId ?? null) &&
    preservedReadableWindowSnapshot.threadId === (threadId ?? null) &&
    preservedReadableWindowSnapshot.turnId === activeTurnId &&
    preservedReadableWindowSnapshot.renderedItems.length > 0;
  const renderChainBlankingRegressionActive =
    supportsStreamingReadableWindowRecovery &&
    isThinking &&
    effectiveItemsLength > 0 &&
    renderedItems.length === 0;
  const shouldUseReadableWindowRecovery =
    hasPreservedReadableWindow &&
    (renderChainBlankingRegressionActive ||
      (blankingRecoveryActive && renderedItems.length === 0) ||
      (visibleStallRecoveryActive &&
        currentLatestAssistantTextLength > 0 &&
        currentLatestAssistantTextLength < preservedLatestAssistantTextLength));
  const recoveredReadableWindow = useMemo(() => {
    if (!shouldUseReadableWindowRecovery) {
      return null;
    }
    return {
      renderedItems: mergeReadableRecoveryItems(
        preservedReadableWindowSnapshot.renderedItems,
        renderedItems,
      ),
      visibleCollapsedHistoryItemCount:
        preservedReadableWindowSnapshot.visibleCollapsedHistoryItemCount,
    };
  }, [preservedReadableWindowSnapshot, renderedItems, shouldUseReadableWindowRecovery]);
  const presentationRenderedItems = shouldUseReadableWindowRecovery
    ? recoveredReadableWindow?.renderedItems ?? renderedItems
    : renderedItems;
  const presentationCollapsedHistoryItemCount = shouldUseReadableWindowRecovery
    ? recoveredReadableWindow?.visibleCollapsedHistoryItemCount ??
      visibleCollapsedHistoryItemCount
    : visibleCollapsedHistoryItemCount;

  return {
    messagesPresentationMode,
    presentationCollapsedHistoryItemCount,
    presentationRenderedItems,
    preservedLatestAssistantTextLength,
    preservedReadableWindowItemCount: preservedReadableWindowSnapshot.renderedItems.length,
    renderChainBlankingRegressionActive,
    renderedItems,
    shouldUseReadableWindowRecovery,
    timelineCollapsedHistoryItemCount,
    visibleCollapsedHistoryItemCount,
  };
}
