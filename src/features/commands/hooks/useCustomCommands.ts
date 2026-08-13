import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CustomCommandOption, DebugEntry } from "../../../types";
import { getClaudeCommandsList, getOpenCodeCommandsList, startClaudeCommandsWatch, stopClaudeCommandsWatch } from "../../../services/tauri";
import type { EngineType } from "../../../types";
import { scheduleCatalogIdlePrewarm } from "../../startup-orchestration/utils/scheduleCatalogIdlePrewarm";
import { startupOrchestrator } from "../../startup-orchestration/utils/startupOrchestrator";
import { subscribeClaudeCommandsChanged } from "../../../services/events";
import { setVisibilityGatedInterval } from "../../../services/visibilityGatedInterval";
import { pushErrorToast } from "../../../services/toasts";

type UseCustomCommandsOptions = {
  onDebug?: (entry: DebugEntry) => void;
  activeEngine?: EngineType;
  workspaceId?: string | null;
};

/**
 * 事件驱动（Rust commands watcher → `claude-commands-changed`）之外的兜底
 * 轮询周期。遵守仓库"禁秒级轮询"红线，取 60s 且 visibility-gated。
 */
const COMMANDS_FALLBACK_POLL_MS = 60_000;

type CommandRefreshPhase = "idle-prewarm" | "on-demand";

/**
 * orchestrator 取消/过期（切 workspace、force-enter 等）走 fallback("stale"|"cancelled")。
 * 这是预期语义，不是加载失败，禁止 error toast / 清空已有列表。
 */
function isSoftCancelledCommandsReason(reason: string | null): boolean {
  return reason === "stale" || reason === "cancelled";
}

function normalizeCommandsPayload(response: unknown): CustomCommandOption[] {
  const responsePayload = response as any;
  let rawCommands: any[] = [];
  if (Array.isArray(response)) {
    rawCommands = response;
  } else if (Array.isArray(responsePayload?.commands)) {
    rawCommands = responsePayload.commands;
  } else if (Array.isArray(responsePayload?.result?.commands)) {
    rawCommands = responsePayload.result.commands;
  } else if (Array.isArray(responsePayload?.result)) {
    rawCommands = responsePayload.result;
  }
  return rawCommands
    .map((item: any) => {
      let argumentHint: string | undefined;
      if (item.argumentHint) {
        argumentHint = String(item.argumentHint);
      } else if (item.argument_hint) {
        argumentHint = String(item.argument_hint);
      }

      const rawName = String(item.name ?? "");
      const trimmedName = rawName.trim();
      const normalizedName = trimmedName.startsWith("/")
        ? trimmedName.slice(1)
        : trimmedName;
      const source = item.source ? String(item.source) : undefined;

      return {
        name: normalizedName,
        path: String(item.path ?? ""),
        description: item.description ? String(item.description) : undefined,
        argumentHint,
        content: String(item.content ?? ""),
        ...(source ? { source } : {}),
      };
    })
    .filter((entry) => entry.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function useCustomCommands({
  onDebug,
  activeEngine,
  workspaceId = null,
}: UseCustomCommandsOptions) {
  const { t } = useTranslation();
  const [commands, setCommands] = useState<CustomCommandOption[]>([]);
  const [commandsError, setCommandsError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const logCommandError = useCallback(
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

  // t 的引用在未初始化 i18n 的环境（如测试）中可能每次渲染都变；
  // 经 ref 读取，避免 refreshCommands 链式失稳造成 effect 重入循环。
  const tRef = useRef(t);
  tRef.current = t;

  const reportCommandsFailure = useCallback((reason: string) => {
    setCommandsError(reason);
    pushErrorToast({
      id: "commands-list-unavailable",
      title: tRef.current("chat.commandsListUnavailableTitle"),
      message: tRef.current("chat.commandsListUnavailableMessage", { reason }),
      variant: "error",
    });
  }, []);

  const refreshCommands = useCallback(async (phase: CommandRefreshPhase = "on-demand") => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    onDebug?.({
      id: `${Date.now()}-client-commands-list`,
      timestamp: Date.now(),
      source: "client",
      label: "commands/list",
      payload: {},
    });
    let failedReason: string | null = null;
    try {
      const isOpenCode = activeEngine === "opencode";
      const commandLabel = isOpenCode ? "opencode_commands_list" : "claude_commands_list";
      const workspaceScope = workspaceId ? { workspaceId } : "global";
      const data = await startupOrchestrator.run<CustomCommandOption[]>({
        id: `${commandLabel}:${workspaceId ?? "global"}`,
        phase,
        priority: phase === "on-demand" ? 80 : 25,
        dedupeKey: `${commandLabel}:${workspaceId ?? "global"}`,
        concurrencyKey: "catalog",
        timeoutMs: 5_000,
        workspaceScope,
        cancelPolicy: workspaceId ? "soft-ignore" : "yield-only",
        traceLabel: "commands/list",
        commandLabel,
        run: async () => {
          const response = isOpenCode
            ? await getOpenCodeCommandsList()
            : await getClaudeCommandsList(workspaceId);
          onDebug?.({
            id: `${Date.now()}-server-commands-list`,
            timestamp: Date.now(),
            source: "server",
            label: "commands/list response",
            payload: response,
          });
          return normalizeCommandsPayload(response);
        },
        fallback: (reason) => {
          failedReason = String(reason);
          return [];
        },
      });
      if (isSoftCancelledCommandsReason(failedReason)) {
        // 保留已有 commands；稍后 watcher / 兜底轮询会再拉。
        return;
      }
      if (failedReason) {
        reportCommandsFailure(failedReason);
      } else {
        setCommandsError(null);
      }
      setCommands(data);
    } catch (error) {
      logCommandError("client-commands-list-error", "commands/list error", error);
      reportCommandsFailure(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      inFlight.current = false;
    }
  }, [activeEngine, logCommandError, onDebug, reportCommandsFailure, workspaceId]);

  useEffect(() => {
    // P1-3: Claude commands are workspace-scoped; skip until a workspace is active.
    // OpenCode commands are global and may prewarm after the gate window (P1-4).
    if (activeEngine !== "opencode" && !workspaceId) {
      return;
    }
    return scheduleCatalogIdlePrewarm({
      run: () => {
        void refreshCommands("idle-prewarm");
      },
    });
  }, [activeEngine, refreshCommands, workspaceId]);

  // Rust commands watcher 生命周期跟随当前 workspace 作用域；
  // 对同一作用域重复 start 在 Rust 侧幂等。opencode 走独立命令源，不挂此 watcher。
  useEffect(() => {
    if (activeEngine === "opencode") {
      return;
    }
    const startPromise = startClaudeCommandsWatch(workspaceId);
    void startPromise.catch((error) => {
      logCommandError("commands-watch-start-error", "commands/watch start error", error);
    });
    return () => {
      void startPromise
        .then(() => stopClaudeCommandsWatch(workspaceId))
        .catch(() => {});
    };
  }, [activeEngine, logCommandError, workspaceId]);

  // 事件驱动：Rust commands watcher 在命令目录变更去抖后触发即时刷新。
  useEffect(() => {
    return subscribeClaudeCommandsChanged(() => {
      void refreshCommands("on-demand");
    });
  }, [refreshCommands]);

  // 兜底轮询：watcher 漏事件时仍能收敛；visibility-gated，60s 周期。
  useEffect(() => {
    return setVisibilityGatedInterval(() => {
      void refreshCommands("on-demand");
    }, COMMANDS_FALLBACK_POLL_MS);
  }, [refreshCommands]);

  const commandOptions = useMemo(
    () => commands.filter((command) => command.name),
    [commands],
  );

  return {
    commands: commandOptions,
    refreshCommands,
    commandsError,
  };
}
