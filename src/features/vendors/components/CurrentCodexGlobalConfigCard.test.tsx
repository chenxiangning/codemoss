// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  openFolderInFileManager,
  writeGlobalCodexAuthJson,
  writeGlobalCodexConfigToml,
} from "../../../services/tauri";
import { CurrentCodexGlobalConfigCard } from "./CurrentCodexGlobalConfigCard";

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
    writeGlobalCodexAuthJson: vi.fn(),
    writeGlobalCodexConfigToml: vi.fn(),
    openFolderInFileManager: vi.fn(),
  };
});

const openFolderInFileManagerMock = vi.mocked(openFolderInFileManager);

const writeGlobalCodexAuthJsonMock = vi.mocked(writeGlobalCodexAuthJson);
const writeGlobalCodexConfigTomlMock = vi.mocked(writeGlobalCodexConfigToml);

function renderCard(options: { onSaved?: () => void } = {}) {
  return render(
    <CurrentCodexGlobalConfigCard
      configLoading={false}
      configExists
      configContent={'model = "gpt-5"\n'}
      configTruncated={false}
      configError={null}
      authLoading={false}
      authExists
      authContent={'{"access_token":"secret"}'}
      authTruncated={false}
      authError={null}
      onSaved={options.onSaved}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CurrentCodexGlobalConfigCard", () => {
  it("keeps Codex config paths inside the edit dialog only", () => {
    const { container } = renderCard();

    expect(screen.getByText("Official Config")).toBeTruthy();
    expect(screen.queryByText("~/.codex/config.toml")).toBeNull();
    expect(screen.queryByText("~/.codex/auth.json")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByText("~/.codex/config.toml")).toBeTruthy();
    expect(screen.getByText("~/.codex/auth.json")).toBeTruthy();
    expect(
      container.querySelector(".vendor-official-config-dialog-body.is-multi-pane"),
    ).toBeTruthy();
  });

  it("renders dual editor panes with title/path meta and auth actions", () => {
    const { container } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const panes = container.querySelectorAll(".vendor-official-config-pane");
    expect(panes).toHaveLength(2);

    const [configPane, authPane] = panes;
    expect(
      configPane.querySelector(".vendor-official-config-pane-title")?.textContent,
    ).toBe("Global Default Codex Config");
    expect(
      configPane.querySelector(".vendor-official-config-pane-path")?.textContent,
    ).toBe("~/.codex/config.toml");
    expect(
      configPane.querySelector(".vendor-official-config-pane-actions"),
    ).toBeTruthy();

    expect(
      authPane.querySelector(".vendor-official-config-pane-path")?.textContent,
    ).toBe("~/.codex/auth.json");
    expect(
      authPane.querySelector(".vendor-official-config-pane-actions"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Show Sensitive" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Open file" })).toHaveLength(
      2,
    );
  });

  it("opens the containing folder for each official config file", async () => {
    openFolderInFileManagerMock.mockResolvedValue(undefined);
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const [configFolder, authFolder] = screen.getAllByRole("button", {
      name: "Open file",
    });
    fireEvent.click(configFolder);
    await waitFor(() => {
      expect(openFolderInFileManagerMock).toHaveBeenCalledWith(
        "~/.codex/config.toml",
      );
    });

    fireEvent.click(authFolder);
    await waitFor(() => {
      expect(openFolderInFileManagerMock).toHaveBeenCalledWith(
        "~/.codex/auth.json",
      );
    });
  });

  it("saves both Codex official files from the edit dialog", async () => {
    const onSaved = vi.fn();
    writeGlobalCodexAuthJsonMock.mockResolvedValueOnce(undefined);
    writeGlobalCodexConfigTomlMock.mockResolvedValueOnce(undefined);

    renderCard({ onSaved });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Show Sensitive" }));
    const [configEditor, authEditor] = screen.getAllByRole("textbox");

    fireEvent.change(configEditor, {
      target: { value: 'model = "gpt-5.1"\n' },
    });
    fireEvent.change(authEditor, {
      target: { value: '{"access_token":"next"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(writeGlobalCodexConfigTomlMock).toHaveBeenCalledWith(
        'model = "gpt-5.1"\n',
      );
      expect(writeGlobalCodexAuthJsonMock).toHaveBeenCalledWith(
        '{"access_token":"next"}',
      );
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
  });

  it("masks auth.json secrets by default and reveals them on demand", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const [, authEditor] = screen.getAllByRole("textbox") as HTMLTextAreaElement[];
    expect(authEditor.value).not.toContain("secret");
    expect(authEditor.value).toContain("******");
    expect(authEditor.readOnly).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Show Sensitive" }));
    const [, revealedEditor] = screen.getAllByRole(
      "textbox",
    ) as HTMLTextAreaElement[];
    expect(revealedEditor.value).toContain("secret");
    expect(revealedEditor.readOnly).toBe(false);
  });

  it("only writes changed files and never writes an empty auth.json", async () => {
    const onSaved = vi.fn();
    writeGlobalCodexConfigTomlMock.mockResolvedValueOnce(undefined);

    renderCard({ onSaved });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Show Sensitive" }));
    const [configEditor, authEditor] = screen.getAllByRole("textbox");

    fireEvent.change(configEditor, {
      target: { value: 'model = "gpt-5.2"\n' },
    });
    fireEvent.change(authEditor, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(writeGlobalCodexConfigTomlMock).toHaveBeenCalledWith(
        'model = "gpt-5.2"\n',
      );
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(writeGlobalCodexAuthJsonMock).not.toHaveBeenCalled();
  });

  it("shows a partial failure message when one write fails", async () => {
    const onSaved = vi.fn();
    writeGlobalCodexConfigTomlMock.mockRejectedValueOnce(new Error("disk full"));
    writeGlobalCodexAuthJsonMock.mockResolvedValueOnce(undefined);

    renderCard({ onSaved });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Show Sensitive" }));
    const [configEditor, authEditor] = screen.getAllByRole("textbox");

    fireEvent.change(configEditor, {
      target: { value: "not the same\n" },
    });
    fireEvent.change(authEditor, {
      target: { value: '{"access_token":"next"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to write global config\.toml: disk full/),
      ).toBeTruthy();
    });
    // Dialog stays open so the user can retry the failed write.
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });
});
