type OlderHistoryRequester = (threadId: string) => boolean;

let olderHistoryRequester: OlderHistoryRequester | null = null;

export function setOlderHistoryRequester(
  requester: OlderHistoryRequester | null,
) {
  olderHistoryRequester = requester;
}

export function requestOlderHistory(threadId: string): boolean {
  if (!threadId) {
    return false;
  }
  return olderHistoryRequester?.(threadId) === true;
}
