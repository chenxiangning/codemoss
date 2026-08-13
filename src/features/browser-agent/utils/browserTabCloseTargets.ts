export type BrowserTabCloseAction = "current" | "others" | "right" | "all";

export function resolveBrowserTabCloseTargets(
  sessionIds: readonly string[],
  targetId: string,
  action: BrowserTabCloseAction,
): string[] {
  const targetIndex = sessionIds.indexOf(targetId);
  if (targetIndex < 0) {
    return [];
  }

  switch (action) {
    case "current":
      return [targetId];
    case "others":
      return sessionIds.filter((sessionId) => sessionId !== targetId);
    case "right":
      return sessionIds.slice(targetIndex + 1);
    case "all":
      return [...sessionIds];
  }
}
