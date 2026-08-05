import { useSyncExternalStore } from "react";
import { emitSquadConversationItems } from "../runtime/squadConversationBridge";
import type { SquadProjectionV1 } from "../types";

type StoredProjection = {
  signature: string;
  projection: SquadProjectionV1 | null;
};

type StoredSquadEvidence = {
  runId: string;
  hydrationClaimed: boolean;
};

export type SquadInspectorSelection = {
  workspaceId: string;
  threadId: string;
  runId: string;
  nodeId: string | null;
};

const projections = new Map<string, StoredProjection>();
const squadEvidenceByScope = new Map<string, StoredSquadEvidence>();
const projectionListeners = new Set<() => void>();
const squadEvidenceListeners = new Set<() => void>();
const inspectorListeners = new Set<() => void>();
let inspectorSelection: SquadInspectorSelection | null = null;
const MAX_CACHED_SQUAD_PROJECTIONS = 256;
const MAX_CACHED_SQUAD_EVIDENCE = 256;
const MAX_TRACKED_SQUAD_ATTEMPTS = 4096;
const squadAttemptIds = new Set<string>();

function key(workspaceId: string, threadId: string): string {
  return `${workspaceId}\u0000${threadId}`;
}

function emit(listeners: Set<() => void>): void {
  for (const listener of listeners) listener();
}

export function findCanonicalSquadRunId(items: unknown): string | null {
  if (!Array.isArray(items)) return null;
  let latestRunId: string | null = null;
  for (const candidate of items) {
    if (!candidate || typeof candidate !== "object") continue;
    const item = candidate as Record<string, unknown>;
    if (item.kind !== "message" || item.fidelity !== "canonical") continue;
    if (!item.content || typeof item.content !== "object") continue;
    const content = item.content as Record<string, unknown>;
    const runId =
      typeof content.squadRunId === "string" ? content.squadRunId.trim() : "";
    if (!runId || content.turnId !== `squad:${runId}`) continue;
    if (
      item.id !== `squad:${runId}:user` &&
      item.id !== `squad:${runId}:assistant`
    ) {
      continue;
    }
    latestRunId = runId;
  }
  return latestRunId;
}

export function registerSquadConversationEvidence(
  workspaceId: string,
  threadId: string,
  runId: string,
): void {
  const normalizedRunId = runId.trim();
  if (!workspaceId || !threadId || !normalizedRunId) return;
  const storeKey = key(workspaceId, threadId);
  const current = squadEvidenceByScope.get(storeKey);
  if (current?.runId === normalizedRunId) return;
  squadEvidenceByScope.delete(storeKey);
  squadEvidenceByScope.set(storeKey, {
    runId: normalizedRunId,
    hydrationClaimed: false,
  });
  while (squadEvidenceByScope.size > MAX_CACHED_SQUAD_EVIDENCE) {
    const oldestStoreKey = squadEvidenceByScope.keys().next().value;
    if (!oldestStoreKey) break;
    squadEvidenceByScope.delete(oldestStoreKey);
  }
  emit(squadEvidenceListeners);
}

export function getSquadEvidenceRunId(
  workspaceId: string | null | undefined,
  threadId: string | null | undefined,
): string | null {
  if (!workspaceId || !threadId) return null;
  return squadEvidenceByScope.get(key(workspaceId, threadId))?.runId ?? null;
}

export function useSquadEvidenceRunId(
  workspaceId: string | null | undefined,
  threadId: string | null | undefined,
): string | null {
  return useSyncExternalStore(
    (listener) => {
      squadEvidenceListeners.add(listener);
      return () => squadEvidenceListeners.delete(listener);
    },
    () => getSquadEvidenceRunId(workspaceId, threadId),
    () => null,
  );
}

export function claimSquadHydration(
  workspaceId: string,
  threadId: string,
  runId: string,
): boolean {
  const evidence = squadEvidenceByScope.get(key(workspaceId, threadId));
  if (!evidence || evidence.runId !== runId || evidence.hydrationClaimed) {
    return false;
  }
  evidence.hydrationClaimed = true;
  return true;
}

function rememberSquadAttempt(attemptId: string): void {
  const normalizedAttemptId = attemptId.trim();
  if (!normalizedAttemptId) return;
  squadAttemptIds.delete(normalizedAttemptId);
  squadAttemptIds.add(normalizedAttemptId);
  while (squadAttemptIds.size > MAX_TRACKED_SQUAD_ATTEMPTS) {
    const oldestAttemptId = squadAttemptIds.values().next().value;
    if (!oldestAttemptId) break;
    squadAttemptIds.delete(oldestAttemptId);
  }
}

export function publishSquadProjection(
  workspaceId: string,
  threadId: string,
  projection: SquadProjectionV1 | null,
): void {
  if (projection) {
    registerSquadConversationEvidence(workspaceId, threadId, projection.runId);
  }
  const storeKey = key(workspaceId, threadId);
  const current = projections.get(storeKey);
  // Ordinary Shared Sessions resolve to null. They must not consume Squad cache
  // capacity or evict a real run merely because the user browsed conversations.
  if (!projection && !current) return;
  const signature = JSON.stringify(projection);
  if (current?.signature === signature) return;
  projections.delete(storeKey);
  projections.set(storeKey, { signature, projection });
  while (projections.size > MAX_CACHED_SQUAD_PROJECTIONS) {
    const oldestStoreKey = projections.keys().next().value;
    if (!oldestStoreKey) break;
    projections.delete(oldestStoreKey);
  }
  if (projection) {
    emitSquadConversationItems(workspaceId, threadId, projection);
  }
  for (const attemptId of projection?.activeAttemptIds ?? []) {
    rememberSquadAttempt(attemptId);
  }
  for (const node of projection?.nodes ?? []) {
    for (const attempt of node.attempts) {
      rememberSquadAttempt(attempt.attemptId);
    }
  }
  emit(projectionListeners);
}

export function registerSquadAttempt(attemptId: string): void {
  rememberSquadAttempt(attemptId);
}

export function isSquadAttempt(attemptId: string | null | undefined): boolean {
  return Boolean(attemptId && squadAttemptIds.has(attemptId));
}

export function getSquadProjection(
  workspaceId: string | null | undefined,
  threadId: string | null | undefined,
): SquadProjectionV1 | null {
  if (!workspaceId || !threadId) return null;
  return projections.get(key(workspaceId, threadId))?.projection ?? null;
}

export function useSquadProjection(
  workspaceId: string | null | undefined,
  threadId: string | null | undefined,
): SquadProjectionV1 | null {
  return useSyncExternalStore(
    (listener) => {
      projectionListeners.add(listener);
      return () => projectionListeners.delete(listener);
    },
    () => getSquadProjection(workspaceId, threadId),
    () => null,
  );
}

export function openSquadInspector(
  selection: Omit<SquadInspectorSelection, "nodeId"> & {
    nodeId?: string | null;
  },
): void {
  const next = { ...selection, nodeId: selection.nodeId ?? null };
  if (JSON.stringify(next) === JSON.stringify(inspectorSelection)) return;
  inspectorSelection = next;
  emit(inspectorListeners);
}

export function closeSquadInspector(): void {
  if (!inspectorSelection) return;
  inspectorSelection = null;
  emit(inspectorListeners);
}

export function selectSquadNode(nodeId: string | null): void {
  if (!inspectorSelection || inspectorSelection.nodeId === nodeId) return;
  inspectorSelection = { ...inspectorSelection, nodeId };
  emit(inspectorListeners);
}

export function getSquadInspectorSelection(): SquadInspectorSelection | null {
  return inspectorSelection;
}

export function useSquadInspectorSelection(): SquadInspectorSelection | null {
  return useSyncExternalStore(
    (listener) => {
      inspectorListeners.add(listener);
      return () => inspectorListeners.delete(listener);
    },
    getSquadInspectorSelection,
    () => null,
  );
}

export function closeSquadInspectorIfScopeChanged(
  workspaceId: string | null | undefined,
  threadId: string | null | undefined,
): void {
  if (
    inspectorSelection &&
    (inspectorSelection.workspaceId !== workspaceId ||
      inspectorSelection.threadId !== threadId)
  ) {
    closeSquadInspector();
  }
}
