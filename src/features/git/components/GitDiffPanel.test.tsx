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
  it("positions the bottom commit message menu above its trigger once", () => {
      expect(
        resolveBottomCommitMessageMenuPosition(
          { right: 980, top: 820 },
          { width: 260, height: 300 },
          { width: 1000, height: 1000 },
        ),
      ).toEqual({ x: 720, y: 512 });
    });

  it("resolves safe root, nested, Windows, and explicit repository File History targets", () => {
      expect(resolveGitDiffFileHistoryTarget({
        workspaceId: "ws-root",
        workspacePath: "/workspace",
        gitRoot: null,
        path: "src/main.ts",
      })).toEqual({
        workspaceId: "ws-root",
        workspacePath: "/workspace",
        repositoryRoot: "",
        path: "src/main.ts",
        displayPath: "src/main.ts",
      });
      expect(resolveGitDiffFileHistoryTarget({
        workspaceId: "ws-nested",
        workspacePath: "C:\\workspace",
        gitRoot: "C:\\workspace\\services\\api",
        path: "src\\main.ts",
      })).toEqual({
        workspaceId: "ws-nested",
        workspacePath: "C:\\workspace",
        repositoryRoot: "services/api",
        path: "src/main.ts",
        displayPath: "services/api/src/main.ts",
      });
      expect(resolveGitDiffFileHistoryTarget({
        workspaceId: "ws-root",
        workspacePath: "/workspace",
        repositoryRoot: "",
        path: "README.md",
      })?.repositoryRoot).toBe("");
      expect(resolveGitDiffFileHistoryTarget({
        workspaceId: "ws-root",
        workspacePath: "/workspace",
        gitRoot: "/workspace",
        path: "README.md",
      })?.repositoryRoot).toBe("");
      expect(resolveGitDiffFileHistoryTarget({
        workspaceId: "ws-root",
        workspacePath: "/workspace",
        repositoryRoot: "services/api",
        path: "../escape.ts",
      })).toBeNull();
      expect(resolveGitDiffFileHistoryTarget({
        workspaceId: "ws-root",
        workspacePath: "/workspace",
        gitRoot: "/outside/repository",
        path: "src/main.ts",
      })).toBeNull();
    });

  it("renders single-repository changes above the bottom commit composer", () => {
      render(
        <GitDiffPanel
          {...baseProps}
          stagedFiles={[{ path: "file.txt", status: "M", additions: 1, deletions: 0 }]}
          commitMessage="fix: bottom composer"
          onCommit={vi.fn()}
          onGenerateCommitMessage={vi.fn()}
        />,
      );

      const content = document.querySelector(".diff-commit-workspace-content");
      const composer = document.querySelector(".git-commit-composer");
      expect(content).toBeTruthy();
      expect(composer).toBeTruthy();
      expect(Boolean(
        content && composer &&
        (content.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING),
      )).toBe(true);
    });

  it("renders single-repository commit composer above changes when configured", () => {
      writeClientStoreValue("layout", "git.commitComposerPlacement", "top");

      render(
        <GitDiffPanel
          {...baseProps}
          stagedFiles={[{ path: "file.txt", status: "M", additions: 1, deletions: 0 }]}
          commitMessage="fix: top composer"
          onCommit={vi.fn()}
          onGenerateCommitMessage={vi.fn()}
        />,
      );

      const content = document.querySelector(".diff-commit-workspace-content");
      const composer = document.querySelector(".git-commit-composer");
      expect(content).toBeTruthy();
      expect(composer).toBeTruthy();
      expect(Boolean(
        composer && content &&
        (composer.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING),
      )).toBe(true);
      expect(composer?.classList.contains("git-commit-composer--top")).toBe(true);
    });

  it("falls back to bottom commit composer for invalid stored placement", () => {
      writeClientStoreValue("layout", "git.commitComposerPlacement", "floating");

      render(
        <GitDiffPanel
          {...baseProps}
          stagedFiles={[{ path: "file.txt", status: "M", additions: 1, deletions: 0 }]}
          commitMessage="fix: fallback composer"
          onCommit={vi.fn()}
          onGenerateCommitMessage={vi.fn()}
        />,
      );

      const content = document.querySelector(".diff-commit-workspace-content");
      const composer = document.querySelector(".git-commit-composer");
      expect(Boolean(
        content && composer &&
        (content.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING),
      )).toBe(true);
      expect(composer?.classList.contains("git-commit-composer--bottom")).toBe(true);
    });

  it("maps nested repository diff paths to cross-platform workspace file paths", () => {
      expect(resolveRepositoryWorkspaceFilePath("/workspace", "services/api", "src/App.tsx"))
        .toBe("services/api/src/App.tsx");
      expect(resolveRepositoryWorkspaceFilePath(
        "C:\\workspace",
        "services\\api",
        "src\\App.tsx",
      )).toBe("services/api/src/App.tsx");
      expect(resolveRepositoryWorkspaceFilePath("/workspace", "services/api", "services/api/src/App.tsx"))
        .toBe("services/api/src/App.tsx");
    });

  it("passes the nested repository workspace path into the preview loader", async () => {
      render(
        <GitDiffPanel
          {...baseProps}
          workspaceId="workspace-1"
          workspacePath="/workspace"
          gitRoot="/workspace/services/api"
          unstagedFiles={[{ path: "src/App.tsx", status: "M", additions: 1, deletions: 1 }]}
          diffEntries={[{ path: "src/App.tsx", status: "M", diff: "@@ -1 +1 @@\n-old\n+new" }]}
          modalPreviewRequest={{ path: "src/App.tsx", requestId: 77, maximized: true }}
        />,
      );

      await waitFor(() => {
        expect(mockEditableDiffReviewSurface).toHaveBeenCalled();
      });
      const previewProps = mockEditableDiffReviewSurface.mock.lastCall?.[0] as {
        files?: Array<{ workspaceRelativeFilePath?: string }>;
        fullDiffLoader?: (path: string) => Promise<string>;
      };
      expect(previewProps.files?.[0]?.workspaceRelativeFilePath)
        .toBe("services/api/src/App.tsx");
      await previewProps.fullDiffLoader?.("src/App.tsx");
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_git_file_full_diff", {
        workspaceId: "workspace-1",
        path: "src/App.tsx",
        repositoryRoot: "services/api",
      });
    });

  it("disables commit and shows explicit hint when only unstaged changes exist", () => {
      const onCommit = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          commitMessage="feat: add thing"
          onCommit={onCommit}
          onGenerateCommitMessage={vi.fn()}
          unstagedFiles={[
            { path: "file.txt", status: "M", additions: 1, deletions: 0 },
          ]}
        />,
      );
      const commitButton = screen.getByRole("button", { name: "Commit" });
      expect((commitButton as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByText("Select files to commit first")).toBeTruthy();
      fireEvent.click(commitButton);
      expect(onCommit).not.toHaveBeenCalled();
    });

  it("builds a nested tree from file paths", () => {
      const tree = buildDiffTree(
        [
          { path: "src/app/main.tsx", status: "M", additions: 1, deletions: 0 },
          { path: "src/git/GitDiffPanel.tsx", status: "A", additions: 2, deletions: 0 },
          { path: "README.md", status: "M", additions: 1, deletions: 1 },
        ],
        "unstaged",
      );

      expect(tree.folders.has("src")).toBe(true);
      expect(tree.files.map((entry) => entry.path)).toEqual(["README.md"]);
      const srcNode = tree.folders.get("src");
      expect(srcNode?.folders.has("app")).toBe(true);
      expect(srcNode?.folders.has("git")).toBe(true);
    });

  it("renders diff-only fallback rows as preview-only entries", () => {
      render(
        <GitDiffPanel
          {...baseProps}
          unstagedFiles={[
            {
              path: "src/new-file.ts",
              status: "A",
              additions: 1,
              deletions: 0,
              isDiffOnlyFallback: true,
              mutationDisabled: true,
            },
          ]}
          onSelectFile={vi.fn()}
          onStageFile={vi.fn()}
          onRevertFile={vi.fn()}
          onGenerateCommitMessage={vi.fn()}
        />,
      );

      const row = screen.getByLabelText("src/new-file.ts");
      expect(row.getAttribute("data-diff-only-fallback")).toBe("true");
      expect(screen.queryByRole("button", { name: "Stage file" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Discard change" })).toBeNull();
      expect(
        screen.queryByRole("checkbox", {
          name: "Toggle commit selection: src/new-file.ts",
        }),
      ).toBeNull();
      expect(
        screen.getByRole("button", { name: "Preview diff in center pane" }),
      ).toBeTruthy();
    });

  it("invokes manual git status and diff refresh from the repository summary action", () => {
      const onRefreshGitStatus = vi.fn();
      const onRefreshGitDiffs = vi.fn();
      const onRefreshGitLog = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          workspacePath="/tmp/ccgui"
          onRefreshGitStatus={onRefreshGitStatus}
          onRefreshGitDiffs={onRefreshGitDiffs}
          onRefreshGitLog={onRefreshGitLog}
          unstagedFiles={[
            { path: "src/App.tsx", status: "M", additions: 2, deletions: 1 },
          ]}
        />,
      );

      const refreshButton = screen.getByRole("button", { name: "Refresh Git status" });
      const panelActions = screen.getByRole("group", { name: "Git panel" });
      const sectionHeader = document.querySelector(".git-filetree-section-header");

      expect(sectionHeader?.textContent).not.toContain("ccgui");
      expect(sectionHeader?.lastElementChild?.classList.contains("diff-section-count-badge")).toBe(true);
      expect(panelActions.contains(refreshButton)).toBe(true);

      fireEvent.click(refreshButton);

      expect(onRefreshGitStatus).toHaveBeenCalledTimes(1);
      expect(onRefreshGitDiffs).toHaveBeenCalledTimes(1);
      expect(onRefreshGitLog).toHaveBeenCalledTimes(1);
    });

  it("keeps manual git refresh available when only outgoing commit status is stale", () => {
      const onRefreshGitStatus = vi.fn();
      const onRefreshGitDiffs = vi.fn();
      const onRefreshGitLog = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          fileStatus="No changes"
          commitsAhead={1}
          onRefreshGitStatus={onRefreshGitStatus}
          onRefreshGitDiffs={onRefreshGitDiffs}
          onRefreshGitLog={onRefreshGitLog}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Refresh Git status" }));

      expect(onRefreshGitStatus).toHaveBeenCalledTimes(1);
      expect(onRefreshGitDiffs).toHaveBeenCalledTimes(1);
      expect(onRefreshGitLog).toHaveBeenCalledTimes(1);
    });

  it("spins the manual git status refresh icon when clicked", () => {
      vi.useFakeTimers();
      const requestAnimationFrameSpy = vi
        .spyOn(window, "requestAnimationFrame")
        .mockImplementation((callback: FrameRequestCallback) => {
          callback(performance.now());
          return 1;
        });
      const cancelAnimationFrameSpy = vi
        .spyOn(window, "cancelAnimationFrame")
        .mockImplementation(() => undefined);
      const onRefreshGitStatus = vi.fn();

      render(
        <GitDiffPanel
          {...baseProps}
          workspacePath="/tmp/ccgui"
          onRefreshGitStatus={onRefreshGitStatus}
          unstagedFiles={[
            { path: "src/App.tsx", status: "M", additions: 2, deletions: 1 },
          ]}
        />,
      );

      const refreshButton = screen.getByRole("button", { name: "Refresh Git status" });

      fireEvent.click(refreshButton);
      act(() => {
        vi.advanceTimersByTime(16);
      });
      expect(refreshButton.className).toContain("is-spinning");
      expect(onRefreshGitStatus).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(520);
      });
      expect(refreshButton.className).not.toContain("is-spinning");

      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
      vi.useRealTimers();
    });

  it("marks deleted rows with a stable deleted status hook", () => {
      render(
        <GitDiffPanel
          {...baseProps}
          unstagedFiles={[
            { path: "src/old-file.ts", status: "D", additions: 0, deletions: 1 },
          ]}
          onRevertFile={vi.fn()}
          onGenerateCommitMessage={vi.fn()}
        />,
      );

      expect(screen.getByLabelText("src/old-file.ts").getAttribute("data-status")).toBe("D");
    });

  it("builds a nested tree from Windows-style file paths", () => {
      const tree = buildDiffTree(
        [
          { path: "src\\app\\main.tsx", status: "M", additions: 1, deletions: 0 },
          { path: "README.md", status: "M", additions: 1, deletions: 1 },
        ],
        "unstaged",
      );

      expect(tree.folders.has("src")).toBe(true);
      const srcNode = tree.folders.get("src");
      expect(srcNode?.folders.has("app")).toBe(true);
      expect(tree.files.map((entry) => entry.path)).toEqual(["README.md"]);
    });

  it("keeps compact folder entries distinct when dotted display labels collide", () => {
      const tree = compactDiffTree(
        buildDiffTree(
          [
            { path: "a.b/file-a.ts", status: "M", additions: 1, deletions: 0 },
            { path: "a/b/file-b.ts", status: "M", additions: 1, deletions: 0 },
          ],
          "unstaged",
        ),
      );

      const folders = Array.from(tree.folders.values());
      expect(folders.map((folder) => folder.name)).toEqual(["a.b", "a.b"]);
      expect(folders.map((folder) => folder.key).sort()).toEqual([
        "unstaged:/a.b/",
        "unstaged:/a/b/",
      ]);
      expect(folders.flatMap((folder) => folder.files.map((file) => file.path)).sort()).toEqual([
        "a.b/file-a.ts",
        "a/b/file-b.ts",
      ]);
    });

  it("supports tree keyboard navigation and Enter-to-open DIFF modal", () => {
      const onSelectFile = vi.fn();
      const onOpenFile = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="tree"
          unstagedFiles={[
            { path: "a.ts", status: "M", additions: 1, deletions: 0 },
            { path: "b.ts", status: "M", additions: 1, deletions: 0 },
          ]}
          diffEntries={[
            {
              path: "b.ts",
              status: "M",
              diff: "diff --git a/b.ts b/b.ts\n@@ -1 +1 @@\n-old\n+new\n",
            },
          ]}
          onSelectFile={onSelectFile}
          onOpenFile={onOpenFile}
        />,
      );

      const firstRow = document.querySelector<HTMLElement>('.diff-row[data-path="a.ts"]');
      const secondRow = document.querySelector<HTMLElement>('.diff-row[data-path="b.ts"]');
      expect(firstRow).toBeTruthy();
      expect(secondRow).toBeTruthy();
      firstRow?.focus();
      fireEvent.keyDown(firstRow as HTMLElement, { key: "ArrowDown" });
      expect(document.activeElement).toBe(secondRow);
      fireEvent.keyDown(secondRow as HTMLElement, { key: "Enter" });
      expect(onSelectFile).not.toHaveBeenCalled();
      expect(onOpenFile).not.toHaveBeenCalled();
      expect(document.querySelector(".git-history-diff-modal")).toBeTruthy();
    });
});
