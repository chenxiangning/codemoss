import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { getClientStoreSync, writeClientStoreValue } from "../../services/clientStorage";
import { listAgentConfigs, listBuiltInAgents } from "../../services/tauri/agents";
import type { DebugEntry, SelectedAgentOption } from "../../types";
import {
  BUILT_IN_AGENT_CATALOG_CHANGED_EVENT,
  BUILT_IN_AGENT_RESOLUTION_FAILED_EVENT,
} from "@mossx/plugin-agent-catalog/runtime";
import {
  getThreadAgentSelectionStorageKey,
  normalizeSelectedAgentOption,
  parseStoredThreadAgentSelectionEntry,
  shouldApplyDraftAgentToThread,
  shouldMigrateSelectedAgentBetweenThreadIds,
} from "./selectedAgentSession";

function resolveSelectedAgentFromCatalog(
  candidate: SelectedAgentOption | null,
  catalogById: Record<string, SelectedAgentOption> | null,
): SelectedAgentOption | null {
  if (!candidate) {
    return null;
  }
  if (catalogById === null) {
    return candidate;
  }
  const catalogAgent = catalogById[candidate.id];
  if (catalogAgent) {
    return catalogAgent;
  }
  if (candidate.source === "builtIn") {
    return null;
  }
  return candidate;
}

type UseSelectedAgentSessionOptions = {
  activeThreadId: string | null;
  activeWorkspaceId: string | null;
  resolveCanonicalThreadId: (threadId: string) => string;
  onDebug?: (entry: DebugEntry) => void;
};

type UseSelectedAgentSessionResult = {
  selectedAgent: SelectedAgentOption | null;
  selectedAgentRef: MutableRefObject<SelectedAgentOption | null>;
  handleSelectAgent: (agent: SelectedAgentOption | null) => void;
  reloadSelectedAgent: () => void;
  reloadAgentCatalog: () => Promise<void>;
};

const selectedAgentSelectionsEqual = <T extends object>(
  left: T | null | undefined,
  right: T | null | undefined,
): boolean => {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;

  return leftKeys.every((key) => Object.is(leftRecord[key], rightRecord[key]));
};

export function useSelectedAgentSession({
  activeThreadId,
  activeWorkspaceId,
  resolveCanonicalThreadId,
  onDebug,
}: UseSelectedAgentSessionOptions): UseSelectedAgentSessionResult {
  const { i18n } = useTranslation();
  const [, setSelectedAgentBySessionKey] = useState<
    Record<string, SelectedAgentOption | null>
  >({});
  const selectedAgentBySessionKeyRef = useRef<
    Record<string, SelectedAgentOption | null>
  >({});
  const [agentCatalogById, setAgentCatalogById] = useState<
    Record<string, SelectedAgentOption> | null
  >(null);
  const [draftSelectedAgent, setDraftSelectedAgent] = useState<SelectedAgentOption | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<SelectedAgentOption | null>(null);
  const selectedAgentRef = useRef<SelectedAgentOption | null>(null);
  const draftSelectedAgentWorkspaceIdRef = useRef<string | null>(null);
  const shouldApplyDraftAgentToNextThreadRef = useRef(false);
  const mountedRef = useRef(false);
  const catalogLoadSequenceRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      catalogLoadSequenceRef.current += 1;
    };
  }, []);

  const resolveSelectedAgentSessionKey = useCallback(
    (workspaceId: string | null, threadId: string | null): string | null => {
      if (!threadId) {
        return null;
      }
      return getThreadAgentSelectionStorageKey(workspaceId, threadId);
    },
    [],
  );

  const cacheSelectedAgentForSessionKey = useCallback(
    (sessionKey: string, agent: SelectedAgentOption | null) => {
      const currentCache = selectedAgentBySessionKeyRef.current;
      if (selectedAgentSelectionsEqual(currentCache[sessionKey] ?? null, agent)) {
        return;
      }
      selectedAgentBySessionKeyRef.current = {
        ...currentCache,
        [sessionKey]: agent,
      };
      setSelectedAgentBySessionKey((currentState) => {
        if (selectedAgentSelectionsEqual(currentState[sessionKey] ?? null, agent)) {
          return currentState;
        }
        return {
          ...currentState,
          [sessionKey]: agent,
        };
      });
    },
    [],
  );

  const writeSelectedAgentForSessionKey = useCallback(
    (sessionKey: string, agent: SelectedAgentOption | null) => {
      cacheSelectedAgentForSessionKey(sessionKey, agent);
      const stored = parseStoredThreadAgentSelectionEntry(
        getClientStoreSync<unknown>("app", sessionKey),
      );
      if (stored.exists && selectedAgentSelectionsEqual(stored.value, agent)) {
        return;
      }
      writeClientStoreValue("app", sessionKey, agent);
    },
    [cacheSelectedAgentForSessionKey],
  );

  const reloadAgentCatalog = useCallback(async () => {
    const loadSequence = catalogLoadSequenceRef.current + 1;
    catalogLoadSequenceRef.current = loadSequence;
    try {
      const [configs, builtInCatalog] = await Promise.all([
        listAgentConfigs(),
        listBuiltInAgents(i18n.resolvedLanguage ?? i18n.language),
      ]);
      const nextCatalog: Record<string, SelectedAgentOption> = {};
      for (const config of configs) {
        const normalized = normalizeSelectedAgentOption({
          id: config.id,
          name: config.name,
          prompt: config.prompt ?? null,
          icon: config.icon ?? null,
          source: "custom",
        });
        if (normalized) {
          nextCatalog[normalized.id] = normalized;
        }
      }
      for (const agent of builtInCatalog.agents) {
        if (!agent.enabled) {
          continue;
        }
        const normalized = normalizeSelectedAgentOption({
          id: agent.id,
          name: agent.name,
          prompt: null,
          icon: null,
          source: "builtIn",
          divisionId: agent.divisionId,
          divisionLabel:
            builtInCatalog.divisions.find(
              (division) => division.id === agent.divisionId,
            )?.label ?? null,
          sourceRevision: agent.sourceRevision,
          promptHash: agent.promptHash,
        });
        if (normalized) {
          nextCatalog[normalized.id] = normalized;
        }
      }
      if (
        mountedRef.current
        && loadSequence === catalogLoadSequenceRef.current
      ) {
        setAgentCatalogById(nextCatalog);
      }
    } catch (error) {
      if (
        mountedRef.current
        && loadSequence === catalogLoadSequenceRef.current
      ) {
        onDebug?.({
          id: `${Date.now()}-agent-catalog-load-error`,
          timestamp: Date.now(),
          source: "error",
          label: "agent/catalog load error",
          payload: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }, [i18n.language, i18n.resolvedLanguage, onDebug]);

  useEffect(() => {
    const handleCatalogChanged = () => {
      void reloadAgentCatalog();
    };
    window.addEventListener(
      BUILT_IN_AGENT_CATALOG_CHANGED_EVENT,
      handleCatalogChanged,
    );
    return () => {
      window.removeEventListener(
        BUILT_IN_AGENT_CATALOG_CHANGED_EVENT,
        handleCatalogChanged,
      );
    };
  }, [reloadAgentCatalog]);

  const handleSelectAgent = useCallback(
    (agent: SelectedAgentOption | null) => {
      const normalized = normalizeSelectedAgentOption(agent);
      const normalizedFromCatalog = normalized
        ? (agentCatalogById?.[normalized.id] ?? normalized)
        : null;
      selectedAgentRef.current = normalizedFromCatalog;
      setSelectedAgent(normalizedFromCatalog);
      if (!activeThreadId) {
        setDraftSelectedAgent(normalizedFromCatalog);
        draftSelectedAgentWorkspaceIdRef.current = activeWorkspaceId ?? null;
        shouldApplyDraftAgentToNextThreadRef.current = true;
        return;
      }
      shouldApplyDraftAgentToNextThreadRef.current = false;
      const sessionKey = resolveSelectedAgentSessionKey(activeWorkspaceId, activeThreadId);
      if (!sessionKey) {
        return;
      }
      writeSelectedAgentForSessionKey(sessionKey, normalizedFromCatalog);
    },
    [
      activeThreadId,
      activeWorkspaceId,
      agentCatalogById,
      resolveSelectedAgentSessionKey,
      writeSelectedAgentForSessionKey,
    ],
  );

  useEffect(() => {
    const handleResolutionFailed = (event: Event) => {
      const failedAgentId = (event as CustomEvent<{ agentId?: string }>).detail
        ?.agentId;
      if (
        !failedAgentId
        || selectedAgentRef.current?.source !== "builtIn"
        || selectedAgentRef.current.id !== failedAgentId
      ) {
        return;
      }
      handleSelectAgent(null);
    };
    window.addEventListener(
      BUILT_IN_AGENT_RESOLUTION_FAILED_EVENT,
      handleResolutionFailed,
    );
    return () => {
      window.removeEventListener(
        BUILT_IN_AGENT_RESOLUTION_FAILED_EVENT,
        handleResolutionFailed,
      );
    };
  }, [handleSelectAgent]);

  const reloadSelectedAgent = useCallback(() => {
    if (!activeThreadId) {
      const draftForActiveWorkspace =
        draftSelectedAgentWorkspaceIdRef.current === (activeWorkspaceId ?? null)
          ? draftSelectedAgent
          : null;
      selectedAgentRef.current = draftForActiveWorkspace;
      setSelectedAgent(draftForActiveWorkspace);
      return;
    }
    const sessionKey = resolveSelectedAgentSessionKey(activeWorkspaceId, activeThreadId);
    if (!sessionKey) {
      selectedAgentRef.current = null;
      setSelectedAgent(null);
      return;
    }

    let candidate: SelectedAgentOption | null = null;
    let hasCandidate = false;
    const selectedAgentBySessionKey = selectedAgentBySessionKeyRef.current;
    if (sessionKey in selectedAgentBySessionKey) {
      candidate = selectedAgentBySessionKey[sessionKey] ?? null;
      hasCandidate = true;
    } else {
      const stored = parseStoredThreadAgentSelectionEntry(
        getClientStoreSync<unknown>("app", sessionKey),
      );
      candidate = stored.value;
      hasCandidate = stored.exists;
      const shouldApplyDraftSelection =
        draftSelectedAgentWorkspaceIdRef.current === (activeWorkspaceId ?? null)
        && shouldApplyDraftAgentToThread({
          candidate,
          shouldApplyDraftToNextThread: shouldApplyDraftAgentToNextThreadRef.current,
          draftSelectedAgent,
          activeThreadId,
        });
      if (shouldApplyDraftSelection) {
        candidate = draftSelectedAgent;
        hasCandidate = true;
        shouldApplyDraftAgentToNextThreadRef.current = false;
        writeClientStoreValue("app", sessionKey, candidate);
      }
      if (hasCandidate) {
        writeSelectedAgentForSessionKey(sessionKey, candidate ?? null);
      }
    }

    const resolved = resolveSelectedAgentFromCatalog(
      candidate,
      agentCatalogById,
    );
    selectedAgentRef.current = resolved;
    setSelectedAgent((currentAgent) =>
      selectedAgentSelectionsEqual(currentAgent, resolved) ? currentAgent : resolved
    );

    if (
      resolved
      && (!candidate
        || candidate.name !== resolved.name
        || (candidate.prompt ?? null) !== (resolved.prompt ?? null)
        || (candidate.icon ?? null) !== (resolved.icon ?? null))
    ) {
      writeSelectedAgentForSessionKey(sessionKey, resolved);
    } else if (!resolved && candidate?.source === "builtIn") {
      writeSelectedAgentForSessionKey(sessionKey, null);
    }
  }, [
    activeThreadId,
    activeWorkspaceId,
    draftSelectedAgent,
    agentCatalogById,
    resolveSelectedAgentSessionKey,
    writeSelectedAgentForSessionKey,
  ]);

  const previousThreadIdForDraftCarryRef = useRef<string | null>(activeThreadId ?? null);
  useEffect(() => {
    const previousThreadId = previousThreadIdForDraftCarryRef.current;
    if (previousThreadId && !activeThreadId) {
      const latestSelectedAgent = selectedAgentRef.current;
      setDraftSelectedAgent(latestSelectedAgent ?? null);
      draftSelectedAgentWorkspaceIdRef.current = activeWorkspaceId ?? null;
      shouldApplyDraftAgentToNextThreadRef.current = Boolean(latestSelectedAgent);
    }
    previousThreadIdForDraftCarryRef.current = activeThreadId ?? null;
  }, [activeThreadId, activeWorkspaceId]);

  const previousThreadIdRef = useRef<string | null>(null);
  const previousThreadWorkspaceIdRef = useRef<string | null>(null);
  const lastAgentSelectionMigrationRef = useRef<string | null>(null);
  useEffect(() => {
    const previousThreadId = previousThreadIdRef.current;
    const previousWorkspaceId = previousThreadWorkspaceIdRef.current;
    const previousSelectedAgentSessionKey = resolveSelectedAgentSessionKey(
      previousWorkspaceId,
      previousThreadId ?? null,
    );
    const activeSelectedAgentSessionKey = resolveSelectedAgentSessionKey(
      activeWorkspaceId,
      activeThreadId,
    );
    const selectedAgentBySessionKey = selectedAgentBySessionKeyRef.current;
    const previousSelectedAgentFromMemory =
      previousSelectedAgentSessionKey &&
      Object.prototype.hasOwnProperty.call(
        selectedAgentBySessionKey,
        previousSelectedAgentSessionKey,
      )
        ? selectedAgentBySessionKey[previousSelectedAgentSessionKey] ?? null
        : null;
    const activeSelectedAgentFromMemory =
      activeSelectedAgentSessionKey &&
      Object.prototype.hasOwnProperty.call(
        selectedAgentBySessionKey,
        activeSelectedAgentSessionKey,
      )
        ? selectedAgentBySessionKey[activeSelectedAgentSessionKey] ?? null
        : null;
    const previousSelectedAgentFromStore =
      previousSelectedAgentSessionKey
        ? parseStoredThreadAgentSelectionEntry(
            getClientStoreSync<unknown>("app", previousSelectedAgentSessionKey),
          ).value
        : null;
    const activeSelectedAgentFromStore =
      activeSelectedAgentSessionKey
        ? parseStoredThreadAgentSelectionEntry(
            getClientStoreSync<unknown>("app", activeSelectedAgentSessionKey),
          ).value
        : null;
    const previousSelectedAgentValue =
      previousSelectedAgentFromMemory ?? previousSelectedAgentFromStore;
    const activeSelectedAgentValue =
      activeSelectedAgentFromMemory ?? activeSelectedAgentFromStore;
    const shouldMigrateAgentSelection = shouldMigrateSelectedAgentBetweenThreadIds({
      previousThreadId,
      activeThreadId,
      previousSessionKey: previousSelectedAgentSessionKey,
      activeSessionKey: activeSelectedAgentSessionKey,
      hasSourceSelection: Boolean(previousSelectedAgentValue),
      hasTargetSelection: Boolean(activeSelectedAgentValue),
      resolveCanonicalThreadId,
    });
    if (
      shouldMigrateAgentSelection
      && previousSelectedAgentSessionKey
      && activeSelectedAgentSessionKey
    ) {
      const migrationKey = [
        previousWorkspaceId ?? "",
        previousThreadId ?? "",
        activeWorkspaceId ?? "",
        activeThreadId ?? "",
        previousSelectedAgentSessionKey,
        activeSelectedAgentSessionKey,
      ].join("\u0000");
      if (lastAgentSelectionMigrationRef.current !== migrationKey) {
        lastAgentSelectionMigrationRef.current = migrationKey;
        writeSelectedAgentForSessionKey(
          activeSelectedAgentSessionKey,
          previousSelectedAgentValue,
        );
      }
    }
    previousThreadIdRef.current = activeThreadId ?? null;
    previousThreadWorkspaceIdRef.current = activeWorkspaceId ?? null;
  }, [
    activeThreadId,
    activeWorkspaceId,
    resolveCanonicalThreadId,
    resolveSelectedAgentSessionKey,
    writeSelectedAgentForSessionKey,
  ]);

  useEffect(() => {
    reloadSelectedAgent();
  }, [reloadSelectedAgent]);

  return {
    selectedAgent,
    selectedAgentRef,
    handleSelectAgent,
    reloadSelectedAgent,
    reloadAgentCatalog,
  };
}
