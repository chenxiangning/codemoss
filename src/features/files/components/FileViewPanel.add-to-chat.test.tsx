/** @vitest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "./FileViewPanel.test-utils";
import { readWorkspaceFile } from "../../../services/tauri";
import { FileViewPanel } from "./FileViewPanel";
import { clearFileDocumentSessionCacheForTests } from "../hooks/useFileDocumentState";

function renderFileView(
  onInsertText: ReturnType<typeof vi.fn>,
  initialMode?: "edit" | "preview",
) {
  return render(
    <FileViewPanel
      workspaceId="workspace-add-to-chat"
      workspacePath="/repo"
      filePath="src/value.ts"
      initialMode={initialMode}
      openTargets={[]}
      openAppIconById={{}}
      selectedOpenAppId=""
      onSelectOpenAppId={vi.fn()}
      onClose={vi.fn()}
      onInsertText={onInsertText}
    />,
  );
}

describe("FileViewPanel send selection to input", () => {
  afterEach(() => {
    cleanup();
    clearFileDocumentSessionCacheForTests();
    vi.clearAllMocks();
  });

  it("inserts an elegant @file#L reference for the selected editor range", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const first = 1;\nconst second = 2;\nconst third = 3;",
      truncated: false,
    });
    const onInsertText = vi.fn();
    const { container } = renderFileView(onInsertText);
    const editor = (await screen.findByTestId(
      "mock-codemirror",
    )) as HTMLTextAreaElement;
    const endAtThirdLine = editor.value.indexOf("const third");
    editor.setSelectionRange(0, endAtThirdLine);
    fireEvent.select(editor);

    fireEvent.contextMenu(
      container.querySelector(".fvp-editor-capture-surface") as HTMLElement,
      { clientX: 90, clientY: 70 },
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "files.addToChat" }),
    );

    expect(onInsertText).toHaveBeenCalledTimes(1);
    expect(onInsertText.mock.calls[0]?.[0]).toBe("@src/value.ts#L1-L2");
  });

  it("hides send-to-input when the editor has no selection", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const first = 1;\nconst second = 2;",
      truncated: false,
    });
    const onInsertText = vi.fn();
    renderFileView(onInsertText);
    const editor = (await screen.findByTestId(
      "mock-codemirror",
    )) as HTMLTextAreaElement;

    fireEvent.contextMenu(editor, { clientX: 90, clientY: 70 });

    expect(
      screen.queryByRole("menuitem", { name: "files.addToChat" }),
    ).toBeNull();
    expect(onInsertText).not.toHaveBeenCalled();
  });

  it("inserts the current editor selection with the shortcut", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const first = 1;\nconst second = 2;",
      truncated: false,
    });
    const onInsertText = vi.fn();
    renderFileView(onInsertText);
    const editor = (await screen.findByTestId(
      "mock-codemirror",
    )) as HTMLTextAreaElement;
    editor.setSelectionRange(0, "const first = 1;".length);
    fireEvent.select(editor);

    fireEvent.keyDown(editor, {
      key: "a",
      altKey: true,
      shiftKey: true,
    });

    expect(onInsertText).toHaveBeenCalledWith("@src/value.ts#L1");
  });

  it("inserts a frozen logical line selection from code preview", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const first = 1;\nconst second = 2;\nconst third = 3;",
      truncated: false,
    });
    const onInsertText = vi.fn();
    const { container } = renderFileView(onInsertText, "preview");
    await waitFor(() => {
      expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
    });
    const lines = container.querySelectorAll<HTMLElement>(".fvp-code-line");
    const firstLine = lines.item(0);
    const secondLine = lines.item(1);
    if (!firstLine || !secondLine) {
      throw new Error("Expected preview code lines");
    }
    fireEvent.click(firstLine);
    fireEvent.click(secondLine, { shiftKey: true });

    fireEvent.contextMenu(
      container.querySelector(
        ".fvp-code-preview-capture-surface",
      ) as HTMLElement,
      { clientX: 110, clientY: 90 },
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "files.addToChat" }),
    );

    expect(onInsertText).toHaveBeenCalledWith("@src/value.ts#L1-L2");
  });
});
