import { useCallback, useMemo, useRef } from "react";
import { connectWorkspace as connectWorkspaceService } from "../../../services/tauri";
import * as tauriServices from "../../../services/tauri";
import { useAutomaticRuntimeRecovery } from "./useAutomaticRuntimeRecovery";
import {
  createArchiveClaudeThreadAction,
  createArchiveThreadAction,
  createDeleteThreadForWorkspaceAction,
  createRenameThreadTitleMappingAction,
} from "./useThreadActions.sessionActions";
import type {
  GeminiSessionSummary,
  GrokSessionSummary,
  KimiSessionSummary,
} from "./useThreadActions.helpers";
import { useThreadActionsSessionRuntime } from "./useThreadActionsSessionRuntime";
import { useThreadActionsSessionCatalog } from "./useThreadActionsSessionCatalog";
import {
  applySessionArchiveState,
  useReconcileMissingClaudeThread,
} from "./useThreadActions.localState";
import { useThreadActionsResumeThreadForWorkspace } from "./useThreadActionsResumeThread";
import { useLoadOlderThreadsForWorkspace } from "./useThreadActionsLoadOlder";
import { useListThreadsForWorkspace } from "./useThreadActionsListThreadsForWorkspace";
import { useThreadHistoryLoadingState } from "./useThreadHistoryLoadingState";
import {
  type LastGoodThreadSummariesByEngine,
  useThreadActionsLastGoodSnapshots,
} from "./useThreadActions.lastGoodSnapshots";
import type { UseThreadActionsOptions } from "./useThreadActions.types";

export function useThreadActions({
  dispatch,
  itemsByThread,
  tokenUsageByThread = {},
  userInputRequests,
  threadsByWorkspace,
  activeThreadIdByWorkspace,
  threadListCursorByWorkspace,
  threadStatusById,
  onDebug,
  getCustomName,
  threadActivityRef,
  loadedThreadsRef,
  replaceOnResumeRef,
  applyCollabThreadLinksFromThread,
  updateThreadParent,
  onThreadTitleMappingsLoaded,
  onRenameThreadTitleMapping,
  onCodexPendingThreadFinalized,
  resolveCanonicalThreadId,
  rememberThreadAlias,
  clearThreadAlias,
  resolveWorkspacePath,
  useUnifiedHistoryLoader = false,
  sessionAttributionMode = "related",
}: UseThreadActionsOptions) {
  const {
    historyLoadingByThreadId,
    historyLoadingProgressByThreadId,
    setThreadHistoryLoading,
    setThreadHistoryLoadingProgress,
    setThreadHistoryRecoveryFailed,
  } = useThreadHistoryLoadingState();
  // Map workspaceId → filesystem path, populated in listThreadsForWorkspace
  const workspacePathsByIdRef = useRef<Record<string, string>>({});
  const geminiSessionCacheRef = useRef<
    Record<string, { fetchedAt: number; sessions: GeminiSessionSummary[] }>
  >({});
  const geminiRefreshAttemptedRef = useRef<Record<string, boolean>>({});
  const kimiSessionCacheRef = useRef<
    Record<string, { fetchedAt: number; sessions: KimiSessionSummary[] }>
  >({});
  const kimiRefreshAttemptedRef = useRef<Record<string, boolean>>({});
  const grokSessionCacheRef = useRef<
    Record<string, { fetchedAt: number; sessions: GrokSessionSummary[] }>
  >({});
  const grokRefreshAttemptedRef = useRef<Record<string, boolean>>({});
  const threadListRequestSeqRef = useRef<Record<string, number>>({});
  const lastGoodThreadSummariesByWorkspaceEngineRef = useRef<
    Record<string, LastGoodThreadSummariesByEngine>
  >({});
  const previousThreadsByWorkspaceRef = useRef(threadsByWorkspace);
  const latestThreadsByWorkspaceRef = useRef(threadsByWorkspace);
  if (latestThreadsByWorkspaceRef.current !== threadsByWorkspace) {
    previousThreadsByWorkspaceRef.current = latestThreadsByWorkspaceRef.current;
  }
  latestThreadsByWorkspaceRef.current = threadsByWorkspace;
  const listWorkspaceSessionsService = Object.prototype.hasOwnProperty.call(
    tauriServices,
    "listWorkspaceSessions",
  )
    ? tauriServices.listWorkspaceSessions
    : null;
  const canListWorkspaceSessions =
    typeof listWorkspaceSessionsService === "function";
  const listWorkspaceSessionArchiveEvidenceService =
    Object.prototype.hasOwnProperty.call(
      tauriServices,
      "listWorkspaceSessionArchiveEvidence",
    )
      ? tauriServices.listWorkspaceSessionArchiveEvidence
      : null;
  const { loadActiveProjectCatalogSessions, loadArchivedSessionMap } =
    useThreadActionsSessionCatalog({
      canListWorkspaceSessions,
      listWorkspaceSessionsService,
      listWorkspaceSessionArchiveEvidenceService,
    });
  const {
    beginAutomaticRuntimeRecovery,
    getAutomaticRuntimeRecoveryPartialSource,
  } = useAutomaticRuntimeRecovery(connectWorkspaceService);
  const {
    getLastGoodThreadSummaries,
    getLastGoodThreadSummariesForEngine,
    rememberLastGoodThreadSummariesByEngine,
    removeThreadFromCachedSummaries,
  } = useThreadActionsLastGoodSnapshots({
    latestThreadsByWorkspaceRef,
    previousThreadsByWorkspaceRef,
    lastGoodThreadSummariesByWorkspaceEngineRef,
    threadsByWorkspace,
  });

  const reconcileMissingClaudeThread = useReconcileMissingClaudeThread({
    activeThreadIdByWorkspace,
    dispatch,
    itemsByThread,
    loadedThreadsRef,
    onDebug,
    removeThreadFromCachedSummaries,
  });

  const renameThreadTitleMapping = useMemo(
    () =>
      createRenameThreadTitleMappingAction({
        getCustomName,
        onRenameThreadTitleMapping,
      }),
    [getCustomName, onRenameThreadTitleMapping],
  );

  const resumeThreadForWorkspace = useThreadActionsResumeThreadForWorkspace({
    activeThreadIdByWorkspace,
    applyCollabThreadLinksFromThread,
    dispatch,
    getCustomName,
    itemsByThread,
    tokenUsageByThread,
    loadedThreadsRef,
    onDebug,
    resolveCanonicalThreadId,
    rememberThreadAlias,
    clearThreadAlias,
    replaceOnResumeRef,
    reconcileMissingClaudeThread,
    resolveWorkspacePath,
    threadActivityRef,
    threadStatusById,
    threadsByWorkspace,
    updateThreadParent,
    userInputRequests,
    useUnifiedHistoryLoader,
    workspacePathsByIdRef,
    latestThreadsByWorkspaceRef,
    previousThreadsByWorkspaceRef,
    threadListCursorByWorkspace,
    setThreadHistoryRecoveryFailed,
    setThreadHistoryLoadingProgress,
  });

  const {
    startThreadForWorkspace,
    finalizeCodexPendingThread,
    startSharedSessionForWorkspace,
    forkThreadForWorkspace,
    forkClaudeSessionFromMessageForWorkspace,
    forkSessionFromMessageForWorkspace,
  } = useThreadActionsSessionRuntime({
    activeThreadIdByWorkspace,
    dispatch,
    itemsByThread,
    loadedThreadsRef,
    onCodexPendingThreadFinalized,
    onDebug,
    renameThreadTitleMapping,
    resumeThreadForWorkspace,
    threadsByWorkspace,
    workspacePathsByIdRef,
  });

  const refreshThread = useCallback(
    async (workspaceId: string, threadId: string) => {
      if (!threadId) {
        return null;
      }
      replaceOnResumeRef.current[threadId] = true;
      return resumeThreadForWorkspace(workspaceId, threadId, true, true);
    },
    [replaceOnResumeRef, resumeThreadForWorkspace],
  );

  const resetWorkspaceThreads = useCallback(
    (workspaceId: string) => {
      const threadIds = new Set<string>();
      const list = threadsByWorkspace[workspaceId] ?? [];
      list.forEach((thread) => threadIds.add(thread.id));
      const activeThread = activeThreadIdByWorkspace[workspaceId];
      if (activeThread) {
        threadIds.add(activeThread);
      }
      threadIds.forEach((threadId) => {
        loadedThreadsRef.current[threadId] = false;
      });
    },
    [activeThreadIdByWorkspace, loadedThreadsRef, threadsByWorkspace],
  );

  const listThreadsForWorkspace = useListThreadsForWorkspace({
    activeThreadIdByWorkspace,
    beginAutomaticRuntimeRecovery,
    canListWorkspaceSessions,
    dispatch,
    getAutomaticRuntimeRecoveryPartialSource,
    getCustomName,
    getLastGoodThreadSummaries,
    getLastGoodThreadSummariesForEngine,
    geminiRefreshAttemptedRef,
    geminiSessionCacheRef,
    grokRefreshAttemptedRef,
    grokSessionCacheRef,
    kimiRefreshAttemptedRef,
    kimiSessionCacheRef,
    latestThreadsByWorkspaceRef,
    loadActiveProjectCatalogSessions,
    loadArchivedSessionMap,
    loadedThreadsRef,
    onDebug,
    onThreadTitleMappingsLoaded,
    rememberLastGoodThreadSummariesByEngine,
    removeThreadFromCachedSummaries,
    sessionAttributionMode,
    threadActivityRef,
    threadListRequestSeqRef,
    threadsByWorkspace,
    workspacePathsByIdRef,
  });

  const loadOlderThreadsForWorkspace = useLoadOlderThreadsForWorkspace({
    activeThreadIdByWorkspace,
    applySessionArchiveState,
    canListWorkspaceSessions,
    dispatch,
    getCustomName,
    latestThreadsByWorkspaceRef,
    listWorkspaceSessionsService,
    loadArchivedSessionMap,
    onDebug,
    onThreadTitleMappingsLoaded,
    sessionAttributionMode,
    threadListCursorByWorkspace,
    threadsByWorkspace,
    workspacePathsByIdRef,
  });

  const archiveThread = useMemo(
    () => createArchiveThreadAction({ onDebug }),
    [onDebug],
  );

  const archiveClaudeThread = useMemo(
    () => createArchiveClaudeThreadAction({ onDebug, workspacePathsByIdRef }),
    [onDebug, workspacePathsByIdRef],
  );

  const deleteThreadForWorkspace = useMemo(() => {
    const deleteThread = createDeleteThreadForWorkspaceAction({
      archiveClaudeThread,
      threadsByWorkspace,
      workspacePathsByIdRef,
    });
    return async (workspaceId: string, threadId: string) => {
      await deleteThread(workspaceId, threadId);
      removeThreadFromCachedSummaries(workspaceId, threadId);
    };
  }, [
    archiveClaudeThread,
    removeThreadFromCachedSummaries,
    threadsByWorkspace,
    workspacePathsByIdRef,
  ]);

  return {
    startThreadForWorkspace,
    finalizeCodexPendingThread,
    startSharedSessionForWorkspace,
    forkThreadForWorkspace,
    forkSessionFromMessageForWorkspace,
    forkClaudeSessionFromMessageForWorkspace,
    resumeThreadForWorkspace,
    refreshThread,
    resetWorkspaceThreads,
    listThreadsForWorkspace,
    loadOlderThreadsForWorkspace,
    archiveThread,
    archiveClaudeThread,
    deleteThreadForWorkspace,
    renameThreadTitleMapping,
    setThreadHistoryLoading,
    setThreadHistoryLoadingProgress,
    historyLoadingByThreadId,
    historyLoadingProgressByThreadId,
  };
}
