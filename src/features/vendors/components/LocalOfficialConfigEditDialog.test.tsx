// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openFolderInFileManager } from "../../../services/tauri";
import { LocalOfficialConfigEditDialog } from "./LocalOfficialConfigEditDialog";

vi.mock("./OfficialConfigCodeEditor", async () => {
  const { OfficialConfigCodeEditorMock } = await import(
    "./officialConfigCodeEditorTestMock"
  );
  return { OfficialConfigCodeEditor: OfficialConfigCodeEditorMock };
});

vi.mock("../../../services/tauri", async () => {
  const actual = await vi.importActual<
    typeof import("../../../services/tauri")
  >("../../../services/tauri");
  return {
    ...actual,
    openFolderInFileManager: vi.fn(),
  };
});

const openFolderInFileManagerMock = vi.mocked(openFolderInFileManager);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LocalOfficialConfigEditDialog", () => {
  it("loads content and saves JSON object configs", async () => {
    const readContent = vi.fn().mockResolvedValue('{"model":"demo"}');
    const saveContent = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const onSaved = vi.fn();

    const { container } = render(
      <LocalOfficialConfigEditDialog
        isOpen
        title="Official Config"
        pathLabel="~/.config/opencode/opencode.json"
        format="json"
        onClose={onClose}
        onSaved={onSaved}
        readContent={readContent}
        saveContent={saveContent}
      />,
    );

    await waitFor(() => {
      expect(readContent).toHaveBeenCalled();
    });
    expect(await screen.findByDisplayValue('{"model":"demo"}')).toBeTruthy();
    expect(container.querySelector(".vendor-official-config-pane")).toBeTruthy();
    expect(
      container.querySelector(".vendor-official-config-pane-path")?.textContent,
    ).toBe("~/.config/opencode/opencode.json");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(saveContent).toHaveBeenCalledWith(
        JSON.stringify({ model: "demo" }, null, 2),
      );
      expect(onSaved).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("opens the containing folder for the official config path", async () => {
    openFolderInFileManagerMock.mockResolvedValue(undefined);
    const readContent = vi.fn().mockResolvedValue('{"model":"demo"}');

    render(
      <LocalOfficialConfigEditDialog
        isOpen
        title="Official Config"
        pathLabel="~/.config/opencode/opencode.json"
        format="json"
        onClose={vi.fn()}
        readContent={readContent}
        saveContent={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(readContent).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Open file" }));
    await waitFor(() => {
      expect(openFolderInFileManagerMock).toHaveBeenCalledWith(
        "~/.config/opencode/opencode.json",
      );
    });
  });

  it("saves TOML content without client-side JSON validation", async () => {
    const readContent = vi.fn().mockResolvedValue('[models]\ndefault = "x"\n');
    const saveContent = vi.fn().mockResolvedValue(undefined);

    render(
      <LocalOfficialConfigEditDialog
        isOpen
        title="Official Config"
        pathLabel="~/.grok/config.toml"
        format="toml"
        onClose={vi.fn()}
        readContent={readContent}
        saveContent={saveContent}
      />,
    );

    await waitFor(() => {
      expect(readContent).toHaveBeenCalled();
    });
    const editor = await screen.findByDisplayValue(/\[models\]/);
    fireEvent.change(editor, {
      target: { value: '[models]\ndefault = "y"\n' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(saveContent).toHaveBeenCalledWith('[models]\ndefault = "y"\n');
    });
  });

  it("blocks invalid JSON before calling save", async () => {
    const readContent = vi.fn().mockResolvedValue("{");
    const saveContent = vi.fn().mockResolvedValue(undefined);

    render(
      <LocalOfficialConfigEditDialog
        isOpen
        title="Official Config"
        pathLabel="~/.config/opencode/opencode.json"
        format="json"
        onClose={vi.fn()}
        readContent={readContent}
        saveContent={saveContent}
      />,
    );

    expect(await screen.findByDisplayValue("{")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const errorNode = document.querySelector(".vendor-json-error");
      expect(errorNode?.textContent?.trim()).toBeTruthy();
      expect(saveContent).not.toHaveBeenCalled();
    });
  });
});
