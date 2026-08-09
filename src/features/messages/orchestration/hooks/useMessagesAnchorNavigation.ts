import {
  useCallback,
  useEffect,
  type MutableRefObject,
  type RefObject,
} from "react";
import { MESSAGE_JUMP_EVENT_NAME } from "../../constants/messagesConstants";

type UseMessagesAnchorNavigationInput = {
  pauseFollow: () => void;
  clearPendingJumpMessage: () => void;
  commitActiveAnchorId: (messageId: string, mode: "sync") => void;
  containerRef: RefObject<HTMLDivElement | null>;
  messageNodeByIdRef: MutableRefObject<Map<string, HTMLDivElement>>;
  pendingJumpMessageId: string | null;
  requestPendingJumpMessage: (messageId: string) => void;
  revealAllHistoryItems: (reason: "jump") => void;
  showAllHistoryItems: boolean;
  timelinePresentationSignal: unknown;
};

export function useMessagesAnchorNavigation({
  pauseFollow,
  clearPendingJumpMessage,
  commitActiveAnchorId,
  containerRef,
  messageNodeByIdRef,
  pendingJumpMessageId,
  requestPendingJumpMessage,
  revealAllHistoryItems,
  showAllHistoryItems,
  timelinePresentationSignal,
}: UseMessagesAnchorNavigationInput) {
  const scrollToAnchor = useCallback((messageId: string) => {
    const node = messageNodeByIdRef.current.get(messageId);
    const container = containerRef.current;
    if (!node || !container) {
      return false;
    }
    const containerRect = container.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const targetTop =
      container.scrollTop + (nodeRect.top - containerRect.top) - container.clientHeight * 0.28;
    pauseFollow();
    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });
    commitActiveAnchorId(messageId, "sync");
    return true;
  }, [commitActiveAnchorId, containerRef, messageNodeByIdRef, pauseFollow]);

  const requestScrollToAnchor = useCallback((messageId: string) => {
    if (scrollToAnchor(messageId)) {
      clearPendingJumpMessage();
      return;
    }
    requestPendingJumpMessage(messageId);
    if (!showAllHistoryItems) {
      revealAllHistoryItems("jump");
    }
  }, [
    clearPendingJumpMessage,
    requestPendingJumpMessage,
    revealAllHistoryItems,
    scrollToAnchor,
    showAllHistoryItems,
  ]);

  const handlePendingJumpTargetReady = useCallback((messageId: string) => {
    if (pendingJumpMessageId === messageId && scrollToAnchor(messageId)) {
      clearPendingJumpMessage();
    }
  }, [clearPendingJumpMessage, pendingJumpMessageId, scrollToAnchor]);

  useEffect(() => {
    if (pendingJumpMessageId && scrollToAnchor(pendingJumpMessageId)) {
      clearPendingJumpMessage();
    }
  }, [clearPendingJumpMessage, pendingJumpMessageId, scrollToAnchor, timelinePresentationSignal]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    const handleJumpToMessage = (event: Event) => {
      const messageId =
        event instanceof CustomEvent && typeof event.detail === "string" ? event.detail : "";
      if (messageId) {
        requestScrollToAnchor(messageId);
      }
    };
    document.addEventListener(MESSAGE_JUMP_EVENT_NAME, handleJumpToMessage);
    return () => document.removeEventListener(MESSAGE_JUMP_EVENT_NAME, handleJumpToMessage);
  }, [requestScrollToAnchor]);

  return { handlePendingJumpTargetReady, requestScrollToAnchor };
}
