// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CliCustomPathDialog,
  CliCustomPathEntry,
} from "./CliCustomPathDialog";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      const labels: Record<string, string> = {
        "settings.vendor.customPathTitle": `Custom path for ${options?.engine ?? ""}`,
        "settings.vendor.customPathDescription":
          "Configure the executable path for this CLI.",
        "settings.vendor.customPathDescriptionHint":
          "Leave empty to resolve via system PATH.",
        "settings.vendor.customPath": "Custom path",
        "settings.vendor.whatIsThis": "What does this do?",
        "settings.vendor.configurePath": "Configure path",
        "settings.vendor.customPathUsingSystemPath":
          "Currently using: system PATH",
        "settings.vendor.customPathNoArgs": "No extra args",
        "settings.vendor.customPathSourceLabel": "Executable source",
        "settings.vendor.customPathModeSystem": "System PATH",
        "settings.vendor.customPathModeCustom": "Custom path",
        "settings.vendor.customPathFieldLabel": "Executable path",
        "settings.vendor.customPathPlaceholder": `/path/to/${options?.command ?? ""}`,
        "settings.vendor.customPathSystemHint":
          "Will resolve this command via the system PATH:",
        "settings.vendor.customPathCustomHint":
          "Pick an executable or paste an absolute path.",
        "settings.vendor.customPathRequired":
          "Enter an executable path, or switch back to System PATH.",
        "settings.vendor.cancel": "Cancel",
        "settings.defaultCodexArgs": "Default Codex args",
        "settings.browse": "Browse",
        "settings.codexArgsPlaceholder": "--profile personal",
        "settings.clear": "Clear",
        "settings.codexArgsDesc": "Extra flags before",
        "settings.appServer": "app-server",
        "settings.codexArgsDescSuffix": ".",
        "settings.saving": "Saving...",
        "common.save": "Save",
      };
      return labels[key] ?? key;
    },
  }),
}));

describe("CliCustomPathDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a unified title and system mode for every engine", () => {
    render(
      <CliCustomPathDialog
        isOpen
        engine="kimi"
        initialPath={null}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Custom path for Kimi CLI" }),
    ).not.toBeNull();
    expect(screen.getByText("kimi")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "System PATH" }).className,
    ).toContain("active");
  });

  it("saves a custom path for non-codex engines", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <CliCustomPathDialog
        isOpen
        engine="claude"
        initialPath={null}
        onSave={onSave}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Custom path" }));
    fireEvent.change(screen.getByLabelText("Executable path"), {
      target: { value: "/usr/local/bin/claude" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({ path: "/usr/local/bin/claude" });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("saves path and args for codex", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CliCustomPathDialog
        isOpen
        engine="codex"
        initialPath="/bin/codex"
        initialArgs="--profile personal"
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Executable path"), {
      target: { value: "/opt/codex" },
    });
    fireEvent.change(screen.getByLabelText("Default Codex args"), {
      target: { value: "--profile work" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        path: "/opt/codex",
        args: "--profile work",
      });
    });
  });

  it("switches to System PATH and saves null", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CliCustomPathDialog
        isOpen
        engine="claude"
        initialPath="/bin/claude"
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "System PATH" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({ path: null });
    });
  });

  it("does not save custom mode with an empty path", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CliCustomPathDialog
        isOpen
        engine="grok"
        initialPath={null}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Custom path" }));
    expect(
      (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("browses for an executable path and switches to custom mode", async () => {
    vi.mocked(openFileDialog).mockResolvedValueOnce("/picked/claude");
    render(
      <CliCustomPathDialog
        isOpen
        engine="claude"
        initialPath={null}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Start in system mode — switch to custom first so Browse is visible.
    fireEvent.click(screen.getByRole("button", { name: "Custom path" }));
    fireEvent.click(screen.getByRole("button", { name: "Browse" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("/picked/claude")).not.toBeNull();
    });
  });

  it("preserves path draft when toggling modes", async () => {
    render(
      <CliCustomPathDialog
        isOpen
        engine="opencode"
        initialPath={null}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Custom path" }));
    fireEvent.change(screen.getByLabelText("Executable path"), {
      target: { value: "/opt/opencode" },
    });
    fireEvent.click(screen.getByRole("button", { name: "System PATH" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom path" }));

    expect(screen.getByDisplayValue("/opt/opencode")).not.toBeNull();
  });
});

describe("CliCustomPathEntry", () => {
  it("shows system PATH summary when no custom path is set", () => {
    const onConfigure = vi.fn();
    render(
      <CliCustomPathEntry
        engine="claude"
        path={null}
        onConfigure={onConfigure}
      />,
    );

    expect(screen.getByText("Custom path for Claude Code CLI")).not.toBeNull();
    expect(screen.getByText("Currently using: system PATH")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Configure path" }));
    expect(onConfigure).toHaveBeenCalled();
  });

  it("shows path and args summary for codex without help", () => {
    render(
      <CliCustomPathEntry
        engine="codex"
        path="/bin/codex"
        args="--profile personal"
        showArgsSummary
        onConfigure={vi.fn()}
      />,
    );

    expect(screen.getByText("Custom path for Codex CLI")).not.toBeNull();
    expect(
      screen.getByText("/bin/codex · --profile personal"),
    ).not.toBeNull();
  });

  it("folds path status into help and hides the inline summary", async () => {
    render(
      <CliCustomPathEntry
        engine="codex"
        path={null}
        showArgsSummary
        helpContent={
          <div>
            <p>Configure the executable path for this CLI.</p>
            <p>Leave empty to resolve via system PATH.</p>
            <p>Currently using: system PATH · No extra args</p>
          </div>
        }
        onConfigure={vi.fn()}
      />,
    );

    expect(screen.getByText("Custom path for Codex CLI")).not.toBeNull();
    expect(
      screen.queryByText("Currently using: system PATH · No extra args"),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "What does this do?" }));

    expect(
      await screen.findByText("Currently using: system PATH · No extra args"),
    ).not.toBeNull();
    expect(
      screen.getByText("Configure the executable path for this CLI."),
    ).not.toBeNull();
    expect(
      screen.getByText("Leave empty to resolve via system PATH."),
    ).not.toBeNull();
  });
});
