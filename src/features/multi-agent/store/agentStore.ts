import { useSyncExternalStore } from "react";

import {
  normalizeAgentProjection,
  type AgentProjectionV1,
} from "../types";
import { emitMultiAgentConversationItems } from "../runtime/conversationBridge";

type ScopeKey = string;

const projections = new Map<ScopeKey, AgentProjectionV1 | null>();
const evidenceByScope = new Map<ScopeKey, string>();
const attemptIds = new Set<string>();
type AttemptOwner = {
  workspaceId: string;
  threadId: string;
  phase: string;
  bindingKey?: string;
};
const attemptOwners = new Map<string, AttemptOwner>();
const ownersByBindingKey = new Map<string, AttemptOwner & { attemptId: string }>();
const listeners = new Set<() => void>();
const evidenceListeners = new Set<() => void>();

const MAX_PROJECTIONS = 256;
const MAX_ATTEMPTS = 4096;

function scopeKey(workspaceId: string, threadId: string): ScopeKey {
  return `${workspaceId}\u0000${threadId}`;
}

function emit(set: Set<() => void>): void {
  for (const listener of set) listener();
}

export function publishAgentProjection(
  workspaceId: string,
  threadId: string,
  projection: AgentProjectionV1 | null,
): void {
  const key = scopeKey(workspaceId, threadId);
  const normalized = normalizeAgentProjection(projection);
  if (normalized) {
    evidenceByScope.set(key, normalized.runId);
    emitMultiAgentConversationItems(workspaceId, threadId, normalized);
    for (const attemptId of normalized.activeAttemptIds ?? []) {
      rememberAttempt(attemptId);
    }
    for (const stage of normalized.stages ?? []) {
      if (stage.attemptId) {
        rememberAttempt(stage.attemptId, {
          workspaceId,
          threadId,
          phase: stage.id,
          bindingKey: stage.bindingKey ?? undefined,
        });
      }
    }
  }
  if (!normalized && !projections.has(key)) {
    return;
  }
  projections.set(key, normalized);
  while (projections.size > MAX_PROJECTIONS) {
    const oldest = projections.keys().next().value;
    if (!oldest) break;
    projections.delete(oldest);
  }
  emit(listeners);
  emit(evidenceListeners);
}

function rememberAttempt(
  attemptId: string,
  owner?: AttemptOwner,
): void {
  const normalized = attemptId.trim();
  if (!normalized) return;
  attemptIds.delete(normalized);
  attemptIds.add(normalized);
  if (owner) {
    attemptOwners.set(normalized, owner);
    const binding = owner.bindingKey?.trim();
    if (binding) {
      ownersByBindingKey.set(binding, { ...owner, attemptId: normalized });
    }
  }
  while (attemptIds.size > MAX_ATTEMPTS) {
    const oldest = attemptIds.values().next().value;
    if (!oldest) break;
    const stale = attemptOwners.get(oldest);
    attemptIds.delete(oldest);
    attemptOwners.delete(oldest);
    if (stale?.bindingKey) ownersByBindingKey.delete(stale.bindingKey);
  }
}

export function registerAgentAttempt(
  attemptId: string,
  owner?: AttemptOwner,
): void {
  rememberAttempt(attemptId, owner);
}

export function isAgentAttempt(attemptId: string | null | undefined): boolean {
  return Boolean(attemptId && attemptIds.has(attemptId));
}

export function getAgentAttemptOwner(
  attemptId: string | null | undefined,
): AttemptOwner | null {
  if (!attemptId) return null;
  return attemptOwners.get(attemptId) ?? null;
}

export function resolveAgentAttemptOwner(input: {
  attemptId?: string | null;
  bindingKey?: string | null;
}): (AttemptOwner & { attemptId: string }) | null {
  const byAttempt = input.attemptId
    ? attemptOwners.get(input.attemptId)
    : null;
  if (byAttempt && input.attemptId) {
    return { ...byAttempt, attemptId: input.attemptId };
  }
  const binding = input.bindingKey?.trim();
  if (binding) {
    return ownersByBindingKey.get(binding) ?? null;
  }
  return null;
}

export function getAgentProjection(
  workspaceId: string | null | undefined,
  threadId: string | null | undefined,
): AgentProjectionV1 | null {
  if (!workspaceId || !threadId) return null;
  return projections.get(scopeKey(workspaceId, threadId)) ?? null;
}

export function useAgentProjection(
  workspaceId: string | null | undefined,
  threadId: string | null | undefined,
): AgentProjectionV1 | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => getAgentProjection(workspaceId, threadId),
    () => null,
  );
}

export function getAgentEvidenceRunId(
  workspaceId: string | null | undefined,
  threadId: string | null | undefined,
): string | null {
  if (!workspaceId || !threadId) return null;
  return evidenceByScope.get(scopeKey(workspaceId, threadId)) ?? null;
}

export function useAgentEvidenceRunId(
  workspaceId: string | null | undefined,
  threadId: string | null | undefined,
): string | null {
  return useSyncExternalStore(
    (listener) => {
      evidenceListeners.add(listener);
      return () => evidenceListeners.delete(listener);
    },
    () => getAgentEvidenceRunId(workspaceId, threadId),
    () => null,
  );
}

export function claimAgentHydration(
  workspaceId: string,
  threadId: string,
  expectedRunId: string,
): boolean {
  const evidence = evidenceByScope.get(scopeKey(workspaceId, threadId));
  return evidence === expectedRunId;
}

export function registerAgentConversationEvidence(
  workspaceId: string,
  threadId: string,
  runId: string,
): void {
  const key = scopeKey(workspaceId, threadId);
  evidenceByScope.set(key, runId);
  emit(evidenceListeners);
}

export function findCanonicalAgentRunId(items: unknown): string | null {
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as { id?: unknown; content?: unknown };
    const content =
      row.content && typeof row.content === "object"
        ? (row.content as Record<string, unknown>)
        : null;
    if (!content) continue;
    const runId =
      typeof content.squadRunId === "string"
        ? content.squadRunId.trim()
        : typeof content.agentRunId === "string"
          ? content.agentRunId.trim()
          : "";
    if (!runId) continue;
    const turnId =
      typeof content.turnId === "string" ? content.turnId.trim() : "";
    if (turnId !== `squad:${runId}` && turnId !== `agent:${runId}`) continue;
    return runId;
  }
  return null;
}
