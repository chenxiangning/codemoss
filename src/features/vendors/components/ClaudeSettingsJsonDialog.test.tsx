// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  openFolderInFileManager,
  readClaudeSettingsJson,
  saveClaudeSettingsJson,
} from "../../../services/tauri";
import { ClaudeSettingsJsonDialog } from "./ClaudeSettingsJsonDialog";

vi.mock("./OfficialConfigCodeEditor", async () => {
  const { OfficialConfigCodeEditorMock } = await import(
    "./officialConfigCodeEditorTestMock"
  );
  return { OfficialConfigCodeEditor: OfficialConfigCodeEditorMock };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

vi.mock("../../../services/tauri", () => ({
  readClaudeSettingsJson: vi.fn(),
  saveClaudeSettingsJson: vi.fn(),
  openFolderInFileManager: vi.fn(),
}));

describe("ClaudeSettingsJsonDialog", () => {
  it("uses the shared official-config pane layout", async () => {
    vi.mocked(readClaudeSettingsJson).mockResolvedValueOnce('{\n  "model": "opus"\n}');

    const { container } = render(
      <ClaudeSettingsJsonDialog
        isOpen
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    const editor = await screen.findByRole("textbox", {
      name: "settings.vendor.localProviderName",
    });
    expect(editor.classList.contains("vendor-official-json-editor")).toBe(true);
    expect(container.querySelector(".vendor-official-config-pane")).toBeTruthy();
    expect(
      container.querySelector(".vendor-official-config-pane-path")?.textContent,
    ).toBe("~/.claude/settings.json");
    expect(
      screen.getByRole("button", {
        name: "settings.vendor.dialog.formatJson",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Open file",
      }),
    ).toBeTruthy();
  });

  it("opens the containing folder for ~/.claude/settings.json", async () => {
    vi.mocked(readClaudeSettingsJson).mockResolvedValueOnce("{}");
    vi.mocked(openFolderInFileManager).mockResolvedValueOnce(undefined);

    render(
      <ClaudeSettingsJsonDialog
        isOpen
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await screen.findByRole("textbox");
    fireEvent.click(screen.getByRole("button", { name: "Open file" }));

    await waitFor(() => {
      expect(openFolderInFileManager).toHaveBeenCalledWith(
        "~/.claude/settings.json",
      );
    });
  });

  it("inserts two-space indentation when Tab is pressed in the editor", async () => {
    vi.mocked(readClaudeSettingsJson).mockResolvedValueOnce('{"model":"opus"}');
    vi.mocked(saveClaudeSettingsJson).mockResolvedValueOnce(undefined);

    render(
      <ClaudeSettingsJsonDialog
        isOpen
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    const editor = await screen.findByRole<HTMLTextAreaElement>("textbox", {
      name: "settings.vendor.localProviderName",
    });
    fireEvent.change(editor, { target: { value: "{\n}" } });
    editor.setSelectionRange(2, 2);
    fireEvent.keyDown(editor, { key: "Tab" });

    await waitFor(() => {
      expect(editor.value).toBe("{\n  }");
    });
  });
});
