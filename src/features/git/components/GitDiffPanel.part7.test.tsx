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
  it("opens file content from explicit row action without opening DIFF modal", () => {
      const onSelectFile = vi.fn();
      const onOpenFile = vi.fn();
      const onCreateCodeAnnotation = vi.fn();
      const codeAnnotations = [
        {
          id: "annotation-1",
          path: "file.txt",
          lineRange: { startLine: 2, endLine: 2 },
          body: "check this",
          source: "modal-diff-view" as const,
        },
      ];
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          onSelectFile={onSelectFile}
          onOpenFile={onOpenFile}
          onCreateCodeAnnotation={onCreateCodeAnnotation}
          codeAnnotations={codeAnnotations}
          unstagedFiles={[
            { path: "file.txt", status: "M", additions: 1, deletions: 0 },
          ]}
          diffEntries={[
            {
              path: "file.txt",
              status: "M",
              diff: "diff --git a/file.txt b/file.txt\n@@ -1 +1 @@\n-old\n+new\n",
            },
          ]}
        />,
      );

      const openFileButton = document.querySelector<HTMLButtonElement>(
        '.diff-row[data-path="file.txt"] .diff-row-action--preview-modal',
      );
      expect(openFileButton).toBeTruthy();

      fireEvent.click(openFileButton as HTMLButtonElement);
      expect(onSelectFile).not.toHaveBeenCalled();
      expect(onOpenFile).toHaveBeenCalledWith("file.txt");
      expect(document.querySelector(".git-history-diff-modal")).toBeNull();
    });

  it("opens DIFF modal with annotations on regular row click", () => {
      const onSelectFile = vi.fn();
      const onOpenFile = vi.fn();
      const onCreateCodeAnnotation = vi.fn();
      const codeAnnotations = [
        {
          id: "annotation-1",
          path: "file.txt",
          lineRange: { startLine: 2, endLine: 2 },
          body: "check this",
          source: "modal-diff-view" as const,
        },
      ];
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          onSelectFile={onSelectFile}
          onOpenFile={onOpenFile}
          onCreateCodeAnnotation={onCreateCodeAnnotation}
          codeAnnotations={codeAnnotations}
          unstagedFiles={[
            { path: "file.txt", status: "M", additions: 1, deletions: 0 },
          ]}
          diffEntries={[
            {
              path: "file.txt",
              status: "M",
              diff: "diff --git a/file.txt b/file.txt\n@@ -1 +1 @@\n-old\n+new\n",
            },
          ]}
        />,
      );

      const row = document.querySelector<HTMLElement>('.diff-row[data-path="file.txt"]');
      fireEvent.click(row as HTMLElement);
      expect(onOpenFile).not.toHaveBeenCalled();
      expect(onSelectFile).not.toHaveBeenCalled();
      expect(document.querySelector(".git-history-diff-modal")).toBeTruthy();
      expect(mockEditableDiffReviewSurface.mock.lastCall?.[0]).toMatchObject({
        onCreateCodeAnnotation,
        codeAnnotations,
        codeAnnotationSurface: "modal-diff-view",
      });
    });

  it("keeps flat mode stage-all action behavior", () => {
      const onStageAllChanges = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          onStageAllChanges={onStageAllChanges}
          unstagedFiles={[
            { path: "file-a.txt", status: "M", additions: 1, deletions: 0 },
            { path: "file-b.txt", status: "M", additions: 2, deletions: 0 },
          ]}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Stage all changes" }),
      );
      expect(screen.getByRole("group", { name: "Changes actions" })).toBeTruthy();
      expect(onStageAllChanges).toHaveBeenCalledTimes(1);
    });

  it("toggles the unstaged commit scope from the section checkbox", () => {
      const onCommit = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          onCommit={onCommit}
          commitMessage="feat: selective commit"
          onGenerateCommitMessage={vi.fn()}
          unstagedFiles={[
            { path: "file-a.txt", status: "M", additions: 1, deletions: 0 },
            { path: "file-b.txt", status: "M", additions: 2, deletions: 0 },
          ]}
        />,
      );

      fireEvent.click(
        screen.getByRole("checkbox", { name: "Toggle commit selection: Changes" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Commit" }));

      expect(onCommit).toHaveBeenCalledWith(["file-a.txt", "file-b.txt"]);
    });

  it("keeps tree mode unstage-all action behavior", async () => {
      const onUnstageAllChanges = vi.fn();
      const onUnstageFile = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="tree"
          onUnstageAllChanges={onUnstageAllChanges}
          onUnstageFile={onUnstageFile}
          stagedFiles={[
            { path: "src/a.ts", status: "M", additions: 1, deletions: 0 },
            { path: "src/b.ts", status: "M", additions: 2, deletions: 0 },
          ]}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Unstage all changes" }),
      );

      await waitFor(() => {
        expect(onUnstageAllChanges).toHaveBeenCalledTimes(1);
      });
      expect(onUnstageFile).not.toHaveBeenCalled();
    });

  it("falls back bulk unstage-all to onUnstageFiles when all-handler is absent", async () => {
      const onUnstageFiles = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="tree"
          onUnstageFiles={onUnstageFiles}
          stagedFiles={[
            { path: "src/a.ts", status: "M", additions: 1, deletions: 0 },
            { path: "src/b.ts", status: "M", additions: 2, deletions: 0 },
          ]}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Unstage all changes" }),
      );

      await waitFor(() => {
        expect(onUnstageFiles).toHaveBeenCalledWith(["src/a.ts", "src/b.ts"]);
      });
    });

  it("toggles unstaged file commit selection through the file checkbox without staging", () => {
      const onStageFile = vi.fn();
      const onCommit = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          onStageFile={onStageFile}
          onCommit={onCommit}
          commitMessage="feat: selective commit"
          onGenerateCommitMessage={vi.fn()}
          unstagedFiles={[
            { path: "file.txt", status: "M", additions: 1, deletions: 0 },
          ]}
        />,
      );
      fireEvent.click(screen.getByRole("checkbox", { name: "Toggle commit selection: file.txt" }));
      expect(onStageFile).not.toHaveBeenCalled();
      expect(screen.getByText("1 file selected for commit")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Commit" }));
      expect(onCommit).toHaveBeenCalledWith(["file.txt"]);
    });

  it("keeps tree folder rows free of commit checkboxes and selects scope from trailing file controls", async () => {
      const onStageFile = vi.fn();
      const onCommit = vi.fn();
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="tree"
          onStageFile={onStageFile}
          onCommit={onCommit}
          commitMessage="feat: selective commit"
          onGenerateCommitMessage={vi.fn()}
          stagedFiles={[
            { path: "src/already-staged.ts", status: "M", additions: 2, deletions: 0 },
          ]}
          unstagedFiles={[
            { path: "src/pending-a.ts", status: "M", additions: 1, deletions: 0 },
            { path: "src/pending-b.ts", status: "M", additions: 1, deletions: 0 },
          ]}
        />,
      );

      expect(
        screen.queryByRole("checkbox", {
          name: "Toggle commit selection: src",
        }),
      ).toBeNull();

      fireEvent.click(
        screen.getByRole("checkbox", {
          name: "Toggle commit selection: src/pending-a.ts",
        }),
      );
      fireEvent.click(
        screen.getByRole("checkbox", {
          name: "Toggle commit selection: src/pending-b.ts",
        }),
      );
      expect(onStageFile).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Commit" }));

      await waitFor(() => {
        expect(onCommit).toHaveBeenCalledWith([
          "src/already-staged.ts",
          "src/pending-a.ts",
          "src/pending-b.ts",
        ]);
      });
    });

  it("keeps hybrid staged files locked to the existing git index semantics", () => {
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          stagedFiles={[
            { path: "src/hybrid.ts", status: "M", additions: 2, deletions: 0 },
          ]}
          unstagedFiles={[
            { path: "src/hybrid.ts", status: "M", additions: 1, deletions: 1 },
          ]}
        />,
      );

      const hybridToggles = screen.getAllByRole("checkbox", {
        name: "Toggle commit selection: src/hybrid.ts",
      });
      expect(hybridToggles).toHaveLength(2);
      for (const toggle of hybridToggles) {
        expect((toggle as HTMLButtonElement).disabled).toBe(true);
      }
    });

  it("shows staged commit count in the commit scope hint", () => {
      render(
        <GitDiffPanel
          {...baseProps}
          commitMessage="feat: add thing"
          onGenerateCommitMessage={vi.fn()}
          stagedFiles={[
            { path: "file.txt", status: "M", additions: 1, deletions: 0 },
          ]}
        />,
      );
      expect(screen.getByText("1 file selected for commit")).toBeTruthy();
    });

  it("toggles preview modal maximize state", () => {
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          unstagedFiles={[
            { path: "file.txt", status: "M", additions: 1, deletions: 0 },
          ]}
          diffEntries={[
            {
              path: "file.txt",
              status: "M",
              diff: "diff --git a/file.txt b/file.txt\n@@ -1 +1 @@\n-old\n+new\n",
            },
          ]}
        />,
      );

      const fileRow = screen.getByLabelText("file.txt");
      fireEvent.click(fileRow);

      const modal = document.querySelector(".git-history-diff-modal");
      expect(modal).toBeTruthy();
      expect(modal?.classList.contains("is-maximized")).toBe(false);

      const maximizeButton = screen.getByRole("button", { name: "Maximize" });
      fireEvent.click(maximizeButton);
      expect(modal?.classList.contains("is-maximized")).toBe(true);

      const restoreButton = screen.getByRole("button", { name: "Restore" });
      fireEvent.click(restoreButton);
      expect(modal?.classList.contains("is-maximized")).toBe(false);
    });

  it("opens the existing modal from an external path request", async () => {
      const props = {
        ...baseProps,
        unstagedFiles: [
          { path: "src/new-file.ts", status: "A", additions: 2, deletions: 0 },
        ],
        diffEntries: [
          {
            path: "src/new-file.ts",
            status: "A",
            diff: "@@ -0,0 +1,2 @@\n+one\n+two",
          },
        ],
      };
      const { rerender } = render(
        <GitDiffPanel
          {...props}
          modalPreviewRequest={{ path: "src/new-file.ts", requestId: 1, maximized: true }}
        />,
      );

      await waitFor(() => {
        expect(document.querySelector(".git-history-diff-modal")?.classList.contains("is-maximized"))
          .toBe(true);
      });
      fireEvent.click(screen.getByRole("button", { name: "Mock close preview" }));
      await waitFor(() => {
        expect(document.querySelector(".git-history-diff-modal")).toBeNull();
      });

      rerender(
        <GitDiffPanel
          {...props}
          modalPreviewRequest={{ path: "src/new-file.ts", requestId: 2, maximized: true }}
        />,
      );
      await waitFor(() => {
        expect(document.querySelector(".git-history-diff-modal")).toBeTruthy();
      });
    });

  it("keeps an external request for a missing path as a stable no-op", () => {
      render(
        <GitDiffPanel
          {...baseProps}
          modalPreviewRequest={{ path: "src/missing.ts", requestId: 1 }}
        />,
      );

      expect(document.querySelector(".git-history-diff-modal")).toBeNull();
    });

  it("retries an external request when the Git file list arrives later", async () => {
      const request = { path: "src/delayed.ts", requestId: 1, maximized: true };
      const { rerender } = render(
        <GitDiffPanel {...baseProps} modalPreviewRequest={request} />,
      );
      expect(document.querySelector(".git-history-diff-modal")).toBeNull();

      rerender(
        <GitDiffPanel
          {...baseProps}
          unstagedFiles={[
            { path: "src/delayed.ts", status: "A", additions: 1, deletions: 0 },
          ]}
          diffEntries={[
            { path: "src/delayed.ts", status: "A", diff: "@@ -0,0 +1 @@\n+new" },
          ]}
          modalPreviewRequest={request}
        />,
      );

      await waitFor(() => {
        expect(document.querySelector(".git-history-diff-modal")?.classList.contains("is-maximized"))
          .toBe(true);
      });
    });

  it("opens a staged file from an external modal request", async () => {
      render(
        <GitDiffPanel
          {...baseProps}
          stagedFiles={[
            { path: "src/staged.ts", status: "M", additions: 1, deletions: 1 },
          ]}
          diffEntries={[
            {
              path: "src/staged.ts",
              status: "M",
              diff: "@@ -1 +1 @@\n-old\n+new",
            },
          ]}
          modalPreviewRequest={{ path: "src/staged.ts", requestId: 1, maximized: true }}
        />,
      );

      await waitFor(() => {
        expect(document.querySelector(".git-history-diff-modal")?.classList.contains("is-maximized"))
          .toBe(true);
      });
    });

  it("routes preview modal close through GitDiffViewer external header controls", async () => {
      render(
        <GitDiffPanel
          {...baseProps}
          gitDiffListView="flat"
          unstagedFiles={[
            { path: "file.txt", status: "M", additions: 1, deletions: 0 },
          ]}
          diffEntries={[
            {
              path: "file.txt",
              status: "M",
              diff: "diff --git a/file.txt b/file.txt\n@@ -1 +1 @@\n-old\n+new\n",
            },
          ]}
        />,
      );

      fireEvent.click(screen.getByLabelText("file.txt"));

      await waitFor(() => {
        const latestProps = mockEditableDiffReviewSurface.mock.lastCall?.[0];
        expect(typeof latestProps?.onRequestClose).toBe("function");
        expect(latestProps?.headerControlsTarget).toBeInstanceOf(HTMLDivElement);
      });

      fireEvent.click(screen.getByRole("button", { name: "Mock close preview" }));

      await waitFor(() => {
        expect(document.querySelector(".git-history-diff-modal")).toBeNull();
      });
    });

  it("uses the custom unsaved-changes dialog before closing a dirty preview", async () => {
      const confirmSpy = vi.spyOn(window, "confirm");
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

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(screen.getByRole("alertdialog", { name: "Unsaved changes" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
      expect(document.querySelector(".git-history-diff-modal")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Mock close preview" }));
      fireEvent.keyDown(document, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("alertdialog", { name: "Unsaved changes" })).toBeNull());
      expect(document.querySelector(".git-history-diff-modal")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Mock close preview" }));
      fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
      expect(mockPreviewDiscard).toHaveBeenCalledOnce();
      await waitFor(() => expect(document.querySelector(".git-history-diff-modal")).toBeNull());
    });
});
