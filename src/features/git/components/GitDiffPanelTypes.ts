import type {
  CommitMessageEngine,
  CommitMessageLanguage,
  CommitMessageRepositorySelection,
} from "../../../services/tauri";
import type {
  GitFileStatus,
  GitHubIssue,
  GitHubPullRequest,
  GitLogEntry,
} from "../../../types";
import type { CodeAnnotationBridgeProps } from "../../code-annotations/types";
import type { PanelTabId } from "../../layout/components/PanelTabs";
import type { RepositoryGitStatus } from "../hooks/useMultiRepositoryGitStatus";
import type { RepositoryCommitSelection } from "./GitMultiRepositoryChanges";
import type { FileHistoryTarget } from "@mossx/plugin-git-history/runtime";

export type GitModalPreviewRequest = {
  path: string;
  requestId: number;
  maximized?: boolean;
};

export type GitDiffPanelProps = CodeAnnotationBridgeProps & {
  workspaceId?: string | null;
  workspacePath?: string | null;
  headerControlsTarget?: HTMLElement | null;
  mode: "diff" | "log" | "issues" | "prs";
  onModeChange: (mode: "diff" | "log" | "issues" | "prs") => void;
  diffEntries?: {
    path: string;
    status: string;
    diff: string;
    isImage?: boolean;
    oldImageData?: string | null;
    newImageData?: string | null;
    oldImageMime?: string | null;
    newImageMime?: string | null;
  }[];
  gitDiffListView?: "flat" | "tree";
  onGitDiffListViewChange?: (view: "flat" | "tree") => void;
  toggleGitDiffListViewShortcut?: string | null;
  filePanelMode: PanelTabId;
  onFilePanelModeChange: (mode: PanelTabId) => void;
  onOpenGitHistoryPanel?: () => void;
  isGitHistoryOpen?: boolean;
  worktreeApplyLabel?: string;
  worktreeApplyTitle?: string | null;
  worktreeApplyLoading?: boolean;
  worktreeApplyError?: string | null;
  worktreeApplySuccess?: boolean;
  onApplyWorktreeChanges?: () => void | Promise<void>;
  onRevertAllChanges?: () => void | Promise<void>;
  branchName: string;
  totalAdditions: number;
  totalDeletions: number;
  fileStatus: string;
  diffViewStyle?: "split" | "unified";
  onDiffViewStyleChange?: (style: "split" | "unified") => void;
  error?: string | null;
  logError?: string | null;
  logLoading?: boolean;
  logTotal?: number;
  logAhead?: number;
  logBehind?: number;
  logAheadEntries?: GitLogEntry[];
  logBehindEntries?: GitLogEntry[];
  logUpstream?: string | null;
  issues?: GitHubIssue[];
  issuesTotal?: number;
  issuesLoading?: boolean;
  issuesError?: string | null;
  pullRequests?: GitHubPullRequest[];
  pullRequestsTotal?: number;
  pullRequestsLoading?: boolean;
  pullRequestsError?: string | null;
  selectedPullRequest?: number | null;
  onSelectPullRequest?: (pullRequest: GitHubPullRequest) => void;
  gitRemoteUrl?: string | null;
  gitRoot?: string | null;
  gitRootCandidates?: string[];
  gitRootScanDepth?: number;
  gitRootScanLoading?: boolean;
  gitRootScanError?: string | null;
  gitRootScanHasScanned?: boolean;
  onGitRootScanDepthChange?: (depth: number) => void;
  onScanGitRoots?: () => void;
  onSelectGitRoot?: (path: string) => void;
  onClearGitRoot?: () => void;
  onPickGitRoot?: () => void | Promise<void>;
  selectedPath?: string | null;
  onSelectFile?: (path: string | null, repositoryRoot?: string | null) => void;
  onOpenFile?: (path: string, repositoryRoot?: string | null) => void;
  onOpenFileHistory?: (target: FileHistoryTarget) => void;
  modalPreviewRequest?: GitModalPreviewRequest | null;
  stagedFiles: GitFileStatus[];
  unstagedFiles: GitFileStatus[];
  onStageAllChanges?: () => void | Promise<void>;
  onStageFile?: (path: string) => Promise<void> | void;
  onUnstageAllChanges?: () => void | Promise<void>;
  onUnstageFile?: (path: string) => Promise<void> | void;
  onUnstageFiles?: (paths: string[]) => Promise<void> | void;
  onRevertFile?: (path: string) => Promise<void> | void;
  onRevertFiles?: (paths: string[]) => Promise<void> | void;
  logEntries: GitLogEntry[];
  selectedCommitSha?: string | null;
  onSelectCommit?: (entry: GitLogEntry) => void;
  commitMessage?: string;
  commitMessageLoading?: boolean;
  commitMessageError?: string | null;
  onCommitMessageChange?: (value: string) => void;
  onGenerateCommitMessage?: (
    language?: CommitMessageLanguage,
    engine?: CommitMessageEngine,
    selectedPaths?: string[],
    repositorySelections?: CommitMessageRepositorySelection[],
  ) => void | Promise<void>;
  onCommit?: (selectedPaths?: string[]) => void | Promise<void>;
  onCommitAndPush?: (selectedPaths?: string[]) => void | Promise<void>;
  onCommitAndSync?: (selectedPaths?: string[]) => void | Promise<void>;
  onPush?: () => void | Promise<void>;
  onSync?: () => void | Promise<void>;
  commitLoading?: boolean;
  pushLoading?: boolean;
  syncLoading?: boolean;
  commitError?: string | null;
  pushError?: string | null;
  syncError?: string | null;
  commitsAhead?: number;
  onRefreshGitStatus?: () => void;
  onRefreshGitDiffs?: () => void;
  onRefreshGitLog?: () => void;
  multiRepositoryMode?: boolean;
  repositoryStatuses?: RepositoryGitStatus[];
  repositoryStatusesLoading?: boolean;
  onRefreshRepositoryStatuses?: () => Promise<void> | void;
  onStageRepositoryFile?: (repositoryRoot: string, path: string) => Promise<void>;
  onUnstageRepositoryFile?: (repositoryRoot: string, path: string) => Promise<void>;
  onUnstageRepositoryAll?: (repositoryRoot: string) => Promise<void>;
  onUnstageRepositoryFiles?: (repositoryRoot: string, paths: string[]) => Promise<void>;
  onRevertRepositoryFile?: (repositoryRoot: string, path: string) => Promise<void>;
  onRevertRepositoryFiles?: (repositoryRoot: string, paths: string[]) => Promise<void>;
  onStageRepositoryAll?: (repositoryRoot: string) => Promise<void>;
  onCommitRepositories?: (selections: RepositoryCommitSelection[]) => Promise<void> | void;
  repositoryCommitSummary?: string | null;
};
