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
  it("keeps a dirty preview open when Git refresh removes the current file", async () => {
      const initialProps = {
        ...baseProps,
        gitDiffListView: "flat" as const,
        unstagedFiles: [{ path: "file.txt", status: "M", additions: 1, deletions: 0 }],
        diffEntries: [{
          path: "file.txt",
          status: "M",
          diff: "diff --git a/file.txt b/file.txt\n@@ -1 +1 @@\n-old\n+new\n",
        }],
      };
      const { rerender } = render(<GitDiffPanel {...initialProps} />);

      fireEvent.click(screen.getByLabelText("file.txt"));
      fireEvent.click(screen.getByRole("button", { name: "Mock dirty preview" }));
      rerender(
        <GitDiffPanel
          {...initialProps}
          unstagedFiles={[]}
          diffEntries={[]}
        />,
      );

      expect(screen.getByRole("alertdialog", { name: "Unsaved changes" })).toBeTruthy();
      expect(document.querySelector(".git-history-diff-modal")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
      await waitFor(() => {
        expect(screen.queryByRole("alertdialog", { name: "Unsaved changes" })).toBeNull();
      });
      expect(document.querySelector(".git-history-diff-modal")).toBeTruthy();
    });

  it("saves a dirty preview before closing and stays open when saving fails", async () => {
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          unstagedFiles={[{ path: "file.txt", status: "M", additions: 1, deletions: 0 }]}
          diffEntries={[{
            path: "file.txt",
            status: "M",
            diff: "diff --git a/file.txt b/file.txt\n@@ -1 +1 @@\n-old\n+new\n",
          }]}
        />,
      );

      fireEvent.click(screen.getByLabelText("file.txt"));
      fireEvent.click(screen.getByRole("button", { name: "Mock dirty preview" }));
      fireEvent.click(screen.getByRole("button", { name: "Mock close preview" }));
      mockPreviewSave.mockResolvedValueOnce(false);
      fireEvent.click(screen.getByRole("button", { name: "Save and close" }));

      await waitFor(() => expect(mockPreviewSave).toHaveBeenCalledOnce());
      expect(screen.getByRole("alertdialog", { name: "Unsaved changes" })).toBeTruthy();
      expect(document.querySelector(".git-history-diff-modal")).toBeTruthy();

      const retrySaveButton = await waitFor(() => {
        const button = screen.getByRole<HTMLButtonElement>("button", { name: "Save and close" });
        expect(button.disabled).toBe(false);
        return button;
      });
      fireEvent.click(retrySaveButton);
      await waitFor(() => expect(mockPreviewSave).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(document.querySelector(".git-history-diff-modal")).toBeNull());
    });

  it("keeps root summary visible and in first content row for non-git workspace path", () => {
      render(
        <GitDiffPanel
          {...baseProps}
          workspacePath="/tmp/non-git-workspace"
          gitRoot={null}
          onScanGitRoots={vi.fn()}
        />,
      );

      const rootPath = screen.getByText("/tmp/non-git-workspace");
      expect(rootPath).toBeTruthy();
      expect(screen.getByRole("button", { name: "Switch" })).toBeTruthy();

      const rootRow = document.querySelector(".git-root-current");
      const statusRow = document.querySelector(".diff-status");
      expect(rootRow).toBeTruthy();
      expect(statusRow).toBeTruthy();
      if (!rootRow || !statusRow) {
        throw new Error("Expected root/status rows to exist");
      }
      expect(Boolean(rootRow.compareDocumentPosition(statusRow) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    });

  it("toggles git root panel by clicking change icon button", () => {
      render(
        <GitDiffPanel
          {...baseProps}
          workspacePath="/tmp/non-git-workspace"
          error="not a git repository"
          gitRoot={null}
          onScanGitRoots={vi.fn()}
        />,
      );

      const toggleButton = screen.getByRole("button", { name: "Switch" });
      expect(screen.getByText("git.chooseRepo")).toBeTruthy();

      fireEvent.click(toggleButton);
      expect(screen.queryByText("git.chooseRepo")).toBeNull();

      fireEvent.click(toggleButton);
      expect(screen.getByText("git.chooseRepo")).toBeTruthy();
    });

  it("hides repository switching from the Diff menu while preserving the root selector", () => {
      render(
        <GitDiffPanel
          {...baseProps}
          workspacePath="/tmp/non-git-workspace"
          gitRoot={null}
          onScanGitRoots={vi.fn()}
        />,
      );

      expect(screen.queryByText("git.chooseRepo")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Git panel view" }));
      expect(screen.getByRole("menu")).toBeTruthy();
      expect(
        screen.queryByRole("menuitem", { name: "Switch Git repository" }),
      ).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Switch" }));
      expect(screen.getByText("git.chooseRepo")).toBeTruthy();
    });

  it("renders compact red alert on root row and hides raw git error", () => {
      render(
        <GitDiffPanel
          {...baseProps}
          workspacePath="/tmp/non-git-workspace"
          error="could not find repository at '/tmp/non-git-workspace'; class=Repository (6); code=NotFound (-3)"
          gitRoot={null}
          onScanGitRoots={vi.fn()}
        />,
      );

      expect(screen.getByText("No repositories found.")).toBeTruthy();
      expect(screen.queryByText(/could not find repository/i)).toBeNull();
      expect(screen.queryByText("Git status unavailable")).toBeNull();
      expect(screen.queryByText("main")).toBeNull();
    });

  it("auto-collapses git root panel after selecting a repository", () => {
      const onSelectGitRoot = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          workspacePath="/tmp/non-git-workspace"
          gitRoot={null}
          gitRootCandidates={["/tmp/non-git-workspace/repo-a"]}
          onScanGitRoots={vi.fn()}
          onSelectGitRoot={onSelectGitRoot}
        />,
      );

      const repoOption = screen.getByRole("button", { name: "/tmp/non-git-workspace/repo-a" });
      fireEvent.click(repoOption);
      expect(onSelectGitRoot).toHaveBeenCalledWith("/tmp/non-git-workspace/repo-a");
      expect(screen.queryByText("git.chooseRepo")).toBeNull();
    });

  it("auto-collapses git root panel when scan finishes with no repositories", () => {
      const { rerender } = render(
        <GitDiffPanel
          {...baseProps}
          workspacePath="/tmp/non-git-workspace"
          gitRoot={null}
          gitRootScanLoading={true}
          onScanGitRoots={vi.fn()}
        />,
      );

      expect(screen.getByText("git.chooseRepo")).toBeTruthy();

      rerender(
        <GitDiffPanel
          {...baseProps}
          workspacePath="/tmp/non-git-workspace"
          gitRoot={null}
          gitRootScanLoading={false}
          gitRootScanHasScanned={true}
          gitRootCandidates={[]}
          gitRootScanError={null}
          onScanGitRoots={vi.fn()}
        />,
      );

      expect(screen.queryByText("git.chooseRepo")).toBeNull();
    });

  it("hides pick-folder action in root panel", () => {
      render(
        <GitDiffPanel
          {...baseProps}
          workspacePath="/tmp/non-git-workspace"
          gitRoot={null}
          gitRootScanLoading={true}
          onScanGitRoots={vi.fn()}
          onPickGitRoot={vi.fn()}
        />,
      );

      expect(screen.queryByText("git.pickFolder")).toBeNull();
    });
});
