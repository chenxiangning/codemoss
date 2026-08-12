/** @vitest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./FileViewPanel.test-utils";
import {
  createBrowserAgentSession,
  openBrowserAgentWindow,
  readWorkspaceFile,
} from "../../../services/tauri";
import {
  BROWSER_OPEN_DOCK_EVENT,
  BROWSER_OPEN_URL_EVENT,
} from "../../browser-agent/state/dockEvents";
import { FileViewPanel } from "./FileViewPanel";
import { clearFileDocumentSessionCacheForTests } from "../hooks/useFileDocumentState";
import { mockPushErrorToast } from "./FileViewPanel.test-utils";

const createSessionMock = vi.mocked(createBrowserAgentSession);
const openWindowMock = vi.mocked(openBrowserAgentWindow);

type DockEventRecord = { type: string; url?: string };

/** 记录内嵌 dock 事件链路的派发顺序与载荷。 */
function recordDockEvents(): { events: DockEventRecord[]; dispose: () => void } {
  const events: DockEventRecord[] = [];
  const record = (type: string) => (event: Event) => {
    events.push({
      type,
      url: (event as CustomEvent<{ url?: string }>).detail?.url,
    });
  };
  const recordOpenDock = record(BROWSER_OPEN_DOCK_EVENT);
  const recordOpenUrl = record(BROWSER_OPEN_URL_EVENT);
  window.addEventListener(BROWSER_OPEN_DOCK_EVENT, recordOpenDock);
  window.addEventListener(BROWSER_OPEN_URL_EVENT, recordOpenUrl);
  return {
    events,
    dispose: () => {
      window.removeEventListener(BROWSER_OPEN_DOCK_EVENT, recordOpenDock);
      window.removeEventListener(BROWSER_OPEN_URL_EVENT, recordOpenUrl);
    },
  };
}

function renderFileView(
  filePath: string,
  options?: { initialMode?: "edit" | "preview" },
) {
  return render(
    <FileViewPanel
      workspaceId="workspace-open-in-browser"
      workspacePath="/repo"
      filePath={filePath}
      initialMode={options?.initialMode}
      openTargets={[]}
      openAppIconById={{}}
      selectedOpenAppId=""
      onSelectOpenAppId={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

async function openContentContextMenu(container: HTMLElement) {
  const editorSurface = container.querySelector(
    ".fvp-editor-capture-surface",
  ) as HTMLElement | null;
  const bodySurface = container.querySelector(".fvp-body") as HTMLElement | null;
  const target =
    editorSurface ??
    (container.querySelector(
      '[data-testid="mock-codemirror"]',
    ) as HTMLElement | null) ??
    bodySurface;
  if (!target) {
    throw new Error("Expected file content surface for context menu");
  }
  fireEvent.contextMenu(target, { clientX: 90, clientY: 70 });
}

describe("FileViewPanel open in browser", () => {
  beforeEach(() => {
    createSessionMock.mockReset();
    openWindowMock.mockReset();
    createSessionMock.mockResolvedValue({
      browserSessionId: "browser-session-1",
    } as never);
    openWindowMock.mockResolvedValue({
      browserSessionId: "browser-session-1",
    } as never);
    mockPushErrorToast.mockReset();
  });

  afterEach(() => {
    cleanup();
    clearFileDocumentSessionCacheForTests();
    vi.clearAllMocks();
  });

  it("shows Open in Browser for .html files and routes to the embedded dock", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "<html><body>hello</body></html>",
      truncated: false,
    });
    const { events, dispose } = recordDockEvents();
    try {
      const { container } = renderFileView("docs/demo.html");
      await screen.findByTestId("mock-codemirror");
      await openContentContextMenu(container);

      const menuItem = screen.getByRole("menuitem", {
        name: "files.openInBrowser",
      });
      fireEvent.click(menuItem);

      await waitFor(() => {
        expect(events).toEqual([
          { type: BROWSER_OPEN_DOCK_EVENT, url: undefined },
          { type: BROWSER_OPEN_URL_EVENT, url: "file:///repo/docs/demo.html" },
        ]);
      });
      // 内嵌改道后不再直接创建会话或浮动窗，由 BrowserDock 接管
      expect(createSessionMock).not.toHaveBeenCalled();
      expect(openWindowMock).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });

  it("shows Open in Browser for .htm and works in preview mode", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "<html><body>preview</body></html>",
      truncated: false,
    });
    const { container } = renderFileView("pages/legacy.HTM", {
      initialMode: "preview",
    });
    await waitFor(() => {
      expect(
        container.querySelector(".fvp-body") ||
          container.querySelector(".fvp-code-preview"),
      ).toBeTruthy();
    });

    const body = container.querySelector(".fvp-body") as HTMLElement;
    fireEvent.contextMenu(body, { clientX: 100, clientY: 80 });

    expect(
      screen.getByRole("menuitem", { name: "files.openInBrowser" }),
    ).toBeTruthy();
  });

  it("does not dispatch dock events for non-html files", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const x = 1;",
      truncated: false,
    });
    const { events, dispose } = recordDockEvents();
    try {
      const { container } = renderFileView("src/value.ts");
      await screen.findByTestId("mock-codemirror");
      await openContentContextMenu(container);

      expect(
        screen.queryByRole("menuitem", { name: "files.openInBrowser" }),
      ).toBeNull();
      expect(events).toEqual([]);
      expect(createSessionMock).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });
});
