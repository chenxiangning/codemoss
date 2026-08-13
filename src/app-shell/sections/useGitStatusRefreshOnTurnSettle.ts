import { useEffect, useRef } from "react";

type GitStatusRefreshOnTurnSettleParams = {
  queueGitStatusRefresh: () => void;
  threadStatusById: Record<
    string,
    { isProcessing?: boolean } | null | undefined
  >;
};

// git status 的自动刷新从「每次消息活动(onMessageActivity, 500ms 防抖)」收敛为
// 「回合结束刷一次」：消息活动链在事件稀疏期每次都会真的执行 git status 子进程，
// 且 Agent 改文件期间结果必变 → setStatus 换引用 → 一次 100ms+ 的根渲染。
// 回合结束(任一线程 isProcessing true→false)才是文件状态的稳定观察点；
// 外部 git 变化仍由 useGitStatus 的周期轮询兜底。
export function useGitStatusRefreshOnTurnSettle({
  queueGitStatusRefresh,
  threadStatusById,
}: GitStatusRefreshOnTurnSettleParams) {
  const processingByThreadRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const previous = processingByThreadRef.current;
    const next: Record<string, boolean> = {};
    let anyTurnSettled = false;
    for (const [threadId, status] of Object.entries(threadStatusById)) {
      const isProcessing = status?.isProcessing ?? false;
      next[threadId] = isProcessing;
      if (previous[threadId] && !isProcessing) {
        anyTurnSettled = true;
      }
    }
    processingByThreadRef.current = next;
    if (anyTurnSettled) {
      queueGitStatusRefresh();
    }
  }, [queueGitStatusRefresh, threadStatusById]);
}
