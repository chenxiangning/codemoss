import { useSyncExternalStore } from "react";

export type AgentInspectorSelection = {
  workspaceId: string;
  threadId: string;
  runId: string;
  stageId?: string | null;
  /** 0-based 轮次索引（对应 round list） */
  roundIndex?: number | null;
};

let selection: AgentInspectorSelection | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function openAgentInspector(next: AgentInspectorSelection): void {
  const same =
    selection &&
    selection.workspaceId === next.workspaceId &&
    selection.threadId === next.threadId &&
    selection.runId === next.runId &&
    (selection.stageId ?? null) === (next.stageId ?? null) &&
    (selection.roundIndex ?? null) === (next.roundIndex ?? null);
  if (same) return;
  selection = {
    ...next,
    roundIndex: next.roundIndex ?? selection?.roundIndex ?? null,
  };
  emit();
}

export function selectAgentStage(stageId: string | null): void {
  if (!selection) return;
  if ((selection.stageId ?? null) === stageId) return;
  selection = { ...selection, stageId };
  emit();
}

export function selectAgentRound(input: {
  runId: string;
  roundIndex: number;
  stageId?: string | null;
}): void {
  if (!selection) return;
  selection = {
    ...selection,
    runId: input.runId,
    roundIndex: input.roundIndex,
    stageId: input.stageId ?? null,
  };
  emit();
}

export function closeAgentInspector(): void {
  if (!selection) return;
  selection = null;
  emit();
}

export function closeAgentInspectorIfScopeChanged(
  workspaceId: string | null | undefined,
  threadId: string | null | undefined,
): void {
  if (!selection) return;
  if (
    selection.workspaceId !== workspaceId ||
    selection.threadId !== threadId
  ) {
    selection = null;
    emit();
  }
}

export function getAgentInspectorSelection(): AgentInspectorSelection | null {
  return selection;
}

export function useAgentInspectorSelection(): AgentInspectorSelection | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getAgentInspectorSelection,
    () => null,
  );
}
