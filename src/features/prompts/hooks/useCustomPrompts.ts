import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CustomPromptOption, DebugEntry, WorkspaceInfo } from "../../../types";
import {
  createPrompt as createPromptService,
  deletePrompt as deletePromptService,
  getPromptsList,
  getGlobalPromptsDir as getGlobalPromptsDirService,
  getWorkspacePromptsDir as getWorkspacePromptsDirService,
  movePrompt as movePromptService,
  updatePrompt as updatePromptService,
} from "../../../services/tauri";
import { pushErrorToast } from "../../../services/toasts";
import { scheduleCatalogIdlePrewarm } from "../../startup-orchestration/utils/scheduleCatalogIdlePrewarm";
import { startupOrchestrator } from "../../startup-orchestration/utils/startupOrchestrator";
import {
  dispatchCustomPromptsChanged,
  subscribeCustomPromptsChanged,
  subscribeCustomPromptsRefresh,
} from "../promptEvents";

type UseCustomPromptsOptions = {
  activeWorkspace: WorkspaceInfo | null;
  onDebug?: (entry: DebugEntry) => void;
};

type PromptRefreshPhase = "idle-prewarm" | "on-demand";

/**
 * orchestrator 取消/过期（切 workspace、force-enter 等）走 fallback("stale"|"cancelled")。
 * 这是预期语义，不是加载失败，禁止 error toast / 清空已有列表 / stamp 权威成功。
 */
function isSoftCancelledPromptsReason(reason: string | null): boolean {
  return reason === "stale" || reason === "cancelled";
}

function withPromptNames(list: CustomPromptOption[]): CustomPromptOption[] {
  return list.filter((prompt) => prompt.name);
}

export function useCustomPrompts({ activeWorkspace, onDebug }: UseCustomPromptsOptions) {
  const { t } = useTranslation();
  const [prompts, setPrompts] = useState<CustomPromptOption[]>([]);
  const [promptsError, setPromptsError] = useState<string | null>(null);
  const lastFetchedWorkspaceId = useRef<string | null>(null);
  const inFlightPromise = useRef<Promise<CustomPromptOption[]> | null>(null);
  const promptsRef = useRef<CustomPromptOption[]>([]);

  const workspaceId = activeWorkspace?.id ?? null;
  const isConnected = Boolean(activeWorkspace?.connected);

  // t 在未初始化 i18n 的测试环境可能每次 render 换引用；经 ref 读取避免 refresh 失稳。
  const tRef = useRef(t);
  tRef.current = t;

  const logPromptError = useCallback(
    (idSuffix: string, label: string, error: unknown) => {
      const timestamp = Date.now();
      onDebug?.({
        id: `${timestamp}-${idSuffix}`,
        timestamp,
        source: "error",
        label,
        payload: error instanceof Error ? error.message : String(error),
      });
    },
    [onDebug],
  );

  const reportPromptsFailure = useCallback((reason: string) => {
    setPromptsError(reason);
    pushErrorToast({
      id: "prompts-list-unavailable",
      title: tRef.current("chat.promptsListUnavailableTitle"),
      message: tRef.current("chat.promptsListUnavailableMessage", { reason }),
      variant: "error",
    });
  }, []);

  const commitPrompts = useCallback((next: CustomPromptOption[]) => {
    const normalized = withPromptNames(next);
    promptsRef.current = normalized;
    setPrompts(normalized);
    return normalized;
  }, []);

  const refreshPrompts = useCallback(
    async (
      phase: PromptRefreshPhase = "on-demand",
      options?: { skipIfAuthoritative?: boolean },
    ): Promise<CustomPromptOption[]> => {
      if (!workspaceId || !isConnected) {
        return promptsRef.current;
      }
      if (
        options?.skipIfAuthoritative &&
        lastFetchedWorkspaceId.current === workspaceId
      ) {
        return promptsRef.current;
      }
      if (inFlightPromise.current) {
        return inFlightPromise.current;
      }

      const task = (async (): Promise<CustomPromptOption[]> => {
        onDebug?.({
          id: `${Date.now()}-client-prompts-list`,
          timestamp: Date.now(),
          source: "client",
          label: "prompts/list",
          payload: { workspaceId, phase },
        });
        let failedReason: string | null = null;
        try {
          const response = await startupOrchestrator.run({
            id: `prompts-list:${workspaceId}`,
            phase,
            priority: phase === "on-demand" ? 80 : 25,
            dedupeKey: `prompts-list:${workspaceId}`,
            concurrencyKey: "catalog",
            timeoutMs: 5_000,
            workspaceScope: { workspaceId },
            cancelPolicy: "soft-ignore",
            traceLabel: "prompts/list",
            commandLabel: "prompts_list",
            run: () => getPromptsList(workspaceId),
            fallback: (reason) => {
              failedReason = String(reason);
              return [];
            },
          });
          onDebug?.({
            id: `${Date.now()}-server-prompts-list`,
            timestamp: Date.now(),
            source: "server",
            label: "prompts/list response",
            payload: {
              failedReason,
              count: Array.isArray(response) ? response.length : 0,
            },
          });

          if (isSoftCancelledPromptsReason(failedReason)) {
            // 保留已有列表；不 stamp 权威成功，允许后续 on-demand / 事件 / ! revalidate 再拉。
            return promptsRef.current;
          }

          if (failedReason) {
            reportPromptsFailure(failedReason);
            // 硬失败：有旧列表则保留；空列表不 stamp lastFetched，保证可重试。
            if (promptsRef.current.length > 0) {
              return promptsRef.current;
            }
            return [];
          }

          const next = Array.isArray(response) ? response : [];
          const committed = commitPrompts(next);
          lastFetchedWorkspaceId.current = workspaceId;
          setPromptsError(null);
          return committed;
        } catch (error) {
          logPromptError("client-prompts-list-error", "prompts/list error", error);
          reportPromptsFailure(
            error instanceof Error ? error.message : String(error),
          );
          if (promptsRef.current.length > 0) {
            return promptsRef.current;
          }
          return [];
        }
      })();

      inFlightPromise.current = task;
      try {
        return await task;
      } finally {
        if (inFlightPromise.current === task) {
          inFlightPromise.current = null;
        }
      }
    },
    [
      commitPrompts,
      isConnected,
      logPromptError,
      onDebug,
      reportPromptsFailure,
      workspaceId,
    ],
  );

  useEffect(() => {
    if (!workspaceId || !isConnected) {
      return;
    }
    if (lastFetchedWorkspaceId.current === workspaceId) {
      return;
    }
    // P1-3/P1-4: defer catalog prewarm past StartupGate when workspace is active.
    return scheduleCatalogIdlePrewarm({
      run: () => {
        if (lastFetchedWorkspaceId.current === workspaceId) {
          return;
        }
        void refreshPrompts("idle-prewarm");
      },
    });
  }, [isConnected, refreshPrompts, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !isConnected) {
      return;
    }
    return subscribeCustomPromptsChanged((changedWorkspaceId) => {
      if (changedWorkspaceId !== workspaceId) {
        return;
      }
      void refreshPrompts("on-demand");
    });
  }, [isConnected, refreshPrompts, workspaceId]);

  // 供 `!` 空态 revalidate 等跨层调用方共享 refresh（双 hook 实例均注册，orchestrator dedupe）。
  useEffect(() => {
    if (!workspaceId || !isConnected) {
      return;
    }
    return subscribeCustomPromptsRefresh(
      async (requestedWorkspaceId, phase, options) => {
        if (requestedWorkspaceId !== workspaceId) {
          return;
        }
        return refreshPrompts(phase ?? "on-demand", options);
      },
    );
  }, [isConnected, refreshPrompts, workspaceId]);

  const promptOptions = useMemo(
    () => prompts.filter((prompt) => prompt.name),
    [prompts],
  );

  const requireWorkspaceId = useCallback(() => {
    if (!workspaceId) {
      throw new Error("No workspace selected.");
    }
    return workspaceId;
  }, [workspaceId]);

  const createPrompt = useCallback(
    async (data: {
      scope: "workspace" | "global";
      name: string;
      description?: string | null;
      argumentHint?: string | null;
      content: string;
    }) => {
      const id = requireWorkspaceId();
      try {
        await createPromptService(id, data);
        await refreshPrompts("on-demand");
        dispatchCustomPromptsChanged(id);
      } catch (error) {
        logPromptError("client-prompts-create-error", "prompts/create error", error);
        throw error;
      }
    },
    [logPromptError, refreshPrompts, requireWorkspaceId],
  );

  const updatePrompt = useCallback(
    async (data: {
      path: string;
      name: string;
      description?: string | null;
      argumentHint?: string | null;
      content: string;
    }) => {
      const id = requireWorkspaceId();
      try {
        await updatePromptService(id, data);
        await refreshPrompts("on-demand");
        dispatchCustomPromptsChanged(id);
      } catch (error) {
        logPromptError("client-prompts-update-error", "prompts/update error", error);
        throw error;
      }
    },
    [logPromptError, refreshPrompts, requireWorkspaceId],
  );

  const deletePrompt = useCallback(
    async (path: string) => {
      const id = requireWorkspaceId();
      try {
        await deletePromptService(id, path);
        await refreshPrompts("on-demand");
        dispatchCustomPromptsChanged(id);
      } catch (error) {
        logPromptError("client-prompts-delete-error", "prompts/delete error", error);
        throw error;
      }
    },
    [logPromptError, refreshPrompts, requireWorkspaceId],
  );

  const movePrompt = useCallback(
    async (data: { path: string; scope: "workspace" | "global" }) => {
      const id = requireWorkspaceId();
      try {
        await movePromptService(id, data);
        await refreshPrompts("on-demand");
        dispatchCustomPromptsChanged(id);
      } catch (error) {
        logPromptError("client-prompts-move-error", "prompts/move error", error);
        throw error;
      }
    },
    [logPromptError, refreshPrompts, requireWorkspaceId],
  );

  const getWorkspacePromptsDir = useCallback(async () => {
    const id = requireWorkspaceId();
    try {
      return await getWorkspacePromptsDirService(id);
    } catch (error) {
      logPromptError("client-prompts-dir-error", "prompts/workspace dir error", error);
      throw error;
    }
  }, [logPromptError, requireWorkspaceId]);

  const getGlobalPromptsDir = useCallback(async () => {
    if (!workspaceId) {
      return null;
    }
    try {
      return await getGlobalPromptsDirService(workspaceId);
    } catch (error) {
      logPromptError("client-prompts-global-dir-error", "prompts/global dir error", error);
      throw error;
    }
  }, [logPromptError, workspaceId]);

  return {
    prompts: promptOptions,
    promptsError,
    refreshPrompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
    movePrompt,
    getWorkspacePromptsDir,
    getGlobalPromptsDir,
  };
}
