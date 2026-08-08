/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getClaudeCommandsList, getOpenCodeCommandsList, startClaudeCommandsWatch, stopClaudeCommandsWatch } from "../../../services/tauri";
import { subscribeErrorToasts, type ErrorToast } from "../../../services/toasts";
import { useCustomCommands } from "./useCustomCommands";

vi.mock("../../../services/tauri", () => ({
  getClaudeCommandsList: vi.fn(),
  getOpenCodeCommandsList: vi.fn(),
  startClaudeCommandsWatch: vi.fn(async () => {}),
  stopClaudeCommandsWatch: vi.fn(async () => {}),
}));

type TauriEventHandler = (event: { payload: unknown }) => void;
const tauriEventHandlers = new Map<string, TauriEventHandler>();

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (eventName: string, handler: TauriEventHandler) => {
    tauriEventHandlers.set(eventName, handler);
    return () => {
      tauriEventHandlers.delete(eventName);
    };
  }),
}));

function emitTauriEvent(eventName: string, payload: unknown = null) {
  tauriEventHandlers.get(eventName)?.({ payload });
}

describe("useCustomCommands", () => {
  beforeEach(() => {
    vi.mocked(getClaudeCommandsList).mockReset();
    vi.mocked(getOpenCodeCommandsList).mockReset();
    vi.mocked(startClaudeCommandsWatch).mockClear();
    vi.mocked(stopClaudeCommandsWatch).mockClear();
    tauriEventHandlers.clear();
  });

  it("starts the Rust commands watcher for the active scope and stops it on unmount", async () => {
    vi.mocked(getClaudeCommandsList).mockResolvedValue([]);

    const { unmount } = renderHook(() =>
      useCustomCommands({
        activeEngine: "claude",
        workspaceId: "workspace-1",
      }),
    );

    await waitFor(() => {
      expect(startClaudeCommandsWatch).toHaveBeenCalledWith("workspace-1");
    });

    unmount();
    await waitFor(() => {
      expect(stopClaudeCommandsWatch).toHaveBeenCalledWith("workspace-1");
    });
  });

  it("waits for a pending watcher start before stopping on unmount", async () => {
    vi.mocked(getClaudeCommandsList).mockResolvedValue([]);
    let resolveStart!: () => void;
    vi.mocked(startClaudeCommandsWatch).mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        resolveStart = resolve;
      }),
    );

    const { unmount } = renderHook(() =>
      useCustomCommands({
        activeEngine: "claude",
        workspaceId: "workspace-1",
      }),
    );
    await waitFor(() => {
      expect(startClaudeCommandsWatch).toHaveBeenCalledWith("workspace-1");
    });

    unmount();
    expect(stopClaudeCommandsWatch).not.toHaveBeenCalled();

    resolveStart();
    await waitFor(() => {
      expect(stopClaudeCommandsWatch).toHaveBeenCalledWith("workspace-1");
    });
  });

  it("does not start the commands watcher for the opencode engine", async () => {
    vi.mocked(getOpenCodeCommandsList).mockResolvedValue([]);

    const { unmount } = renderHook(() =>
      useCustomCommands({
        activeEngine: "opencode",
        workspaceId: "workspace-1",
      }),
    );

    await waitFor(() => {
      expect(getOpenCodeCommandsList).toHaveBeenCalled();
    });
    expect(startClaudeCommandsWatch).not.toHaveBeenCalled();

    unmount();
    expect(stopClaudeCommandsWatch).not.toHaveBeenCalled();
  });

  it("passes workspace id to claude commands and normalizes source", async () => {
    vi.mocked(getClaudeCommandsList).mockResolvedValue([
      {
        name: "/open-spec:apply",
        path: "/repo/.claude/commands/open-spec/apply.md",
        description: "apply change",
        source: "project_claude",
        content: "body",
      },
    ]);

    const { result } = renderHook(() =>
      useCustomCommands({
        activeEngine: "claude",
        workspaceId: "workspace-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.commands).toHaveLength(1);
    });

    expect(getClaudeCommandsList).toHaveBeenCalledWith("workspace-1");
    expect(result.current.commands[0]).toMatchObject({
      name: "open-spec:apply",
      source: "project_claude",
    });
    expect(result.current.commandsError).toBeNull();
  });

  it("uses opencode command list when active engine is opencode", async () => {
    vi.mocked(getOpenCodeCommandsList).mockResolvedValue([
      {
        name: "status",
        path: "",
        description: "Show status",
        content: "",
      },
    ]);

    const { result } = renderHook(() =>
      useCustomCommands({
        activeEngine: "opencode",
        workspaceId: "workspace-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.commands).toHaveLength(1);
    });

    expect(getClaudeCommandsList).not.toHaveBeenCalled();
    expect(getOpenCodeCommandsList).toHaveBeenCalled();
  });

  it("does not retry or fall back to global list when workspace list is empty", async () => {
    vi.mocked(getClaudeCommandsList).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useCustomCommands({
        activeEngine: "claude",
        workspaceId: "workspace-1",
      }),
    );

    await waitFor(() => {
      expect(getClaudeCommandsList).toHaveBeenCalledTimes(1);
    });

    expect(getClaudeCommandsList).toHaveBeenCalledWith("workspace-1");
    expect(getClaudeCommandsList).not.toHaveBeenCalledWith(null);
    expect(result.current.commands).toEqual([]);
    expect(result.current.commandsError).toBeNull();
  });

  it("surfaces list failures via commandsError and an error toast", async () => {
    const toasts: ErrorToast[] = [];
    const unsubscribe = subscribeErrorToasts((toast) => {
      toasts.push(toast);
    });
    vi.mocked(getClaudeCommandsList).mockRejectedValue(new Error("ipc down"));

    const { result } = renderHook(() =>
      useCustomCommands({
        activeEngine: "claude",
        workspaceId: "workspace-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.commandsError).toBeTruthy();
    });

    const toast = toasts.find((entry) => entry.id === "commands-list-unavailable");
    expect(toast).toBeDefined();
    expect(toast?.variant).toBe("error");
    unsubscribe();
  });

  it("does not toast when orchestrator soft-cancels the list as stale", async () => {
    const { startupOrchestrator } = await import(
      "../../startup-orchestration/utils/startupOrchestrator"
    );
    const toasts: ErrorToast[] = [];
    const unsubscribe = subscribeErrorToasts((toast) => {
      toasts.push(toast);
    });

    let releaseList!: (value: unknown[]) => void;
    vi.mocked(getClaudeCommandsList).mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseList = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useCustomCommands({
        activeEngine: "claude",
        workspaceId: "workspace-1",
      }),
    );

    await waitFor(() => {
      expect(getClaudeCommandsList).toHaveBeenCalled();
    });

    act(() => {
      startupOrchestrator.cancelWorkspaceTasks("workspace-1", "stale");
    });
    releaseList([]);

    await waitFor(() => {
      // soft-cancel 结束后 inFlight 应放开；commandsError 保持空
      expect(result.current.commandsError).toBeNull();
    });

    expect(
      toasts.find((entry) => entry.id === "commands-list-unavailable"),
    ).toBeUndefined();
    unsubscribe();
  });

  it("refreshes when the Rust watcher emits claude-commands-changed", async () => {
    vi.mocked(getClaudeCommandsList).mockResolvedValue([]);

    renderHook(() =>
      useCustomCommands({
        activeEngine: "claude",
        workspaceId: "workspace-1",
      }),
    );

    await waitFor(() => {
      expect(getClaudeCommandsList).toHaveBeenCalledTimes(1);
    });

    vi.mocked(getClaudeCommandsList).mockResolvedValue([
      {
        name: "deploy",
        path: "/repo/.claude/commands/deploy.md",
        description: "deploy",
        source: "project_claude",
        content: "body",
      },
    ]);

    act(() => {
      emitTauriEvent("claude-commands-changed");
    });

    await waitFor(() => {
      expect(getClaudeCommandsList).toHaveBeenCalledTimes(2);
    });
  });
});
