import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { EngineType } from "../../types";
import { getComposerEnginePrefForEngine } from "../../features/composer/hooks/composerEnginePrefsStore";
import { resolveThreadScopedCollaborationModeSync } from "../sections/utils";
import type { useThreadScopedCollaborationMode } from "./useThreadScopedCollaborationMode";

type ThreadScopedCollaborationMode = ReturnType<
  typeof useThreadScopedCollaborationMode
>;

type CollaborationModeThreadSyncParams = {
  activeEngine: EngineType;
  activeThreadId: string | null;
  activeThreadIdForModeRef: ThreadScopedCollaborationMode["activeThreadIdForModeRef"];
  appSettingsLoading: boolean;
  codexComposerModeRef: ThreadScopedCollaborationMode["codexComposerModeRef"];
  collaborationUiModeByThread: ThreadScopedCollaborationMode["collaborationUiModeByThread"];
  lastCodexModeSyncThreadRef: ThreadScopedCollaborationMode["lastCodexModeSyncThreadRef"];
  selectedCollaborationModeId: string | null;
  setSelectedCollaborationModeId: Dispatch<SetStateAction<string | null>>;
};

export function useCollaborationModeThreadSync({
  activeEngine,
  activeThreadId,
  activeThreadIdForModeRef,
  appSettingsLoading,
  codexComposerModeRef,
  collaborationUiModeByThread,
  lastCodexModeSyncThreadRef,
  selectedCollaborationModeId,
  setSelectedCollaborationModeId,
}: CollaborationModeThreadSyncParams) {
  useEffect(() => {
    activeThreadIdForModeRef.current = activeThreadId;
  }, [activeThreadId, activeThreadIdForModeRef]);

  useEffect(() => {
    const claudePlanCodeDefault =
      getComposerEnginePrefForEngine("claude").collaborationModeId === "plan"
        ? "plan"
        : "code";
    const syncResult = resolveThreadScopedCollaborationModeSync({
      activeEngine,
      activeThreadId,
      mappedMode: activeThreadId
        ? (collaborationUiModeByThread[activeThreadId] ?? null)
        : null,
      selectedCollaborationModeId,
      lastSyncedThreadId: lastCodexModeSyncThreadRef.current,
      newThreadDefaultMode:
        activeEngine === "claude" ? claudePlanCodeDefault : "code",
    });
    if (!syncResult) {
      return;
    }
    lastCodexModeSyncThreadRef.current = syncResult.nextSyncedThreadId;
    codexComposerModeRef.current = syncResult.nextMode;
    if (syncResult.shouldUpdateSelectedMode && syncResult.nextMode) {
      setSelectedCollaborationModeId(syncResult.nextMode);
      return;
    }
  }, [
    activeEngine,
    activeThreadId,
    appSettingsLoading,
    codexComposerModeRef,
    collaborationUiModeByThread,
    lastCodexModeSyncThreadRef,
    selectedCollaborationModeId,
    setSelectedCollaborationModeId,
  ]);
}
