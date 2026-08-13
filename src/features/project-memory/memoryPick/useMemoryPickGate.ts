import { useCallback, useMemo, useSyncExternalStore } from "react";
import { emitMemoryPickComposerMode } from "./memoryPickEvents";
import {
  cancelMemoryPickGate,
  confirmMemoryPickGate,
  dismissMemoryPickGate,
  getMemoryPickGateSnapshot,
  getMemoryPickGateStoreVersion,
  setMemoryPickGateMode,
  setMemoryPickGateSelectedIds,
  skipMemoryPickGate,
  subscribeMemoryPickGateStore,
} from "./memoryPickGateStore";
import { setMemoryPickComposerMode } from "./memoryPickSessionStore";
import type { MemoryPickComposerMode } from "./memoryPickTypes";

/**
 * 只把 storeVersion（number）交给 useSyncExternalStore。
 * 门状态用 useMemo 按 version 读取，杜绝 getSnapshot 返回新对象导致的
 * Maximum update depth exceeded（react-maximum-update-depth）。
 */
export function useMemoryPickGate(
  workspaceId: string | null | undefined,
  threadId: string | null | undefined,
) {
  const version = useSyncExternalStore(
    subscribeMemoryPickGateStore,
    getMemoryPickGateStoreVersion,
    getMemoryPickGateStoreVersion,
  );

  const snapshot = useMemo(
    () => getMemoryPickGateSnapshot(workspaceId, threadId),
    // version 是唯一触发重算的 store 信号
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: re-read map when storeVersion bumps
    [version, workspaceId, threadId],
  );

  const toggleSelected = useCallback(
    (memoryId: string) => {
      if (!workspaceId || !threadId || !snapshot) return;
      // always 也允许自由勾选；确认后记住数量供下轮预勾
      const next = new Set(snapshot.selectedIds);
      if (next.has(memoryId)) next.delete(memoryId);
      else next.add(memoryId);
      setMemoryPickGateSelectedIds(workspaceId, threadId, Array.from(next));
    },
    [snapshot, threadId, workspaceId],
  );

  const setMode = useCallback(
    (mode: MemoryPickComposerMode) => {
      if (!workspaceId || !threadId) return;
      if (mode !== "pick" && mode !== "always") return;
      setMemoryPickGateMode(workspaceId, threadId, mode);
      // 同步 session policy + Composer 菜单（幕布策略 ↔ 输入框记忆参考）
      setMemoryPickComposerMode(workspaceId, threadId, mode);
      emitMemoryPickComposerMode({ mode, workspaceId, threadId });
    },
    [threadId, workspaceId],
  );

  const confirm = useCallback(() => {
    if (!workspaceId || !threadId) return;
    confirmMemoryPickGate(workspaceId, threadId);
  }, [threadId, workspaceId]);

  const skip = useCallback(() => {
    if (!workspaceId || !threadId) return;
    skipMemoryPickGate(workspaceId, threadId);
  }, [threadId, workspaceId]);

  const dismiss = useCallback(() => {
    if (!workspaceId || !threadId) return;
    dismissMemoryPickGate(workspaceId, threadId);
  }, [threadId, workspaceId]);

  const cancel = useCallback(() => {
    if (!workspaceId || !threadId) return;
    cancelMemoryPickGate(workspaceId, threadId);
  }, [threadId, workspaceId]);

  return {
    gate: snapshot,
    toggleSelected,
    setMode,
    confirm,
    skip,
    dismiss,
    cancel,
  };
}
