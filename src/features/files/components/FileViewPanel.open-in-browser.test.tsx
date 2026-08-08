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
import { FileViewPanel } from "./FileViewPanel";
import { clearFileDocumentSessionCacheForTests } from "../hooks/useFileDocumentState";
import { mockPushErrorToast } from "./FileViewPanel.test-utils";

const createSessionMock = vi.mocked(createBrowserAgentSession);
const openWindowMock = vi.mocked(openBrowserAgentWindow);

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

  it("shows Open in Browser for .html files and opens built-in browser", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "<html><body>hello</body></html>",
      truncated: false,
    });
    const { container } = renderFileView("docs/demo.html");
    await screen.findByTestId("mock-codemirror");
    await openContentContextMenu(container);

    const menuItem = screen.getByRole("menuitem", {
      name: "files.openInBrowser",
    });
    fireEvent.click(menuItem);

    await waitFor(() => {
      expect(createSessionMock).toHaveBeenCalledWith({
        workspaceId: "workspace-open-in-browser",
        url: "file:///repo/docs/demo.html",
        ownerSurface: "file-view",
      });
      expect(openWindowMock).toHaveBeenCalledWith("browser-session-1", null);
    });
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

  it("hides Open in Browser for non-html files", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const x = 1;",
      truncated: false,
    });
    const { container } = renderFileView("src/value.ts");
    await screen.findByTestId("mock-codemirror");
    await openContentContextMenu(container);

    expect(
      screen.queryByRole("menuitem", { name: "files.openInBrowser" }),
    ).toBeNull();
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("surfaces a non-blocking global toast with i18n message when Browser Agent fails", async () => {
    createSessionMock.mockRejectedValue(
      new Error(
        "Failed to open Browser Agent window: a webview with label `browser-agent-window` already exists",
      ),
    );
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "<html></html>",
      truncated: false,
    });
    const { container } = renderFileView("index.html");
    await screen.findByTestId("mock-codemirror");
    await openContentContextMenu(container);
    fireEvent.click(
      screen.getByRole("menuitem", { name: "files.openInBrowser" }),
    );

    await waitFor(() => {
      expect(mockPushErrorToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "files.openInBrowser",
          message: "files.openInBrowserWindowBusy",
        }),
      );
    });
    expect(mockPushErrorToast.mock.calls[0]?.[0]?.message).not.toMatch(
      /already exists|browser-agent-window/i,
    );
  });
});
