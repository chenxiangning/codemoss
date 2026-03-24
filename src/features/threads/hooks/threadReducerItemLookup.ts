import type { ConversationItem } from "../../../types";

export function findReasoningIndexById(
  list: ConversationItem[],
  candidateId: string,
) {
  if (!candidateId) {
    return -1;
  }
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const item = list[index];
    if (item.kind === "reasoning" && item.id === candidateId) {
      return index;
    }
  }
  return -1;
}

export function buildLegacyTextDeltaItemId(threadId: string) {
  return `${threadId}:text-delta`;
}

export function isLegacyTextDeltaItemId(threadId: string, itemId: string) {
  if (!threadId || !itemId) {
    return false;
  }
  const legacyId = buildLegacyTextDeltaItemId(threadId);
  return itemId === legacyId || itemId.startsWith(`${legacyId}-seg-`);
}

export function findAssistantMessageIndexByLegacyTextDelta(
  list: ConversationItem[],
  threadId: string,
) {
  const legacyId = buildLegacyTextDeltaItemId(threadId);
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const item = list[index];
    if (
      item.kind === "message" &&
      item.role === "assistant" &&
      (item.id === legacyId || item.id.startsWith(`${legacyId}-seg-`))
    ) {
      return index;
    }
  }
  return -1;
}

export function findGeminiReasoningInsertIndex(list: ConversationItem[]) {
  let lastUserMessageIndex = -1;
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const item = list[index];
    if (item.kind === "message" && item.role === "user") {
      lastUserMessageIndex = index;
      break;
    }
  }

  const scanStart = lastUserMessageIndex >= 0 ? lastUserMessageIndex + 1 : 0;
  for (let index = scanStart; index < list.length; index += 1) {
    const item = list[index];
    if (item.kind === "message" && item.role === "assistant") {
      return index;
    }
  }
  return -1;
}

export function insertLiveReasoningItem(
  list: ConversationItem[],
  index: number,
  updated: ConversationItem,
  shouldInsertBeforeAssistant: boolean,
) {
  if (index >= 0) {
    const next = [...list];
    next[index] = updated;
    return next;
  }
  if (shouldInsertBeforeAssistant) {
    const reasoningInsertIndex = findGeminiReasoningInsertIndex(list);
    if (reasoningInsertIndex >= 0) {
      return [
        ...list.slice(0, reasoningInsertIndex),
        updated,
        ...list.slice(reasoningInsertIndex),
      ];
    }
  }
  return [...list, updated];
}
