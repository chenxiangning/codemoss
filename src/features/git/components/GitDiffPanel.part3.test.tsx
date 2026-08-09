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
        "git.generateCommitMessageChinese": "中文",
        "git.generateCommitMessageEnglish": "English",
        "git.generateCommitMessageEngineCodex": "Codex",
        "git.generateCommitMessageEngineClaude": "Claude Code",
        "git.generateCommitMessageEngineGemini": "Gemini",
        "git.generateCommitMessageEngineOpenCode": "OpenCode",
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
  it("forwards repository-scoped selections from the multi-repository AI button", async () => {
      const onGenerateCommitMessage = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          workspaceId="ws-1"
          multiRepositoryMode
          repositoryStatuses={[
            {
              repositoryRoot: "services/api",
              displayName: "api",
              branchName: "main",
              stagedFiles: [],
              unstagedFiles: [
                { path: "pom.xml", status: "M", additions: 1, deletions: 0 },
              ],
              totalAdditions: 1,
              totalDeletions: 0,
              error: null,
            },
          ]}
          commitMessage=""
          onGenerateCommitMessage={onGenerateCommitMessage}
        />,
      );

      fireEvent.click(screen.getByRole("checkbox", {
        name: "Toggle commit selection: pom.xml",
      }));
      await chooseCodexEnglishCommitMessage();

      await waitFor(() => {
        expect(onGenerateCommitMessage).toHaveBeenCalledWith(
          "en",
          "codex",
          undefined,
          [{ repositoryRoot: "services/api", selectedPaths: ["pom.xml"] }],
        );
      });
    });

  it("renders multi-repository commit composer above repository groups when configured", () => {
      writeClientStoreValue("layout", "git.commitComposerPlacement", "top");

      render(
        <GitDiffPanel
          {...baseProps}
          workspaceId="ws-1"
          multiRepositoryMode
          repositoryStatuses={[
            {
              repositoryRoot: "services/api",
              displayName: "api",
              branchName: "main",
              stagedFiles: [
                { path: "pom.xml", status: "M", additions: 1, deletions: 0 },
              ],
              unstagedFiles: [],
              totalAdditions: 1,
              totalDeletions: 0,
              error: null,
            },
          ]}
          commitMessage="fix: multi top composer"
          onGenerateCommitMessage={vi.fn()}
        />,
      );

      const content = document.querySelector(".git-multi-repository-changes__content");
      const composer = document.querySelector(".git-commit-composer");
      expect(Boolean(
        composer && content &&
        (composer.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING),
      )).toBe(true);
      expect(composer?.classList.contains("git-commit-composer--top")).toBe(true);
    });

  it("opens repository-scoped DIFF modal when a multi-repository file row is activated", async () => {
      const onOpenFile = vi.fn();
      vi.mocked(invoke).mockImplementation((command) => {
        if (command === "get_git_diffs") {
          return Promise.resolve([{
            path: "pom.xml",
            status: "M",
            diff: "@@ -1 +1 @@\n-old\n+new",
          }]);
        }
        return Promise.resolve(null);
      });
      render(
        <GitDiffPanel
          {...baseProps}
          workspaceId="ws-1"
          workspacePath="/workspace"
          multiRepositoryMode
          repositoryStatuses={[
            {
              repositoryRoot: "services/api",
              displayName: "api",
              branchName: "main",
              stagedFiles: [],
              unstagedFiles: [
                { path: "pom.xml", status: "M", additions: 1, deletions: 0 },
              ],
              totalAdditions: 1,
              totalDeletions: 0,
              error: null,
            },
          ]}
          onOpenFile={onOpenFile}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "pom.xml" }));

      expect(onOpenFile).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(mockEditableDiffReviewSurface).toHaveBeenCalled();
      });
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_git_diffs", {
        workspaceId: "ws-1",
        repositoryRoot: "services/api",
      });
    });

  it("forwards repository identity when multi-repository open-file action is used", () => {
      const onOpenFile = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          workspaceId="ws-1"
          multiRepositoryMode
          repositoryStatuses={[
            {
              repositoryRoot: "services/api",
              displayName: "api",
              branchName: "main",
              stagedFiles: [],
              unstagedFiles: [
                { path: "pom.xml", status: "M", additions: 1, deletions: 0 },
              ],
              totalAdditions: 1,
              totalDeletions: 0,
              error: null,
            },
          ]}
          onOpenFile={onOpenFile}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Open file content" }));

      expect(onOpenFile).toHaveBeenCalledWith("pom.xml", "services/api");
    });

  it("scopes multi-repository context-menu stage and unstage actions to the clicked repository", async () => {
      const onStageRepositoryFile = vi.fn(async () => undefined);
      const onUnstageRepositoryFile = vi.fn(async () => undefined);
      const onRevertRepositoryFile = vi.fn(async () => undefined);
      const onRefreshRepositoryStatuses = vi.fn(async () => undefined);
      const onOpenFile = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          workspaceId="ws-1"
          multiRepositoryMode
          repositoryStatuses={[
            {
              repositoryRoot: "services/a",
              displayName: "a",
              branchName: "main",
              stagedFiles: [
                { path: "pom.xml", status: "M", additions: 1, deletions: 0 },
              ],
              unstagedFiles: [],
              totalAdditions: 1,
              totalDeletions: 0,
              error: null,
            },
            {
              repositoryRoot: "services/b",
              displayName: "b",
              branchName: "main",
              stagedFiles: [],
              unstagedFiles: [
                { path: "pom.xml", status: "M", additions: 0, deletions: 1 },
              ],
              totalAdditions: 0,
              totalDeletions: 1,
              error: null,
            },
          ]}
          onStageRepositoryFile={onStageRepositoryFile}
          onUnstageRepositoryFile={onUnstageRepositoryFile}
          onRevertRepositoryFile={onRevertRepositoryFile}
          onRefreshRepositoryStatuses={onRefreshRepositoryStatuses}
          onOpenFile={onOpenFile}
        />,
      );

      const repositoryGroups = document.querySelectorAll<HTMLElement>(
        ".git-repository-change-group",
      );
      const stagedRow = repositoryGroups[0]?.querySelector<HTMLElement>(
        '.diff-row[data-section="staged"][data-path="pom.xml"]',
      );
      const unstagedRow = repositoryGroups[1]?.querySelector<HTMLElement>(
        '.diff-row[data-section="unstaged"][data-path="pom.xml"]',
      );
      if (!stagedRow || !unstagedRow) {
        throw new Error("Expected same-path rows in both repositories");
      }

      const stageMenu = await openGitFileContextMenu(unstagedRow);
      expect(onStageRepositoryFile).not.toHaveBeenCalled();
      expect(onUnstageRepositoryFile).not.toHaveBeenCalled();
      expect(onRevertRepositoryFile).not.toHaveBeenCalled();
      expect(onRefreshRepositoryStatuses).not.toHaveBeenCalled();
      expect(onOpenFile).not.toHaveBeenCalled();
      fireEvent.click(within(stageMenu).getByRole("menuitem", { name: "Stage file" }));

      await waitFor(() => {
        expect(onStageRepositoryFile).toHaveBeenCalledWith("services/b", "pom.xml");
        expect(onRefreshRepositoryStatuses).toHaveBeenCalledTimes(1);
      });
      expect(onStageRepositoryFile).not.toHaveBeenCalledWith("services/a", "pom.xml");
      expect(onUnstageRepositoryFile).not.toHaveBeenCalled();

      const unstageMenu = await openGitFileContextMenu(stagedRow);
      expect(onUnstageRepositoryFile).not.toHaveBeenCalled();
      expect(onRefreshRepositoryStatuses).toHaveBeenCalledTimes(1);
      fireEvent.click(within(unstageMenu).getByRole("menuitem", { name: "Unstage file" }));

      await waitFor(() => {
        expect(onUnstageRepositoryFile).toHaveBeenCalledWith("services/a", "pom.xml");
        expect(onRefreshRepositoryStatuses).toHaveBeenCalledTimes(2);
      });
      expect(onUnstageRepositoryFile).not.toHaveBeenCalledWith("services/b", "pom.xml");
      expect(onRevertRepositoryFile).not.toHaveBeenCalled();
      expect(onOpenFile).not.toHaveBeenCalled();
    });

  it("preserves an empty workspace-root scope in multi-repository context-menu actions", async () => {
      const onStageRepositoryFile = vi.fn(async () => undefined);
      const onRefreshRepositoryStatuses = vi.fn(async () => undefined);
      render(
        <GitDiffPanel
          {...baseProps}
          workspaceId="ws-1"
          multiRepositoryMode
          repositoryStatuses={[
            {
              repositoryRoot: "",
              displayName: "workspace",
              branchName: "main",
              stagedFiles: [],
              unstagedFiles: [
                { path: "root.txt", status: "M", additions: 1, deletions: 0 },
              ],
              totalAdditions: 1,
              totalDeletions: 0,
              error: null,
            },
          ]}
          onStageRepositoryFile={onStageRepositoryFile}
          onRefreshRepositoryStatuses={onRefreshRepositoryStatuses}
        />,
      );

      const row = document.querySelector<HTMLElement>(
        '.diff-row[data-section="unstaged"][data-path="root.txt"]',
      );
      if (!row) {
        throw new Error("Expected workspace-root file row");
      }
      const gitMenu = await openGitFileContextMenu(row);
      expect(onStageRepositoryFile).not.toHaveBeenCalled();
      expect(onRefreshRepositoryStatuses).not.toHaveBeenCalled();

      fireEvent.click(within(gitMenu).getByRole("menuitem", { name: "Stage file" }));

      await waitFor(() => {
        expect(onStageRepositoryFile).toHaveBeenCalledWith("", "root.txt");
        expect(onRefreshRepositoryStatuses).toHaveBeenCalledOnce();
      });
    });

  it("opens multi-repository File History with exact same-path and empty-root identities", async () => {
      const onOpenFileHistory = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          workspaceId="ws-1"
          workspacePath="/workspace"
          multiRepositoryMode
          repositoryStatuses={[
            {
              repositoryRoot: "",
              displayName: "workspace",
              branchName: "main",
              stagedFiles: [],
              unstagedFiles: [
                { path: "pom.xml", status: "M", additions: 1, deletions: 0 },
              ],
              totalAdditions: 1,
              totalDeletions: 0,
              error: null,
            },
            {
              repositoryRoot: "services/api",
              displayName: "api",
              branchName: "main",
              stagedFiles: [],
              unstagedFiles: [
                { path: "pom.xml", status: "M", additions: 1, deletions: 0 },
              ],
              totalAdditions: 1,
              totalDeletions: 0,
              error: null,
            },
          ]}
          onOpenFileHistory={onOpenFileHistory}
        />,
      );

      const repositoryGroups = document.querySelectorAll<HTMLElement>(
        ".git-repository-change-group",
      );
      const rootRow = repositoryGroups[0]?.querySelector<HTMLElement>(
        '.diff-row[data-section="unstaged"][data-path="pom.xml"]',
      );
      const nestedRow = repositoryGroups[1]?.querySelector<HTMLElement>(
        '.diff-row[data-section="unstaged"][data-path="pom.xml"]',
      );
      if (!rootRow || !nestedRow) {
        throw new Error("Expected same-path root and nested repository rows");
      }

      const nestedMenu = await openGitFileContextMenu(nestedRow);
      fireEvent.click(
        within(nestedMenu).getByRole("menuitem", { name: "Show file history" }),
      );
      expect(onOpenFileHistory).toHaveBeenLastCalledWith({
        workspaceId: "ws-1",
        workspacePath: "/workspace",
        repositoryRoot: "services/api",
        path: "pom.xml",
        displayPath: "services/api/pom.xml",
      });

      const rootMenu = await openGitFileContextMenu(rootRow);
      fireEvent.click(
        within(rootMenu).getByRole("menuitem", { name: "Show file history" }),
      );
      expect(onOpenFileHistory).toHaveBeenLastCalledWith({
        workspaceId: "ws-1",
        workspacePath: "/workspace",
        repositoryRoot: "",
        path: "pom.xml",
        displayPath: "pom.xml",
      });
      expect(onOpenFileHistory).toHaveBeenCalledTimes(2);
    });

  it("dismisses a stale file context menu when the repository topology changes", async () => {
      const onStageRepositoryFile = vi.fn(async () => undefined);
      const onRefreshRepositoryStatuses = vi.fn(async () => undefined);
      const { rerender } = render(
        <GitDiffPanel
          {...baseProps}
          workspaceId="ws-a"
          multiRepositoryMode
          repositoryStatuses={[
            {
              repositoryRoot: "services/a",
              displayName: "a",
              branchName: "main",
              stagedFiles: [],
              unstagedFiles: [
                { path: "pom.xml", status: "M", additions: 1, deletions: 0 },
              ],
              totalAdditions: 1,
              totalDeletions: 0,
              error: null,
            },
          ]}
          onStageRepositoryFile={onStageRepositoryFile}
          onRefreshRepositoryStatuses={onRefreshRepositoryStatuses}
        />,
      );

      const row = document.querySelector<HTMLElement>(
        '.diff-row[data-section="unstaged"][data-path="pom.xml"]',
      );
      if (!row) {
        throw new Error("Expected repository-scoped file row");
      }
      const gitMenu = await openGitFileContextMenu(row);
      expect(within(gitMenu).getByRole("menuitem", { name: "Stage file" })).toBeTruthy();

      rerender(
        <GitDiffPanel
          {...baseProps}
          workspaceId="ws-b"
          multiRepositoryMode
          repositoryStatuses={[
            {
              repositoryRoot: "services/b",
              displayName: "b",
              branchName: "main",
              stagedFiles: [],
              unstagedFiles: [
                { path: "pom.xml", status: "M", additions: 1, deletions: 0 },
              ],
              totalAdditions: 1,
              totalDeletions: 0,
              error: null,
            },
          ]}
          onStageRepositoryFile={onStageRepositoryFile}
          onRefreshRepositoryStatuses={onRefreshRepositoryStatuses}
        />,
      );

      await waitFor(() => {
        expect(screen.queryByRole("menuitem", { name: "Git" })).toBeNull();
      });
      expect(onStageRepositoryFile).not.toHaveBeenCalled();
      expect(onRefreshRepositoryStatuses).not.toHaveBeenCalled();
    });

  it("dismisses a stale History menu when the navigation callback changes", async () => {
      const files = [
        { path: "src/main.ts", status: "M", additions: 1, deletions: 0 },
      ];
      const firstHistoryCallback = vi.fn();
      const secondHistoryCallback = vi.fn();
      const { rerender } = render(
        <GitDiffPanel
          {...baseProps}
          workspaceId="ws-1"
          workspacePath="/workspace"
          unstagedFiles={files}
          onOpenFileHistory={firstHistoryCallback}
        />,
      );

      const row = document.querySelector<HTMLElement>(
        '.diff-row[data-section="unstaged"][data-path="src/main.ts"]',
      );
      if (!row) {
        throw new Error("Expected file history row");
      }
      const gitMenu = await openGitFileContextMenu(row);
      expect(
        within(gitMenu).getByRole("menuitem", { name: "Show file history" }),
      ).toBeTruthy();

      rerender(
        <GitDiffPanel
          {...baseProps}
          workspaceId="ws-1"
          workspacePath="/workspace"
          unstagedFiles={files}
          onOpenFileHistory={secondHistoryCallback}
        />,
      );

      await waitFor(() => {
        expect(screen.queryByRole("menuitem", { name: "Git" })).toBeNull();
      });
      expect(firstHistoryCallback).not.toHaveBeenCalled();
      expect(secondHistoryCallback).not.toHaveBeenCalled();
    });
});
