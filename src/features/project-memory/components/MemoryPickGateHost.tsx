import { useMemo, useSyncExternalStore } from "react";
import {
  getMemoryPickGateStoreVersion,
  hasActiveMemoryPickGate,
  subscribeMemoryPickGateStore,
} from "../memoryPick/memoryPickGateStore";
import { MemoryPickGate } from "./MemoryPickGate";

type MemoryPickGateHostProps = {
  workspaceId: string | null | undefined;
  threadId: string | null | undefined;
};

/**
 * 仅在当前 thread 有活跃闸门时挂载 MemoryPickGate。
 * 避免每条会话 Messages 常驻订阅对象快照带来的重渲染风暴。
 */
export function MemoryPickGateHost({
  workspaceId,
  threadId,
}: MemoryPickGateHostProps) {
  const version = useSyncExternalStore(
    subscribeMemoryPickGateStore,
    getMemoryPickGateStoreVersion,
    getMemoryPickGateStoreVersion,
  );

  const active = useMemo(
    () => hasActiveMemoryPickGate(workspaceId, threadId),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the store tick
    [version, workspaceId, threadId],
  );

  if (!active || !workspaceId || !threadId) {
    // 返回 null，让父级 .memory-pick-gate-slot:empty 折叠，不占高度
    return null;
  }

  return <MemoryPickGate workspaceId={workspaceId} threadId={threadId} />;
}
