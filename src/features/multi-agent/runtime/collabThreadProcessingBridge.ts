/**
 * Collab → sidebar threadStatus 桥。
 *
 * Multi-Agent executor 不依赖 React hooks；threads 层注册 markProcessing，
 * 协作生命周期在此同步左侧会话列表的蓝点 / 代理闪电图标。
 */
import {
  isTerminalAgentStatus,
  type AgentProjectionV1,
  type AgentRunStatus,
} from "../types";

export type CollabThreadProcessingMarker = (
  threadId: string,
  isProcessing: boolean,
) => void;

let marker: CollabThreadProcessingMarker | null = null;

export function registerCollabThreadProcessingMarker(
  next: CollabThreadProcessingMarker | null,
): void {
  marker = next;
}

export function setCollabThreadProcessing(
  threadId: string,
  isProcessing: boolean,
): void {
  const normalized = threadId.trim();
  if (!normalized) return;
  marker?.(normalized, isProcessing);
}

/** 非终态（含 awaiting-approval）保持 processing；终态熄灭。 */
export function applyCollabThreadProcessingFromStatus(
  threadId: string,
  status: AgentRunStatus | null | undefined,
): void {
  if (!status) {
    setCollabThreadProcessing(threadId, false);
    return;
  }
  setCollabThreadProcessing(threadId, !isTerminalAgentStatus(status));
}

export function applyCollabThreadProcessingFromProjection(
  threadId: string,
  projection: AgentProjectionV1 | null | undefined,
): void {
  if (!projection) {
    setCollabThreadProcessing(threadId, false);
    return;
  }
  applyCollabThreadProcessingFromStatus(threadId, projection.status);
}

/**
 * Hydrate 专用：仅在 run 仍活跃时点亮。
 * 终态绝不 force false，避免盖掉同线程普通 Shared turn 的 isProcessing。
 */
export function restoreCollabThreadProcessingIfActive(
  threadId: string,
  projection: AgentProjectionV1 | null | undefined,
): void {
  if (!projection) return;
  if (!isTerminalAgentStatus(projection.status)) {
    setCollabThreadProcessing(threadId, true);
  }
}

/** 测试用：清空注册 */
export function resetCollabThreadProcessingMarkerForTests(): void {
  marker = null;
}
