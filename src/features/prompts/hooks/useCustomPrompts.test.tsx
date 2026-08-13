// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import {
  createPrompt,
  getGlobalPromptsDir,
  getPromptsList,
} from "../../../services/tauri";
import {
  subscribeErrorToasts,
  type ErrorToast,
} from "../../../services/toasts";
import {
  requestCustomPromptsRefresh,
} from "../promptEvents";
import { useCustomPrompts } from "./useCustomPrompts";

vi.mock("../../../services/tauri", () => ({
  createPrompt: vi.fn(),
  deletePrompt: vi.fn(),
  getPromptsList: vi.fn(),
  getGlobalPromptsDir: vi.fn(),
  getWorkspacePromptsDir: vi.fn(),
  movePrompt: vi.fn(),
  updatePrompt: vi.fn(),
}));

const getGlobalPromptsDirMock = vi.mocked(getGlobalPromptsDir);
const getPromptsListMock = vi.mocked(getPromptsList);
const createPromptMock = vi.mocked(createPrompt);

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "Workspace",
  path: "/tmp/workspace",
  connected: false,
  settings: { sidebarCollapsed: false },
};

const samplePrompt = {
  path: "/tmp/workspace/.ccgui/prompts/review.md",
  name: "review",
  content: "review prompt",
  description: "代码评审",
  argumentHint: undefined,
  scope: "workspace" as const,
};

describe("useCustomPrompts", () => {
  beforeEach(() => {
    getPromptsListMock.mockReset();
    getGlobalPromptsDirMock.mockReset();
    createPromptMock.mockReset();
  });

  it("returns null when no workspace is selected", async () => {
    const { result } = renderHook(() =>
      useCustomPrompts({ activeWorkspace: null }),
    );

    let path: string | null = "unset";
    await act(async () => {
      path = await result.current.getGlobalPromptsDir();
    });

    expect(path).toBeNull();
    expect(getGlobalPromptsDirMock).not.toHaveBeenCalled();
  });

  it("requests the global prompts dir when a workspace is selected", async () => {
    getGlobalPromptsDirMock.mockResolvedValue("/tmp/.codex/prompts");
    const { result } = renderHook(() =>
      useCustomPrompts({ activeWorkspace: workspace }),
    );

    let path: string | null = null;
    await act(async () => {
      path = await result.current.getGlobalPromptsDir();
    });

    expect(getGlobalPromptsDirMock).toHaveBeenCalledWith("ws-1");
    expect(path).toBe("/tmp/.codex/prompts");
  });

  it("refreshes sibling prompt hooks after prompt creation", async () => {
    getPromptsListMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValue([samplePrompt]);
    createPromptMock.mockResolvedValue(samplePrompt);

    const connectedWorkspace = { ...workspace, connected: true };
    const first = renderHook(() =>
      useCustomPrompts({ activeWorkspace: connectedWorkspace }),
    );
    const second = renderHook(() =>
      useCustomPrompts({ activeWorkspace: connectedWorkspace }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await first.result.current.createPrompt({
        scope: "workspace",
        name: "review",
        content: "review prompt",
      });
    });

    expect(first.result.current.prompts).toEqual([
      expect.objectContaining({ name: "review" }),
    ]);
    expect(second.result.current.prompts).toEqual([
      expect.objectContaining({ name: "review" }),
    ]);
    expect(getPromptsListMock.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("preserves existing prompts when orchestrator soft-cancels as stale", async () => {
    const { startupOrchestrator } = await import(
      "../../startup-orchestration/utils/startupOrchestrator"
    );

    let releaseList!: (value: typeof samplePrompt[]) => void;
    getPromptsListMock
      .mockResolvedValueOnce([samplePrompt])
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            releaseList = resolve;
          }),
      );

    const connectedWorkspace = { ...workspace, connected: true };
    const { result } = renderHook(() =>
      useCustomPrompts({ activeWorkspace: connectedWorkspace }),
    );

    await waitFor(() => {
      expect(result.current.prompts).toEqual([
        expect.objectContaining({ name: "review" }),
      ]);
    });

    let refreshPromise!: Promise<unknown>;
    await act(async () => {
      refreshPromise = result.current.refreshPrompts("on-demand");
    });

    await waitFor(() => {
      expect(getPromptsListMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    act(() => {
      startupOrchestrator.cancelWorkspaceTasks("ws-1", "stale");
    });
    releaseList([]);

    await act(async () => {
      await refreshPromise;
    });

    expect(result.current.prompts).toEqual([
      expect.objectContaining({ name: "review" }),
    ]);
    expect(result.current.promptsError).toBeNull();
  });

  it("surfaces hard list failures via promptsError and a deduped toast", async () => {
    const toasts: ErrorToast[] = [];
    const unsubscribe = subscribeErrorToasts((toast) => {
      toasts.push(toast);
    });
    getPromptsListMock.mockRejectedValue(new Error("ipc down"));

    const connectedWorkspace = { ...workspace, connected: true };
    const { result } = renderHook(() =>
      useCustomPrompts({ activeWorkspace: connectedWorkspace }),
    );

    await waitFor(() => {
      expect(result.current.promptsError).toBeTruthy();
    });

    const toast = toasts.find((entry) => entry.id === "prompts-list-unavailable");
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

    let releaseList!: (value: typeof samplePrompt[]) => void;
    getPromptsListMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseList = resolve;
        }),
    );

    const connectedWorkspace = { ...workspace, connected: true };
    const { result } = renderHook(() =>
      useCustomPrompts({ activeWorkspace: connectedWorkspace }),
    );

    await waitFor(() => {
      expect(getPromptsListMock).toHaveBeenCalled();
    });

    act(() => {
      startupOrchestrator.cancelWorkspaceTasks("ws-1", "stale");
    });
    releaseList([]);

    await waitFor(() => {
      expect(result.current.promptsError).toBeNull();
    });

    expect(
      toasts.find((entry) => entry.id === "prompts-list-unavailable"),
    ).toBeUndefined();
    unsubscribe();
  });

  it("shares in-flight refresh so concurrent callers await the same list", async () => {
    let releaseList!: (value: typeof samplePrompt[]) => void;
    getPromptsListMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseList = resolve;
        }),
    );

    const connectedWorkspace = { ...workspace, connected: true };
    const { result } = renderHook(() =>
      useCustomPrompts({ activeWorkspace: connectedWorkspace }),
    );

    await waitFor(() => {
      expect(getPromptsListMock).toHaveBeenCalledTimes(1);
    });

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    await act(async () => {
      first = result.current.refreshPrompts("on-demand");
      second = result.current.refreshPrompts("on-demand");
    });

    // prewarm + 两个 on-demand 共享同一 in-flight，不会叠出第三次 list（视时序至少不额外起 task）
    expect(getPromptsListMock.mock.calls.length).toBe(1);

    releaseList([samplePrompt]);

    await act(async () => {
      await Promise.all([first, second]);
    });

    expect(result.current.prompts).toEqual([
      expect.objectContaining({ name: "review" }),
    ]);
  });

  it("requestCustomPromptsRefresh recovers list for bang empty revalidate", async () => {
    getPromptsListMock
      .mockRejectedValueOnce(new Error("startup timeout"))
      .mockResolvedValue([samplePrompt]);

    const connectedWorkspace = { ...workspace, connected: true };
    const { result } = renderHook(() =>
      useCustomPrompts({ activeWorkspace: connectedWorkspace }),
    );

    await waitFor(() => {
      expect(result.current.promptsError).toBeTruthy();
    });
    expect(result.current.prompts).toEqual([]);

    let refreshed: typeof samplePrompt[] = [];
    await act(async () => {
      refreshed = (await requestCustomPromptsRefresh("ws-1", "on-demand")) as typeof samplePrompt[];
    });

    expect(refreshed).toEqual([expect.objectContaining({ name: "review" })]);
    expect(result.current.prompts).toEqual([
      expect.objectContaining({ name: "review" }),
    ]);
  });

  it("skipIfAuthoritative avoids IPC after successful empty settle", async () => {
    getPromptsListMock.mockResolvedValue([]);

    const connectedWorkspace = { ...workspace, connected: true };
    renderHook(() => useCustomPrompts({ activeWorkspace: connectedWorkspace }));

    await waitFor(() => {
      expect(getPromptsListMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await requestCustomPromptsRefresh("ws-1", "on-demand", {
        skipIfAuthoritative: true,
      });
    });

    expect(getPromptsListMock).toHaveBeenCalledTimes(1);
  });
});
