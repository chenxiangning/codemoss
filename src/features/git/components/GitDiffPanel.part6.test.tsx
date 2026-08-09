/** @vitest-environment jsdom */
import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  resetClientStorageForTests,
  writeClientStoreValue,
} from "../../../services/clientStorage";
import type { GitLogEntry } from "../../../types";

const mockPreviewSave = vi.fn(async () => true);
const mockPreviewDiscard = vi.fn();
const mockEditableDiffReviewSurface = vi.fn((props: Record<string, unknown>) => (
  <div data-testid="git-diff-viewer">
    {typeof props.onDirtyChange === "function" ? (
      <button type="button" onClick={() => {
        if (typeof props.onDraftActionsChange === "function") {
          (props.onDraftActionsChange as (actions: unknown) => void)({
            save: mockPreviewSave,
            discard: mockPreviewDiscard,
            isSaving: false,
          });
        }
        (props.onDirtyChange as (dirty: boolean) => void)(true);
      }}>
        Mock dirty preview
      </button>
    ) : null}
    {typeof props.onRequestClose === "function" ? (
      <button type="button" onClick={() => (props.onRequestClose as () => void)()}>
        Mock close preview
      </button>
    ) : null}
  </div>
));

// Mock react-i18next
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "git.commit": "Commit",
        "git.committing": "Committing...",
        "git.commitMessage": "Commit message...",
        "git.staged": "Staged Changes",
        "git.unstaged": "Changes",
        "git.commitStagedChanges": "Commit staged changes",
        "git.commitAllChanges": "Commit all unstaged changes",
        "git.noChangesToCommit": "No changes to commit",
        "git.enterCommitMessage": "Enter commit message",
        "git.selectFilesToCommit": "Select files to commit first",
        "git.selectedFilesForCommit": "{{count}} file selected for commit",
        "git.selectedFilesForCommit_other": "{{count}} files selected for commit",
        "git.commitSelectedChanges": "Commit selected changes",
        "git.commitSelectionToggleFile": "Toggle commit selection: {{path}}",
        "git.commitSelectionToggleScope": "Toggle commit selection: {{path}}",
        "git.sectionActions": "{{title}} actions",
        "git.commitRestoreSelectionFailed": "Commit completed, but failed to restore excluded staged files: {{error}}",
        "git.generateCommitMessage": "Generate commit message",
        "git.generateCommitMessageStaged": "Generate commit message from staged changes",
        "git.generateCommitMessageUnstaged": "Generate commit message from unstaged changes",
        "git.generateCommitMessageChinese": "Generate Chinese commit message",
        "git.generateCommitMessageEnglish": "Generate English commit message",
        "git.generateCommitMessageEngineCodex": "Use Codex engine",
        "git.generateCommitMessageEngineClaude": "Use Claude engine",
        "git.generateCommitMessageEngineGemini": "Use Gemini engine",
        "git.generateCommitMessageEngineOpenCode": "Use OpenCode engine",
        "git.generateCommitMessageLastConfig": "Use last configuration",
        "git.generateCommitMessageWithConfig": "Generate with this config",
        "git.generateCommitMessageQuick": "Regenerate with current configuration",
        "git.generatingCommitMessage": "Generating…",
        "git.commitMessageAvailableEngines": "Engines",
        "git.commitWithCount": "Commit ({{count}})",
        "common.language": "Language",
        "git.commitComposerPlacementMenuLabel": "Commit box position",
        "git.commitComposerPlacementBottom": "Bottom",
        "git.commitComposerPlacementTop": "Top",
        "git.listFlat": "Flat",
        "git.listTree": "Tree",
        "git.listView": "List view",
        "git.refreshStatus": "Refresh Git status",
        "git.toggleCommitSection": "Toggle commit section",
        "git.panelView": "Git panel view",
        "git.previewInline": "Preview in center pane",
        "git.previewInlineAction": "Preview diff in center pane",
        "git.previewModal": "Preview in modal",
        "git.previewModalAction": "Open diff preview modal",
        "git.openFileContent": "Open file",
        "git.openFileContentAction": "Open file content",
        "git.diffMode": "Diff",
        "git.diffModeDescription": "Inspect file changes",
        "git.logMode": "Git",
        "git.logModeDescription": "Browse commits and history",
        "git.issuesMode": "Issues",
        "git.issuesModeDescription": "Track repository issues",
        "git.prsMode": "PRs",
        "git.prsModeDescription": "Review pull requests",
        "git.fileActions": "File actions",
        "git.repositoryMenuTitle": "Git",
        "git.repositoryMenuFileHistory": "Show file history",
        "git.stageFile": "Stage file",
        "git.stageFiles": "Stage files",
        "git.stageChanges": "Stage changes",
        "git.stageAllChangesAction": "Stage all changes",
        "git.path": "Path:",
        "git.change": "Switch",
        "git.unstageFile": "Unstage file",
        "git.unstageFiles": "Unstage files",
        "git.unstageChanges": "Unstage changes",
        "git.unstageAllChangesAction": "Unstage all changes",
        "git.discardChanges": "Discard changes",
        "git.discardChange": "Discard change",
        "git.discardChangeMultiple": "Discard changes",
        "git.statusUnavailable": "Git status unavailable",
        "git.noRepositoriesFound": "No repositories found.",
        "git.historyQuickAction": "Git Graph",
        "git.switchRepository": "Switch Git repository",
        "git.switchRepositoryDescription": "Choose which repo the Diff panel uses",
        "menu.maximize": "Maximize",
        "common.restore": "Restore",
        "common.close": "Close",
        "files.unsavedChanges": "Unsaved changes",
        "files.unsavedChangesCloseDescription": "Changes will be lost.",
        "files.saveAndClose": "Save and close",
        "files.saving": "Saving...",
        "files.continueEditing": "Continue editing",
        "files.discardChangesAction": "Discard changes",
      };
      const template = translations[key] ?? key;
      if (!options) {
        return template;
      }
      return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(options[token] ?? ""));
    },
    i18n: {
      language: "en",
      changeLanguage: vi.fn(),
    },
  }),
}));

vi.mock("./WorkspaceEditableDiffReviewSurface", () => ({
  WorkspaceEditableDiffReviewSurface: (props: Record<string, unknown>) =>
    mockEditableDiffReviewSurface(props),
}));

import {
  GitDiffPanel,
  buildDiffTree,
  compactDiffTree,
  resolveBottomCommitMessageMenuPosition,
} from "./GitDiffPanel";
import {
  resolveGitDiffFileHistoryTarget,
  resolveRepositoryWorkspaceFilePath,
} from "./GitDiffPanelFileScope";
import { saveLastCommitMessageConfig } from "../../../utils/commitMessage";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: vi.fn(async () => true),
}));

const logEntries: GitLogEntry[] = [];

const baseProps = {
  mode: "diff" as const,
  onModeChange: vi.fn(),
  filePanelMode: "git" as const,
  onFilePanelModeChange: vi.fn(),
  branchName: "main",
  totalAdditions: 0,
  totalDeletions: 0,
  fileStatus: "1 file changed",
  logEntries,
  stagedFiles: [],
  unstagedFiles: [],
};

afterEach(() => {
  cleanup();
  mockEditableDiffReviewSurface.mockClear();
  mockPreviewSave.mockReset();
  mockPreviewSave.mockResolvedValue(true);
  mockPreviewDiscard.mockReset();
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockResolvedValue(null);
  resetClientStorageForTests();
  window.localStorage.clear();
});

async function chooseCodexEnglishCommitMessage() {
  fireEvent.click(screen.getByRole("button", { name: "Generate commit message" }));
  fireEvent.click(await screen.findByRole("button", { name: "English" }));
  fireEvent.click(await screen.findByRole("radio", { name: "Codex" }));
  fireEvent.click(await screen.findByRole("button", { name: "Generate with this config" }));
}

async function openGitFileContextMenu(row: HTMLElement) {
  fireEvent.contextMenu(row);
  const gitMenuTrigger = await screen.findByRole("menuitem", { name: "Git" });
  fireEvent.click(gitMenuTrigger);
  return screen.findByRole("menu", { name: "Git" });
}

void [act, cleanup, createEvent, fireEvent, render, screen, waitFor, within, afterEach, describe, expect, it, vi, invoke, resetClientStorageForTests, writeClientStoreValue, mockPreviewSave, mockPreviewDiscard, mockEditableDiffReviewSurface, GitDiffPanel, buildDiffTree, compactDiffTree, resolveBottomCommitMessageMenuPosition, resolveGitDiffFileHistoryTarget, resolveRepositoryWorkspaceFilePath, saveLastCommitMessageConfig, logEntries, baseProps, chooseCodexEnglishCommitMessage, openGitFileContextMenu];

describe("GitDiffPanel", () => {
  it("hides section line-stats badge when both totals are zero", () => {
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          stagedFiles={[
            { path: "src/zero.ts", status: "M", additions: 0, deletions: 0 },
          ]}
        />,
      );

      expect(document.querySelector(".diff-section-line-stats-badge")).toBeNull();
    });

  it("keeps section line-stats badge visible when section is collapsed", () => {
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          stagedFiles={[
            { path: "src/alpha.ts", status: "M", additions: 2, deletions: 1 },
          ]}
        />,
      );

      const toggle = screen.getByRole("button", { name: "Staged Changes (1)" });
      fireEvent.click(toggle);

      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(document.querySelector(".diff-section-line-stats-badge")).toBeTruthy();
      expect(document.querySelector(".diff-section-line-stats-badge")?.textContent).toContain("+2");
      expect(document.querySelector(".diff-section-line-stats-badge")?.textContent).toContain("-1");
    });

  it("collapses and expands a flat section from the section header", () => {
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          stagedFiles={[
            { path: "src/alpha.ts", status: "M", additions: 1, deletions: 0 },
            { path: "src/beta.ts", status: "M", additions: 2, deletions: 1 },
          ]}
        />,
      );

      const toggle = screen.getByRole("button", { name: "Staged Changes (2)" });
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      expect(screen.getByLabelText("src/alpha.ts")).toBeTruthy();

      fireEvent.click(toggle);

      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByLabelText("src/alpha.ts")).toBeNull();

      fireEvent.click(toggle);

      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      expect(screen.getByLabelText("src/alpha.ts")).toBeTruthy();
    });

  it("collapses and expands a tree section from the section header", () => {
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="tree"
          gitRoot="/repo/desktop-cc-gui"
          unstagedFiles={[
            { path: "src/alpha.ts", status: "M", additions: 1, deletions: 0 },
          ]}
        />,
      );

      const toggle = screen.getByRole("button", { name: "Changes (1)" });
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      expect(screen.getByText("desktop-cc-gui")).toBeTruthy();
      expect(screen.getByLabelText("src/alpha.ts")).toBeTruthy();

      fireEvent.click(toggle);

      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByLabelText("src/alpha.ts")).toBeNull();
    });

  it("keeps section collapse preference when git file list refreshes", () => {
      const { rerender } = render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          stagedFiles={[
            { path: "src/alpha.ts", status: "M", additions: 1, deletions: 0 },
          ]}
          unstagedFiles={[
            { path: "src/beta.ts", status: "M", additions: 2, deletions: 0 },
          ]}
        />,
      );

      const stagedToggle = screen.getByRole("button", { name: "Staged Changes (1)" });
      fireEvent.click(stagedToggle);
      expect(stagedToggle.getAttribute("aria-expanded")).toBe("false");

      rerender(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          stagedFiles={[
            { path: "src/alpha.ts", status: "M", additions: 1, deletions: 0 },
            { path: "src/gamma.ts", status: "A", additions: 3, deletions: 0 },
          ]}
          unstagedFiles={[
            { path: "src/beta.ts", status: "M", additions: 2, deletions: 0 },
            { path: "src/delta.ts", status: "M", additions: 1, deletions: 1 },
          ]}
        />,
      );

      const stagedToggleAfterRefresh = screen.getByRole("button", {
        name: "Staged Changes (2)",
      });
      expect(stagedToggleAfterRefresh.getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByLabelText("src/alpha.ts")).toBeNull();
      expect(screen.queryByLabelText("src/gamma.ts")).toBeNull();
      // Unstaged stays expanded by default / prior preference
      expect(
        screen.getByRole("button", { name: "Changes (2)" }).getAttribute("aria-expanded"),
      ).toBe("true");
      expect(screen.getByLabelText("src/beta.ts")).toBeTruthy();
    });

  it("toggles list view via shortcut when panel is focused", () => {
      const onGitDiffListViewChange = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          onGitDiffListViewChange={onGitDiffListViewChange}
          unstagedFiles={[
            { path: "file.txt", status: "M", additions: 1, deletions: 0 },
          ]}
        />,
      );

      const focusAnchor = screen.getByRole("button", { name: "Git panel view" });
      focusAnchor.focus();
      fireEvent.keyDown(window, { key: "V", altKey: true, shiftKey: true });
      expect(onGitDiffListViewChange).toHaveBeenCalledWith("tree");
    });

  it("uses configured shortcut for list view toggle", () => {
      const onGitDiffListViewChange = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          onGitDiffListViewChange={onGitDiffListViewChange}
          toggleGitDiffListViewShortcut="alt+shift+x"
          unstagedFiles={[
            { path: "file.txt", status: "M", additions: 1, deletions: 0 },
          ]}
        />,
      );

      const focusAnchor = screen.getByRole("button", { name: "Git panel view" });
      focusAnchor.focus();
      fireEvent.keyDown(window, { key: "V", altKey: true, shiftKey: true });
      expect(onGitDiffListViewChange).not.toHaveBeenCalled();

      fireEvent.keyDown(window, { key: "X", altKey: true, shiftKey: true });
      expect(onGitDiffListViewChange).toHaveBeenCalledWith("tree");
    });

  it("disables list view toggle when configured shortcut is cleared", () => {
      const onGitDiffListViewChange = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          onGitDiffListViewChange={onGitDiffListViewChange}
          toggleGitDiffListViewShortcut={null}
          unstagedFiles={[
            { path: "file.txt", status: "M", additions: 1, deletions: 0 },
          ]}
        />,
      );

      const focusAnchor = screen.getByRole("button", { name: "Git panel view" });
      focusAnchor.focus();
      fireEvent.keyDown(window, { key: "V", altKey: true, shiftKey: true });
      expect(onGitDiffListViewChange).not.toHaveBeenCalled();
    });

  it("does not toggle list view shortcut while editing textarea", () => {
      const onGitDiffListViewChange = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          onGitDiffListViewChange={onGitDiffListViewChange}
          commitMessage="chore: test"
          onGenerateCommitMessage={vi.fn()}
          unstagedFiles={[
            { path: "file.txt", status: "M", additions: 1, deletions: 0 },
          ]}
        />,
      );
      const textarea = screen.getAllByPlaceholderText("Commit message...")[0];
      if (!textarea) {
        throw new Error("Commit textarea not found");
      }
      textarea.focus();
      fireEvent.keyDown(textarea, { key: "V", altKey: true, shiftKey: true });
      expect(onGitDiffListViewChange).not.toHaveBeenCalled();
    });

  it("opens git history from Git Graph while hiding the legacy Git mode option", () => {
      const onOpenGitHistoryPanel = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          onOpenGitHistoryPanel={onOpenGitHistoryPanel}
          unstagedFiles={[
            { path: "file.txt", status: "M", additions: 1, deletions: 0 },
          ]}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Git panel view" }));
      expect(screen.queryByRole("menuitemradio", { name: /^Git\b/ })).toBeNull();

      const gitGraphAction = screen.getByRole("menuitem", { name: "Git Graph" });
      expect(gitGraphAction.querySelector(".lucide-git-commit-horizontal")).toBeTruthy();

      fireEvent.click(gitGraphAction);
      expect(onOpenGitHistoryPanel).toHaveBeenCalledTimes(1);
    });

  it("switches git panel mode from custom dropdown menu", () => {
      const onModeChange = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          onModeChange={onModeChange}
          unstagedFiles={[
            { path: "file.txt", status: "M", additions: 1, deletions: 0 },
          ]}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Git panel view" }));
      fireEvent.click(screen.getByRole("menuitemradio", { name: /Issues/i }));
      expect(onModeChange).toHaveBeenCalledWith("issues");
    });

  it("keeps flat mode stage action behavior", () => {
      const onStageFile = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          onStageFile={onStageFile}
          unstagedFiles={[
            { path: "file.txt", status: "M", additions: 1, deletions: 0 },
          ]}
        />,
      );

      const stageButton = screen.getByRole("button", { name: "Stage file" });
      fireEvent.click(stageButton);
      expect(onStageFile).toHaveBeenCalledWith("file.txt");
    });

  it("renders preview actions before mutation actions in flat mode", () => {
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          onSelectFile={vi.fn()}
          onOpenFile={vi.fn()}
          onStageFile={vi.fn()}
          unstagedFiles={[
            { path: "file.txt", status: "M", additions: 1, deletions: 0 },
          ]}
        />,
      );

      const actionGroup = document.querySelector('.diff-row[data-path="file.txt"] .diff-row-actions');
      expect(actionGroup).toBeTruthy();
      const actionLabels = Array.from(actionGroup?.querySelectorAll("button") ?? []).map((button) =>
        button.getAttribute("aria-label"),
      );
      expect(actionLabels).toEqual([
        "Preview diff in center pane",
        "Open file content",
        "Stage file",
      ]);
    });

  it("renders file commit selection checkbox as the trailing row control", () => {
      const onSelectFile = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          onSelectFile={onSelectFile}
          unstagedFiles={[
            { path: "file.txt", status: "M", additions: 1, deletions: 0 },
          ]}
        />,
      );

      const rowMeta = document.querySelector('.diff-row[data-path="file.txt"] .diff-row-meta');
      const selectionToggle = screen.getByRole("checkbox", {
        name: "Toggle commit selection: file.txt",
      });
      expect(rowMeta?.lastElementChild).toBe(selectionToggle);
      expect(selectionToggle.classList.contains("git-commit-scope-toggle")).toBe(true);

      fireEvent.click(selectionToggle);
      expect(onSelectFile).not.toHaveBeenCalled();
    });

  it("opens inline preview from explicit action in tree mode", () => {
      const onSelectFile = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="tree"
          onSelectFile={onSelectFile}
          unstagedFiles={[
            { path: "src/a.ts", status: "M", additions: 1, deletions: 0 },
          ]}
        />,
      );

      const inlinePreviewButton = document.querySelector<HTMLButtonElement>(
        '.diff-row[data-path="src/a.ts"] .diff-row-action--preview-inline',
      );
      expect(inlinePreviewButton).toBeTruthy();

      fireEvent.click(inlinePreviewButton as HTMLButtonElement);
      expect(onSelectFile).toHaveBeenCalledTimes(1);
      expect(onSelectFile).toHaveBeenCalledWith("src/a.ts");
    });

  it("opens editable DIFF modal on regular row click instead of file content", () => {
      const onSelectFile = vi.fn();
      const onOpenFile = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          onSelectFile={onSelectFile}
          onOpenFile={onOpenFile}
          unstagedFiles={[
            { path: "src/a.ts", status: "M", additions: 1, deletions: 0 },
          ]}
          diffEntries={[
            {
              path: "src/a.ts",
              status: "M",
              diff: "diff --git a/src/a.ts b/src/a.ts\n@@ -1 +1 @@\n-old\n+new\n",
            },
          ]}
        />,
      );

      const row = document.querySelector<HTMLElement>('.diff-row[data-path="src/a.ts"]');
      expect(row).toBeTruthy();

      fireEvent.click(row as HTMLElement);
      expect(onOpenFile).not.toHaveBeenCalled();
      expect(onSelectFile).not.toHaveBeenCalled();
      expect(document.querySelector(".git-history-diff-modal")).toBeTruthy();
    });

  it("opens file content from the former modal-preview row action", () => {
      const onSelectFile = vi.fn();
      const onOpenFile = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          onSelectFile={onSelectFile}
          onOpenFile={onOpenFile}
          unstagedFiles={[
            { path: "src/a.ts", status: "M", additions: 1, deletions: 0 },
          ]}
        />,
      );

      const openFileButton = document.querySelector<HTMLButtonElement>(
        '.diff-row[data-path="src/a.ts"] .diff-row-action--preview-modal',
      );
      expect(openFileButton).toBeTruthy();

      fireEvent.click(openFileButton as HTMLButtonElement);
      expect(onOpenFile).toHaveBeenCalledTimes(1);
      expect(onOpenFile).toHaveBeenCalledWith("src/a.ts");
      expect(onSelectFile).not.toHaveBeenCalled();
      expect(document.querySelector(".git-history-diff-modal")).toBeNull();
    });

  it.each([
      ["mouse click", (row: HTMLElement) => fireEvent.click(row), "flat" as const],
      ["Enter", (row: HTMLElement) => fireEvent.keyDown(row, { key: "Enter" }), "tree" as const],
    ])("opens a renamed destination DIFF modal with %s", (_activation, activate, gitDiffListView) => {
      const onSelectFile = vi.fn();
      const onOpenFile = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView={gitDiffListView}
          onSelectFile={onSelectFile}
          onOpenFile={onOpenFile}
          unstagedFiles={[
            {
              path: "archive/spec.md",
              oldPath: "changes/spec.md",
              status: "R",
              additions: 0,
              deletions: 0,
            },
          ]}
          diffEntries={[
            {
              path: "archive/spec.md",
              status: "R",
              diff: "diff --git a/changes/spec.md b/archive/spec.md\n",
            },
          ]}
        />,
      );

      activate(
        document.querySelector<HTMLElement>(
          '.diff-row[data-path="archive/spec.md"]',
        ) as HTMLElement,
      );

      expect(onOpenFile).not.toHaveBeenCalled();
      expect(onSelectFile).not.toHaveBeenCalled();
      expect(document.querySelector(".git-history-diff-modal")).toBeTruthy();
      const previewProps = mockEditableDiffReviewSurface.mock.lastCall?.[0] as {
        files?: Array<{ filePath?: string }>;
      };
      expect(previewProps.files?.[0]?.filePath).toBe("archive/spec.md");
    });

  it.each([
      ["mouse click", (row: HTMLElement) => fireEvent.click(row)],
      ["Space", (row: HTMLElement) => fireEvent.keyDown(row, { key: " " })],
    ])("routes deleted row %s activation to read-only diff preview", (_activation, activate) => {
      const onOpenFile = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          workspaceId="ws-1"
          workspacePath="/workspace"
          onOpenFile={onOpenFile}
          diffEntries={[
            {
              path: "src/deleted.ts",
              status: "D",
              diff: "@@ -1 +0,0 @@\n-export {};",
            },
          ]}
          unstagedFiles={[
            {
              path: "src/deleted.ts",
              status: "D",
              additions: 0,
              deletions: 1,
            },
          ]}
        />,
      );

      activate(
        document.querySelector<HTMLElement>(
          '.diff-row[data-path="src/deleted.ts"]',
        ) as HTMLElement,
      );

      expect(onOpenFile).not.toHaveBeenCalled();
      expect(document.querySelector(".git-history-diff-modal")).toBeTruthy();
      const previewProps = mockEditableDiffReviewSurface.mock.lastCall?.[0] as {
        files?: Array<{ filePath?: string; status?: string }>;
      };
      expect(previewProps.files?.[0]).toMatchObject({
        filePath: "src/deleted.ts",
        status: "D",
      });
    });
});
