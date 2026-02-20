import { ask } from "@tauri-apps/plugin-dialog";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import Download from "lucide-react/dist/esm/icons/download";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Cloud from "lucide-react/dist/esm/icons/cloud";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Folder from "lucide-react/dist/esm/icons/folder";
import FolderOpen from "lucide-react/dist/esm/icons/folder-open";
import FolderTree from "lucide-react/dist/esm/icons/folder-tree";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import GitCommit from "lucide-react/dist/esm/icons/git-commit-horizontal";
import GitMerge from "lucide-react/dist/esm/icons/git-merge";
import HardDrive from "lucide-react/dist/esm/icons/hard-drive";
import LayoutGrid from "lucide-react/dist/esm/icons/layout-grid";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Plus from "lucide-react/dist/esm/icons/plus";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Repeat from "lucide-react/dist/esm/icons/repeat";
import Search from "lucide-react/dist/esm/icons/search";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Upload from "lucide-react/dist/esm/icons/upload";
import X from "lucide-react/dist/esm/icons/x";
import type {
  GitBranchListItem,
  GitCommitDiff,
  GitCommitDetails,
  GitCommitFileChange,
  GitHistoryCommit,
  WorkspaceInfo,
} from "../../../types";
import {
  checkoutGitBranch,
  cherryPickCommit,
  createGitBranchFromBranch,
  createGitBranchFromCommit,
  deleteGitBranch,
  fetchGit,
  getGitBranchCompareCommits,
  getGitStatus,
  getGitWorktreeDiffFileAgainstBranch,
  getGitWorktreeDiffAgainstBranch,
  getGitCommitDetails,
  getGitCommitHistory,
  listGitRoots,
  listGitBranches,
  mergeGitBranch,
  pullGit,
  pushGit,
  renameGitBranch,
  rebaseGitBranch,
  resolveGitCommitRef,
  revertCommit,
  syncGit,
} from "../../../services/tauri";
import { getClientStoreSync, writeClientStoreValue } from "../../../services/clientStorage";
import { GitDiffViewer } from "../../git/components/GitDiffViewer";
import { GitHistoryWorktreePanel } from "./GitHistoryWorktreePanel";
import { isWorkingTreeDirtyBlockingError, localizeGitErrorMessage } from "../gitErrorI18n";

type GitHistoryPanelProps = {
  workspace: WorkspaceInfo | null;
  workspaces?: WorkspaceInfo[];
  groupedWorkspaces?: Array<{
    id: string | null;
    name: string;
    workspaces: WorkspaceInfo[];
  }>;
  onSelectWorkspace?: (workspaceId: string) => void;
  onSelectWorkspacePath?: (path: string) => Promise<void> | void;
  onOpenDiffPath?: (path: string) => void;
  onRequestClose?: () => void;
};

type ActionSurfaceProps = {
  className?: string;
  children: ReactNode;
  disabled?: boolean;
  active?: boolean;
  onActivate?: () => void;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
  title?: string;
  ariaLabel?: string;
  style?: CSSProperties;
};

type BranchGroup = {
  key: string;
  label: string;
  items: GitBranchListItem[];
};

type FileTreeNode = {
  name: string;
  path: string;
  dirs: Map<string, FileTreeNode>;
  files: GitCommitFileChange[];
};

type FileTreeItem =
  | {
      id: string;
      type: "dir";
      label: string;
      path: string;
      depth: number;
      expanded: boolean;
    }
  | {
      id: string;
      type: "file";
      label: string;
      path: string;
      depth: number;
      change: GitCommitFileChange;
    };

type GitHistoryPanelPersistedState = {
  overviewWidth?: number;
  branchesWidth?: number;
  commitsWidth?: number;
  detailsSplitRatio?: number;
  selectedBranch?: string;
  commitQuery?: string;
  selectedCommitSha?: string | null;
  diffStyle?: "split" | "unified";
};

type GitOperationErrorState = {
  userMessage: string;
  debugMessage: string;
  retryable: boolean;
};

type GitOperationNoticeState = {
  kind: "success" | "error";
  message: string;
  debugMessage?: string;
};

type BranchMenuSource = "local" | "remote";

type BranchContextMenuState = {
  x: number;
  y: number;
  branch: GitBranchListItem;
  source: BranchMenuSource;
};

type BranchContextAction = {
  id: string;
  label: string;
  icon: ReactNode;
  tone?: "normal" | "danger";
  disabled?: boolean;
  disabledReason?: string | null;
  dividerBefore?: boolean;
  onSelect: () => void;
};

type WorktreeBranchDiffState = {
  mode: "worktree";
  branch: string;
  compareBranch: string;
  files: Pick<GitCommitDiff, "path" | "status">[];
  selectedPath: string | null;
  loading: boolean;
  error: string | null;
  selectedDiff: GitCommitDiff | null;
  selectedDiffLoading: boolean;
  selectedDiffError: string | null;
};

type BranchCompareDirection = "targetOnly" | "currentOnly";

type BranchCompareState = {
  mode: "branch";
  branch: string;
  compareBranch: string;
  targetOnlyCommits: GitHistoryCommit[];
  currentOnlyCommits: GitHistoryCommit[];
  loading: boolean;
  error: string | null;
  selectedDirection: BranchCompareDirection | null;
  selectedCommitSha: string | null;
  selectedCommitDetails: GitCommitDetails | null;
  selectedCommitLoading: boolean;
  selectedCommitError: string | null;
};

type BranchDiffState = WorktreeBranchDiffState | BranchCompareState;

const PAGE_SIZE = 100;
const DEFAULT_DETAILS_SPLIT = 42;
const DETAILS_SPLIT_MIN = 24;
const DETAILS_SPLIT_MAX = 78;
const COMPACT_LAYOUT_BREAKPOINT = 1120;
const VERTICAL_SPLITTER_SIZE = 8;
const OVERVIEW_MIN_WIDTH = 170;
const BRANCHES_MIN_WIDTH = 220;
const COMMITS_MIN_WIDTH = 260;
const DETAILS_MIN_WIDTH = 260;
const DISABLE_HISTORY_ACTION_BUTTONS = false;
const DISABLE_HISTORY_COMMIT_ACTIONS = true;
const DISABLE_HISTORY_BRANCH_RENAME = true;
const COMMIT_ROW_ESTIMATED_HEIGHT = 56;
const SORT_ORDER_FALLBACK = Number.MAX_SAFE_INTEGER;

function getSortOrderValue(value: number | null | undefined) {
  return typeof value === "number" ? value : SORT_ORDER_FALLBACK;
}

function isActivationKey(event: KeyboardEvent<HTMLElement>): boolean {
  return event.key === "Enter" || event.key === " ";
}

function clamp(value: number, min: number, max: number): number {
  if (max <= min) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

export function getDefaultColumnWidths(containerWidth: number): {
  overviewWidth: number;
  branchesWidth: number;
  commitsWidth: number;
} {
  const safeWidth = Number.isFinite(containerWidth) && containerWidth > 0 ? containerWidth : 1600;
  const splitterTotalWidth = VERTICAL_SPLITTER_SIZE * 3;
  const minimumColumnsWidth =
    OVERVIEW_MIN_WIDTH + BRANCHES_MIN_WIDTH + COMMITS_MIN_WIDTH + DETAILS_MIN_WIDTH;
  const availableColumnsWidth = Math.max(
    minimumColumnsWidth,
    safeWidth - splitterTotalWidth,
  );

  let overviewWidth = Math.round((availableColumnsWidth * 3) / 10);
  let branchesWidth = Math.round((availableColumnsWidth * 2) / 10);
  let commitsWidth = Math.round((availableColumnsWidth * 3) / 10);
  let detailsWidth = availableColumnsWidth - overviewWidth - branchesWidth - commitsWidth;

  const columns = [overviewWidth, branchesWidth, commitsWidth, detailsWidth];
  const minimums = [
    OVERVIEW_MIN_WIDTH,
    BRANCHES_MIN_WIDTH,
    COMMITS_MIN_WIDTH,
    DETAILS_MIN_WIDTH,
  ];

  let deficit = 0;
  for (let index = 0; index < columns.length; index += 1) {
    if (columns[index] < minimums[index]) {
      deficit += minimums[index] - columns[index];
      columns[index] = minimums[index];
    }
  }

  if (deficit > 0) {
    const shrinkOrder = [2, 0, 1, 3];
    for (const index of shrinkOrder) {
      if (deficit <= 0) {
        break;
      }
      const spare = columns[index] - minimums[index];
      if (spare <= 0) {
        continue;
      }
      const take = Math.min(spare, deficit);
      columns[index] -= take;
      deficit -= take;
    }
  }

  [overviewWidth, branchesWidth, commitsWidth, detailsWidth] = columns;
  return { overviewWidth, branchesWidth, commitsWidth };
}

function isRepositoryUnavailableError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const normalized = message.toLowerCase();
  return (
    normalized.includes("could not find repository") ||
    normalized.includes("not a git repository") ||
    normalized.includes("codenotfound") ||
    normalized.includes("class=repository")
  );
}

function formatRelativeTime(
  timestampSec: number,
  translate: (key: string, options?: Record<string, unknown>) => string,
): string {
  const now = Date.now();
  const target = timestampSec * 1000;
  const delta = Math.floor((now - target) / 1000);
  if (delta < 60) return translate("git.historyTimeJustNow");
  if (delta < 3600) {
    return translate("git.historyTimeMinutesAgo", { count: Math.floor(delta / 60) });
  }
  if (delta < 86400) {
    return translate("git.historyTimeHoursAgo", { count: Math.floor(delta / 3600) });
  }
  if (delta < 604800) {
    return translate("git.historyTimeDaysAgo", { count: Math.floor(delta / 86400) });
  }
  return new Date(target).toLocaleDateString();
}

function statusLabel(change: GitCommitFileChange): string {
  const oldPath = change.oldPath?.trim();
  if (change.status === "R" && oldPath && oldPath !== change.path) {
    return `${oldPath} -> ${change.path}`;
  }
  return change.path;
}

function buildFileKey(change: GitCommitFileChange): string {
  return `${change.path}::${change.status}::${change.oldPath ?? ""}`;
}

function collectDirPaths(files: GitCommitFileChange[]): Set<string> {
  const paths = new Set<string>();
  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let current = "";
    for (let index = 0; index < parts.length - 1; index += 1) {
      current = current ? `${current}/${parts[index]}` : parts[index];
      paths.add(current);
    }
  }
  return paths;
}

function pickSelectedFileKey(
  previousKey: string | null,
  files: GitCommitFileChange[],
): string | null {
  if (!files.length) {
    return null;
  }
  if (previousKey) {
    const exists = files.some((entry) => buildFileKey(entry) === previousKey);
    if (exists) {
      return previousKey;
    }
  }
  return buildFileKey(files[0]);
}

export function buildFileTreeItems(
  files: GitCommitFileChange[],
  expandedDirs: Set<string>,
): FileTreeItem[] {
  const root: FileTreeNode = {
    name: "",
    path: "",
    dirs: new Map<string, FileTreeNode>(),
    files: [],
  };

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    if (!parts.length) {
      root.files.push(file);
      continue;
    }

    let node = root;
    let currentPath = "";
    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let child = node.dirs.get(part);
      if (!child) {
        child = {
          name: part,
          path: currentPath,
          dirs: new Map<string, FileTreeNode>(),
          files: [],
        };
        node.dirs.set(part, child);
      }
      node = child;
    }
    node.files.push(file);
  }

  const items: FileTreeItem[] = [];

  const collapseDirChain = (
    start: FileTreeNode,
  ): { node: FileTreeNode; label: string; path: string } => {
    let node = start;
    const labels = [start.name];
    let path = start.path;

    while (node.files.length === 0 && node.dirs.size === 1) {
      const next = Array.from(node.dirs.values())[0];
      labels.push(next.name);
      node = next;
      path = node.path;
    }

    return {
      node,
      label: labels.join("."),
      path,
    };
  };

  const walk = (node: FileTreeNode, depth: number) => {
    const dirs = Array.from(node.dirs.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const dir of dirs) {
      const collapsed = collapseDirChain(dir);
      const expanded = expandedDirs.has(collapsed.path);
      items.push({
        id: `dir:${collapsed.path}`,
        type: "dir",
        label: collapsed.label,
        path: collapsed.path,
        depth,
        expanded,
      });
      if (expanded) {
        walk(collapsed.node, depth + 1);
      }
    }

    const leafFiles = node.files.slice().sort((a, b) =>
      a.path.localeCompare(b.path),
    );
    for (const file of leafFiles) {
      const segments = file.path.split("/").filter(Boolean);
      const label = segments[segments.length - 1] ?? file.path;
      items.push({
        id: `file:${buildFileKey(file)}`,
        type: "file",
        label,
        path: file.path,
        depth,
        change: file,
      });
    }
  };

  walk(root, 0);
  return items;
}

function getBranchScope(name: string): string {
  const slashIndex = name.indexOf("/");
  if (slashIndex <= 0) {
    return "__root__";
  }
  return name.slice(0, slashIndex);
}

function getBranchLeafName(name: string): string {
  const slashIndex = name.indexOf("/");
  if (slashIndex <= 0) {
    return name;
  }
  return name.slice(slashIndex + 1);
}

function trimRemotePrefix(name: string, remote: string): string {
  const prefix = `${remote}/`;
  if (!name.startsWith(prefix)) {
    return name;
  }
  return name.slice(prefix.length);
}

function getSpecialBranchBadges(
  branchName: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string[] {
  const normalized = getBranchLeafName(branchName).toLowerCase();
  const badges: string[] = [];
  if (normalized === "main" || normalized === "master") {
    badges.push(t("git.historyBranchBadgeMain"));
  }
  if (normalized === "zh") {
    badges.push(t("git.historyBranchBadgeZh"));
  }
  return badges;
}

function ActionSurface({
  className,
  children,
  disabled,
  active,
  onActivate,
  onContextMenu,
  title,
  ariaLabel,
  style,
}: ActionSurfaceProps) {
  const mergedClassName = [
    "git-history-action",
    className,
    active ? "is-active" : "",
    disabled ? "is-disabled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      className={mergedClassName}
      title={title}
      style={style}
      onClick={() => {
        if (!disabled) {
          onActivate?.();
        }
      }}
      onKeyDown={(event) => {
        if (disabled || !onActivate) {
          return;
        }
        if (isActivationKey(event)) {
          event.preventDefault();
          onActivate();
        }
      }}
      onContextMenu={onContextMenu}
    >
      {children}
    </div>
  );
}

type GitHistoryPickerOption = {
  id: string;
  label: string;
  kind?: "main" | "worktree";
  parentLabel?: string | null;
};

type GitHistoryPickerSection = {
  id: string | null;
  name: string;
  options: GitHistoryPickerOption[];
};

type GitHistoryProjectPickerProps = {
  sections: GitHistoryPickerSection[];
  selectedId: string | null;
  selectedLabel: string;
  ariaLabel: string;
  searchPlaceholder: string;
  emptyText: string;
  icon?: ReactNode;
  disabled?: boolean;
  onSelect: (id: string) => void;
};

function GitHistoryProjectPicker({
  sections,
  selectedId,
  selectedLabel,
  ariaLabel,
  searchPlaceholder,
  emptyText,
  icon = <GitBranch size={13} />,
  disabled = false,
  onSelect,
}: GitHistoryProjectPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filteredSections = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return sections;
    }
    return sections
      .map((section) => ({
        ...section,
        options: section.options.filter((entry) => entry.label.toLowerCase().includes(keyword)),
      }))
      .filter((section) => section.options.length > 0);
  }, [query, sections]);
  const showGroupLabel = useMemo(
    () =>
      filteredSections.length > 1
      && filteredSections.some((section) => section.name.trim().length > 0),
    [filteredSections],
  );

  useEffect(() => {
    if (disabled && open) {
      setOpen(false);
      setQuery("");
    }
  }, [disabled, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (!pickerRef.current?.contains(target)) {
        setOpen(false);
        setQuery("");
      }
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const handleSelect = useCallback(
    (id: string) => {
      if (id && id !== selectedId) {
        onSelect(id);
      }
      setOpen(false);
      setQuery("");
    },
    [onSelect, selectedId],
  );

  return (
    <div
      className={`git-history-project-picker${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}`}
      ref={pickerRef}
    >
      <button
        type="button"
        className="git-history-project-display git-history-project-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return;
          }
          setOpen((prev) => !prev);
        }}
      >
        {icon}
        <span className="git-history-project-value">{selectedLabel}</span>
        <ChevronDown size={12} className="git-history-project-caret" />
      </button>

      {open && (
        <div className="git-history-project-dropdown popover-surface" role="listbox" aria-label={ariaLabel}>
          <div className="git-history-project-search">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
          </div>
          <div className="git-history-project-list">
            {filteredSections.map((section) => (
              <div key={section.id ?? "ungrouped"} className="git-history-project-group">
                {showGroupLabel && section.name.trim().length > 0 ? (
                  <div className="git-history-project-group-label">{section.name}</div>
                ) : null}
                {section.options.map((entry) => {
                  const selected = entry.id === selectedId;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className={`git-history-project-item${selected ? " is-active" : ""}`}
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleSelect(entry.id)}
                    >
                      <span className="git-history-project-item-check" aria-hidden>
                        {selected ? "✓" : ""}
                      </span>
                      <span
                        className={`git-history-project-item-label${
                          entry.kind === "worktree" ? " is-worktree" : ""
                        }`}
                      >
                        {entry.kind === "worktree" ? "↳ " : ""}
                        {entry.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
            {filteredSections.length === 0 && (
              <div className="git-history-project-empty">{emptyText}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function GitHistoryPanel({
  workspace,
  workspaces = [],
  groupedWorkspaces = [],
  onSelectWorkspace,
  onSelectWorkspacePath,
  onOpenDiffPath,
  onRequestClose,
}: GitHistoryPanelProps) {
  const { t } = useTranslation();
  const workspaceId = workspace?.id ?? null;
  const persistenceKey = useMemo(
    () => `gitHistoryPanel:${workspaceId ?? "default"}`,
    [workspaceId],
  );
  const persistedPanelState = useMemo(
    () => getClientStoreSync<GitHistoryPanelPersistedState>("layout", persistenceKey) ?? {},
    [persistenceKey],
  );
  const workbenchGridRef = useRef<HTMLDivElement | null>(null);
  const mainGridRef = useRef<HTMLDivElement | null>(null);
  const detailsBodyRef = useRef<HTMLDivElement | null>(null);
  const commitListRef = useRef<HTMLDivElement | null>(null);
  const historySnapshotIdRef = useRef<string | null>(null);
  const createBranchNameInputRef = useRef<HTMLInputElement | null>(null);
  const initialColumnWidths = useMemo(
    () =>
      getDefaultColumnWidths(
        typeof window !== "undefined" ? window.innerWidth : 1600,
      ),
    [],
  );

  const [localBranches, setLocalBranches] = useState<GitBranchListItem[]>([]);
  const [remoteBranches, setRemoteBranches] = useState<GitBranchListItem[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>(
    () => persistedPanelState.selectedBranch ?? "all",
  );
  const [branchQuery, setBranchQuery] = useState("");
  const [commitQuery, setCommitQuery] = useState(
    () => persistedPanelState.commitQuery ?? "",
  );
  const [localSectionExpanded, setLocalSectionExpanded] = useState(true);
  const [remoteSectionExpanded, setRemoteSectionExpanded] = useState(true);
  const [expandedLocalScopes, setExpandedLocalScopes] = useState<Set<string>>(new Set());
  const [expandedRemoteScopes, setExpandedRemoteScopes] = useState<Set<string>>(new Set());
  const [overviewListView, setOverviewListView] = useState<"flat" | "tree">("flat");
  const [workingTreeChangedFiles, setWorkingTreeChangedFiles] = useState(0);
  const [workingTreeTotalAdditions, setWorkingTreeTotalAdditions] = useState(0);
  const [workingTreeTotalDeletions, setWorkingTreeTotalDeletions] = useState(0);
  const [, setWorkingTreeStatusError] = useState<string | null>(null);

  const [commits, setCommits] = useState<GitHistoryCommit[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(
    () => persistedPanelState.selectedCommitSha ?? null,
  );
  const [details, setDetails] = useState<GitCommitDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [selectedFileKey, setSelectedFileKey] = useState<string | null>(null);
  const [previewFileKey, setPreviewFileKey] = useState<string | null>(null);
  const [comparePreviewFileKey, setComparePreviewFileKey] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  const [detailsSplitRatio, setDetailsSplitRatio] = useState(() =>
    clamp(
      persistedPanelState.detailsSplitRatio ?? DEFAULT_DETAILS_SPLIT,
      DETAILS_SPLIT_MIN,
      DETAILS_SPLIT_MAX,
    ),
  );
  const [overviewWidth, setOverviewWidth] = useState(
    () => persistedPanelState.overviewWidth ?? initialColumnWidths.overviewWidth,
  );
  const [branchesWidth, setBranchesWidth] = useState(
    () => persistedPanelState.branchesWidth ?? initialColumnWidths.branchesWidth,
  );
  const [commitsWidth, setCommitsWidth] = useState(
    () => persistedPanelState.commitsWidth ?? initialColumnWidths.commitsWidth,
  );
  const [diffViewMode, setDiffViewMode] = useState<"split" | "unified">(
    () => persistedPanelState.diffStyle ?? "split",
  );
  const [desktopSplitLayout, setDesktopSplitLayout] = useState(() =>
    typeof window !== "undefined"
      ? window.innerWidth > COMPACT_LAYOUT_BREAKPOINT
      : true,
  );

  const [operationLoading, setOperationLoading] = useState<string | null>(null);
  const [operationNotice, setOperationNotice] = useState<GitOperationNoticeState | null>(null);
  const operationNoticeTimerRef = useRef<number | null>(null);
  const branchContextMenuRef = useRef<HTMLDivElement | null>(null);
  const [createBranchDialogOpen, setCreateBranchDialogOpen] = useState(false);
  const [createBranchSource, setCreateBranchSource] = useState("");
  const [createBranchName, setCreateBranchName] = useState("");
  const [branchContextMenu, setBranchContextMenu] = useState<BranchContextMenuState | null>(null);
  const [branchDiffState, setBranchDiffState] = useState<BranchDiffState | null>(null);
  const branchDiffCacheRef = useRef<Map<string, GitCommitDiff>>(new Map());
  const branchCompareDetailsCacheRef = useRef<Map<string, GitCommitDetails>>(new Map());
  const [repositoryUnavailable, setRepositoryUnavailable] = useState(false);
  const [fallbackGitRoots, setFallbackGitRoots] = useState<string[]>([]);
  const [fallbackGitRootsLoading, setFallbackGitRootsLoading] = useState(false);
  const [fallbackGitRootsError, setFallbackGitRootsError] = useState<string | null>(null);
  const [fallbackSelectingRoot, setFallbackSelectingRoot] = useState<string | null>(null);
  const [workspaceSelectingId, setWorkspaceSelectingId] = useState<string | null>(null);

  const closeBranchContextMenu = useCallback(() => {
    setBranchContextMenu(null);
  }, []);

  const closeBranchDiff = useCallback(() => {
    setBranchDiffState(null);
    setComparePreviewFileKey(null);
  }, []);

  const handleOpenBranchContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>, branch: GitBranchListItem, source: BranchMenuSource) => {
      event.preventDefault();
      event.stopPropagation();
      setSelectedBranch(branch.name);
      setBranchContextMenu({
        x: event.clientX,
        y: event.clientY,
        branch,
        source,
      });
    },
    [],
  );

  const applyHistorySnapshotId = useCallback((snapshotId: string | null) => {
    historySnapshotIdRef.current = snapshotId;
  }, []);

  const resolveGitRootPath = useCallback((workspacePath: string, relativeRoot: string) => {
    const useBackslash = workspacePath.includes("\\") && !workspacePath.includes("/");
    const separator = useBackslash ? "\\" : "/";
    const normalizedRelative = relativeRoot.split("/").join(separator);
    if (workspacePath.endsWith("/") || workspacePath.endsWith("\\")) {
      return `${workspacePath}${normalizedRelative}`;
    }
    return `${workspacePath}${separator}${normalizedRelative}`;
  }, []);

  const clearCommitAndDetailColumns = useCallback(() => {
    setCommits([]);
    setHistoryTotal(0);
    setHistoryHasMore(false);
    applyHistorySnapshotId(null);
    setSelectedCommitSha(null);
    setDetails(null);
    setDetailsError(null);
    setSelectedFileKey(null);
    setPreviewFileKey(null);
    setExpandedDirs(new Set());
  }, [applyHistorySnapshotId]);

  const clearHistoryColumns = useCallback(() => {
    setLocalBranches([]);
    setRemoteBranches([]);
    setCurrentBranch(null);
    setSelectedBranch("all");
    clearCommitAndDetailColumns();
  }, [clearCommitAndDetailColumns]);

  const refreshBranches = useCallback(async () => {
    if (!workspaceId) {
      setLocalBranches([]);
      setRemoteBranches([]);
      setCurrentBranch(null);
      return;
    }
    try {
      const response = await listGitBranches(workspaceId);
      const local = response.localBranches ?? [];
      const remote = response.remoteBranches ?? [];
      setLocalBranches(local);
      setRemoteBranches(remote);
      setCurrentBranch(response.currentBranch ?? null);
      setSelectedBranch((prev) => {
        if (prev === "all") {
          return prev;
        }
        const existsLocal = local.some((entry) => entry.name === prev);
        const existsRemote = remote.some((entry) => entry.name === prev);
        if (existsLocal || existsRemote) {
          return prev;
        }
        return response.currentBranch ?? "all";
      });
      setRepositoryUnavailable(false);
    } catch (error) {
      if (isRepositoryUnavailableError(error)) {
        setRepositoryUnavailable(true);
        clearHistoryColumns();
      }
    }
  }, [workspaceId, clearHistoryColumns]);

  const refreshWorkingTreeStatus = useCallback(async () => {
    if (!workspaceId) {
      setWorkingTreeChangedFiles(0);
      setWorkingTreeTotalAdditions(0);
      setWorkingTreeTotalDeletions(0);
      setWorkingTreeStatusError(null);
      return;
    }
    try {
      const status = await getGitStatus(workspaceId);
      setWorkingTreeChangedFiles(status.files.length);
      setWorkingTreeTotalAdditions(status.totalAdditions);
      setWorkingTreeTotalDeletions(status.totalDeletions);
      setWorkingTreeStatusError(null);
      setRepositoryUnavailable(false);
    } catch (error) {
      setWorkingTreeChangedFiles(0);
      setWorkingTreeTotalAdditions(0);
      setWorkingTreeTotalDeletions(0);
      if (isRepositoryUnavailableError(error)) {
        setRepositoryUnavailable(true);
      }
      setWorkingTreeStatusError(error instanceof Error ? error.message : String(error));
    }
  }, [workspaceId]);

  const loadHistory = useCallback(
    async (append: boolean, startOffset?: number) => {
      if (!workspaceId) {
        setCommits([]);
        setHistoryTotal(0);
        setHistoryHasMore(false);
        applyHistorySnapshotId(null);
        setHistoryError(null);
        return;
      }

      if (append) {
        setHistoryLoadingMore(true);
      } else {
        setHistoryLoading(true);
      }
      setHistoryError(null);

      try {
        const offset = append ? startOffset ?? 0 : 0;
        const response = await getGitCommitHistory(workspaceId, {
          branch: selectedBranch === "all" ? "all" : selectedBranch,
          query: commitQuery.trim() || null,
          snapshotId: append ? historySnapshotIdRef.current : null,
          offset,
          limit: PAGE_SIZE,
        });

        setHistoryTotal(response.total);
        setHistoryHasMore(response.hasMore);
        applyHistorySnapshotId(response.snapshotId);
        setCommits((prev) => {
          if (!append) {
            return response.commits;
          }
          const seen = new Set(prev.map((item) => item.sha));
          const merged = [...prev];
          for (const commit of response.commits) {
            if (!seen.has(commit.sha)) {
              merged.push(commit);
              seen.add(commit.sha);
            }
          }
          return merged;
        });
        setRepositoryUnavailable(false);
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : String(error);
        const isSnapshotExpired = rawMessage.toLowerCase().includes("snapshot expired");
        if (append && isSnapshotExpired) {
          try {
            const refreshed = await getGitCommitHistory(workspaceId, {
              branch: selectedBranch === "all" ? "all" : selectedBranch,
              query: commitQuery.trim() || null,
              snapshotId: null,
              offset: 0,
              limit: PAGE_SIZE,
            });
            setHistoryTotal(refreshed.total);
            setHistoryHasMore(refreshed.hasMore);
            applyHistorySnapshotId(refreshed.snapshotId);
            setCommits(refreshed.commits);
            setHistoryError(null);
            return;
          } catch (refreshError) {
            setHistoryError(
              refreshError instanceof Error ? refreshError.message : String(refreshError),
            );
            return;
          }
        }
        if (isRepositoryUnavailableError(error)) {
          setRepositoryUnavailable(true);
        }
        if (!append) {
          clearCommitAndDetailColumns();
        }
        setHistoryError(rawMessage);
      } finally {
        setHistoryLoading(false);
        setHistoryLoadingMore(false);
      }
    },
    [
      workspaceId,
      selectedBranch,
      commitQuery,
      applyHistorySnapshotId,
      clearCommitAndDetailColumns,
    ],
  );

  const refreshAll = useCallback(async () => {
    await refreshBranches();
    await refreshWorkingTreeStatus();
    await loadHistory(false, 0);

    if (selectedCommitSha && workspaceId) {
      try {
        const commitDetails = await getGitCommitDetails(workspaceId, selectedCommitSha);
        setDetails(commitDetails);
        setExpandedDirs(collectDirPaths(commitDetails.files));
        setDetailsError(null);
        setSelectedFileKey((previous) =>
          pickSelectedFileKey(previous, commitDetails.files),
        );
        setPreviewFileKey(null);
      } catch (error) {
        if (isRepositoryUnavailableError(error)) {
          setRepositoryUnavailable(true);
          clearHistoryColumns();
        }
        setDetails(null);
        setSelectedFileKey(null);
        setPreviewFileKey(null);
        setDetailsError(error instanceof Error ? error.message : String(error));
      }
    }
  }, [
    clearHistoryColumns,
    loadHistory,
    refreshBranches,
    refreshWorkingTreeStatus,
    selectedCommitSha,
    workspaceId,
  ]);

  useEffect(() => {
    setRepositoryUnavailable(false);
    setSelectedBranch(persistedPanelState.selectedBranch ?? "all");
    setSelectedCommitSha(persistedPanelState.selectedCommitSha ?? null);
    setDetails(null);
    setSelectedFileKey(null);
    setPreviewFileKey(null);
    setExpandedDirs(new Set());
    setCommitQuery(persistedPanelState.commitQuery ?? "");
    applyHistorySnapshotId(null);
    setCreateBranchDialogOpen(false);
    setCreateBranchSource("");
    setCreateBranchName("");
    if (!workspaceId) {
      setCommits([]);
      setHistoryTotal(0);
      setHistoryHasMore(false);
      setHistoryError(null);
      setWorkingTreeChangedFiles(0);
      setWorkingTreeTotalAdditions(0);
      setWorkingTreeTotalDeletions(0);
      setWorkingTreeStatusError(null);
      return;
    }
    void (async () => {
      await refreshBranches();
      await refreshWorkingTreeStatus();
    })();
  }, [
    workspaceId,
    refreshBranches,
    refreshWorkingTreeStatus,
    applyHistorySnapshotId,
    persistedPanelState.commitQuery,
    persistedPanelState.selectedBranch,
    persistedPanelState.selectedCommitSha,
  ]);

  useEffect(() => {
    if (!workspaceId) {
      return;
    }
    void loadHistory(false, 0);
  }, [workspaceId, selectedBranch, commitQuery, loadHistory]);

  useEffect(() => {
    if (!workspaceId || !selectedCommitSha) {
      setDetails(null);
      setSelectedFileKey(null);
      setPreviewFileKey(null);
      setExpandedDirs(new Set());
      setDetailsError(null);
      return;
    }

    let cancelled = false;
    setDetailsLoading(true);
    setDetailsError(null);

    void getGitCommitDetails(workspaceId, selectedCommitSha)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setDetails(response);
        setExpandedDirs(collectDirPaths(response.files));
        setSelectedFileKey((previous) => pickSelectedFileKey(previous, response.files));
        setPreviewFileKey(null);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        if (isRepositoryUnavailableError(error)) {
          setRepositoryUnavailable(true);
          clearHistoryColumns();
        }
        setDetails(null);
        setExpandedDirs(new Set());
        setSelectedFileKey(null);
        setPreviewFileKey(null);
        setDetailsError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) {
          setDetailsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCommitSha, workspaceId, clearHistoryColumns]);

  const filteredLocalBranches = useMemo(() => {
    const needle = branchQuery.trim().toLowerCase();
    if (!needle) {
      return localBranches;
    }
    return localBranches.filter((entry) => entry.name.toLowerCase().includes(needle));
  }, [branchQuery, localBranches]);

  const filteredRemoteBranches = useMemo(() => {
    const needle = branchQuery.trim().toLowerCase();
    if (!needle) {
      return remoteBranches;
    }
    return remoteBranches.filter((entry) => entry.name.toLowerCase().includes(needle));
  }, [branchQuery, remoteBranches]);

  const groupedRemoteBranches = useMemo(() => {
    const groups = new Map<string, GitBranchListItem[]>();
    for (const entry of filteredRemoteBranches) {
      const group = entry.remote ?? entry.name.split("/")[0] ?? "remote";
      const existing = groups.get(group) ?? [];
      existing.push(entry);
      groups.set(group, existing);
    }
    return Array.from(groups.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([remote, items]) => ({
        remote,
        items: items.slice().sort((left, right) => left.name.localeCompare(right.name)),
      }));
  }, [filteredRemoteBranches]);

  const groupedLocalBranches = useMemo<BranchGroup[]>(() => {
    const groups = new Map<string, GitBranchListItem[]>();
    for (const entry of filteredLocalBranches) {
      const scope = getBranchScope(entry.name);
      const items = groups.get(scope) ?? [];
      items.push(entry);
      groups.set(scope, items);
    }
    return Array.from(groups.entries())
      .sort(([left], [right]) => {
        if (left === "__root__") {
          return -1;
        }
        if (right === "__root__") {
          return 1;
        }
        return left.localeCompare(right);
      })
      .map(([key, items]) => ({
        key,
        label: key === "__root__" ? t("git.historyRootGroup") : key.toUpperCase(),
        items: items.slice().sort((left, right) => left.name.localeCompare(right.name)),
      }));
  }, [filteredLocalBranches, t]);

  const createBranchSourceOptions = useMemo(() => {
    const names = new Set(localBranches.map((entry) => entry.name));
    for (const entry of remoteBranches) {
      names.add(entry.name);
    }
    if (currentBranch) {
      names.add(currentBranch);
    }
    return Array.from(names).sort((left, right) => left.localeCompare(right));
  }, [currentBranch, localBranches, remoteBranches]);

  useEffect(() => {
    if (branchQuery.trim()) {
      setLocalSectionExpanded(true);
      setRemoteSectionExpanded(true);
    }
  }, [branchQuery]);

  useEffect(() => {
    setExpandedLocalScopes((prev) => {
      const next = new Set<string>();
      const activeScope = currentBranch ? getBranchScope(currentBranch) : null;
      const searching = branchQuery.trim().length > 0;
      for (const group of groupedLocalBranches) {
        if (searching || prev.has(group.key) || group.key === "__root__" || group.key === activeScope) {
          next.add(group.key);
        }
      }
      return next;
    });
  }, [branchQuery, currentBranch, groupedLocalBranches]);

  useEffect(() => {
    setExpandedRemoteScopes((prev) => {
      const next = new Set<string>();
      const searching = branchQuery.trim().length > 0;
      for (const group of groupedRemoteBranches) {
        if (searching || prev.has(group.remote)) {
          next.add(group.remote);
        }
      }
      return next;
    });
  }, [branchQuery, groupedRemoteBranches]);

  useEffect(() => {
    if (!createBranchDialogOpen) {
      return;
    }
    createBranchNameInputRef.current?.focus();
  }, [createBranchDialogOpen]);

  useEffect(() => {
    setBranchDiffState(null);
    branchDiffCacheRef.current.clear();
    branchCompareDetailsCacheRef.current.clear();
    setComparePreviewFileKey(null);
  }, [workspaceId]);

  useEffect(() => {
    if (createBranchDialogOpen && branchContextMenu) {
      closeBranchContextMenu();
    }
  }, [branchContextMenu, closeBranchContextMenu, createBranchDialogOpen]);

  useEffect(() => {
    if (!branchContextMenu) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (!branchContextMenuRef.current?.contains(target)) {
        closeBranchContextMenu();
      }
    };
    const handleWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeBranchContextMenu();
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [branchContextMenu, closeBranchContextMenu]);

  const fileTreeItems = useMemo(() => {
    if (!details) {
      return [];
    }
    return buildFileTreeItems(details.files, expandedDirs);
  }, [details, expandedDirs]);

  const previewDetailFile = useMemo(() => {
    if (!details || !previewFileKey) {
      return null;
    }
    return details.files.find((entry) => buildFileKey(entry) === previewFileKey) ?? null;
  }, [details, previewFileKey]);

  const previewDetailFileDiff = useMemo(() => {
    if (!previewDetailFile) {
      return null;
    }
    if (previewDetailFile.isBinary) {
      return t("git.historyBinaryDiffUnavailable");
    }
    const diffText = (previewDetailFile.diff ?? "").trimEnd();
    if (!diffText.trim()) {
      return t("git.historyEmptyDiff");
    }
    return diffText;
  }, [previewDetailFile, t]);

  const previewDiffEntries = useMemo(() => {
    if (!previewDetailFile) {
      return [];
    }
    return [
      {
        path: previewDetailFile.path,
        status: previewDetailFile.status,
        diff: previewDetailFile.diff ?? "",
      },
    ];
  }, [previewDetailFile]);

  const comparePreviewDetailFile = useMemo(() => {
    if (!comparePreviewFileKey || !branchDiffState || branchDiffState.mode !== "branch") {
      return null;
    }
    const selectedCommitDetails = branchDiffState.selectedCommitDetails;
    if (!selectedCommitDetails) {
      return null;
    }
    return selectedCommitDetails.files.find(
      (entry) => buildFileKey(entry) === comparePreviewFileKey,
    ) ?? null;
  }, [branchDiffState, comparePreviewFileKey]);

  const comparePreviewDetailFileDiff = useMemo(() => {
    if (!comparePreviewDetailFile) {
      return null;
    }
    if (comparePreviewDetailFile.isBinary) {
      return t("git.historyBinaryDiffUnavailable");
    }
    const diffText = (comparePreviewDetailFile.diff ?? "").trimEnd();
    if (!diffText.trim()) {
      return t("git.historyEmptyDiff");
    }
    return diffText;
  }, [comparePreviewDetailFile, t]);

  const comparePreviewDiffEntries = useMemo(() => {
    if (!comparePreviewDetailFile) {
      return [];
    }
    return [
      {
        path: comparePreviewDetailFile.path,
        status: comparePreviewDetailFile.status,
        diff: comparePreviewDetailFile.diff ?? "",
      },
    ];
  }, [comparePreviewDetailFile]);

  useEffect(() => {
    if (!previewFileKey) {
      return;
    }
    const handleWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewFileKey(null);
      }
    };
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [previewFileKey]);

  useEffect(() => {
    if (previewFileKey && !previewDetailFile) {
      setPreviewFileKey(null);
    }
  }, [previewDetailFile, previewFileKey]);

  useEffect(() => {
    if (!comparePreviewFileKey) {
      return;
    }
    const handleWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setComparePreviewFileKey(null);
      }
    };
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [comparePreviewFileKey]);

  useEffect(() => {
    if (comparePreviewFileKey && !comparePreviewDetailFile) {
      setComparePreviewFileKey(null);
    }
  }, [comparePreviewDetailFile, comparePreviewFileKey]);

  const getOperationDisplayName = useCallback(
    (operationName: string) => {
      const nameMap: Record<string, string> = {
        pull: t("git.pull"),
        push: t("git.push"),
        sync: t("git.sync"),
        fetch: t("git.fetch"),
        refresh: t("git.refresh"),
        checkout: t("git.historyOperationCheckout"),
        createBranch: t("git.historyOperationCreateBranch"),
        createFromCommit: t("git.historyOperationCreateFromCommit"),
        deleteBranch: t("git.historyOperationDeleteBranch"),
        renameBranch: t("git.historyOperationRenameBranch"),
        mergeBranch: t("git.historyOperationMergeBranch"),
        checkoutRebase: t("git.historyOperationCheckoutAndRebase"),
        rebaseBranch: t("git.historyOperationRebaseCurrentBranch"),
        revert: t("git.historyOperationRevertCommit"),
        "cherry-pick": t("git.historyOperationCherryPick"),
      };
      return nameMap[operationName] ?? operationName;
    },
    [t],
  );

  const clearOperationNotice = useCallback(() => {
    if (operationNoticeTimerRef.current !== null) {
      window.clearTimeout(operationNoticeTimerRef.current);
      operationNoticeTimerRef.current = null;
    }
    setOperationNotice(null);
  }, []);

  const showOperationNotice = useCallback((notice: GitOperationNoticeState) => {
    if (operationNoticeTimerRef.current !== null) {
      window.clearTimeout(operationNoticeTimerRef.current);
    }
    setOperationNotice(notice);
    operationNoticeTimerRef.current = window.setTimeout(() => {
      setOperationNotice(null);
      operationNoticeTimerRef.current = null;
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (operationNoticeTimerRef.current !== null) {
        window.clearTimeout(operationNoticeTimerRef.current);
      }
    };
  }, []);

  const localizedOperationName = useMemo(() => {
    if (!operationLoading) {
      return null;
    }
    return getOperationDisplayName(operationLoading);
  }, [getOperationDisplayName, operationLoading]);

  const localizeKnownGitError = useCallback(
    (message: string | null): string | null => {
      return localizeGitErrorMessage(message, t);
    },
    [t],
  );

  const createOperationErrorState = useCallback(
    (rawMessage: string): GitOperationErrorState => {
      const normalized = rawMessage.toLowerCase();
      if (isWorkingTreeDirtyBlockingError(rawMessage)) {
        return {
          userMessage: t("git.historyErrorWorkingTreeDirty"),
          debugMessage: rawMessage,
          retryable: true,
        };
      }
      if (normalized.includes("snapshot expired")) {
        return {
          userMessage: t("git.historySnapshotExpired"),
          debugMessage: rawMessage,
          retryable: true,
        };
      }
      return {
        userMessage: localizeKnownGitError(rawMessage) ?? rawMessage,
        debugMessage: rawMessage,
        retryable: true,
      };
    },
    [localizeKnownGitError, t],
  );

  const runOperation = useCallback(
    async (name: string, action: () => Promise<void>) => {
      clearOperationNotice();
      setOperationLoading(name);
      try {
        await action();
        await refreshAll();
        showOperationNotice({
          kind: "success",
          message: t("git.historyOperationSucceeded", {
            operation: getOperationDisplayName(name),
          }),
        });
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : String(error);
        const operationState = createOperationErrorState(rawMessage);
        showOperationNotice({
          kind: "error",
          message: `${t("git.historyOperationFailed", {
            operation: getOperationDisplayName(name),
          })} ${operationState.userMessage}${
            operationState.retryable ? ` ${t("git.historyOperationRetryHint")}` : ""
          }`,
          debugMessage: operationState.debugMessage,
        });
      } finally {
        setOperationLoading(null);
      }
    },
    [
      clearOperationNotice,
      createOperationErrorState,
      getOperationDisplayName,
      refreshAll,
      showOperationNotice,
      t,
    ],
  );

  const createBranchNameTrimmed = createBranchName.trim();
  const createBranchSubmitting = operationLoading === "createBranch";
  const createBranchCanConfirm = Boolean(
    workspaceId &&
      !createBranchSubmitting &&
      createBranchSource.trim() &&
      createBranchNameTrimmed,
  );

  const workingTreeSummaryLabel =
    workingTreeChangedFiles > 0
      ? t("git.filesChanged", { count: workingTreeChangedFiles })
      : t("git.workingTreeClean");
  const projectOptions = useMemo(() => {
    if (workspaces.length > 0) {
      return workspaces;
    }
    return workspace ? [workspace] : [];
  }, [workspace, workspaces]);
  const projectSections = useMemo(() => {
    const worktreesByParent = new Map<string, WorkspaceInfo[]>();
    for (const entry of workspaces) {
      if ((entry.kind ?? "main") !== "worktree" || !entry.parentId) {
        continue;
      }
      const bucket = worktreesByParent.get(entry.parentId) ?? [];
      bucket.push(entry);
      worktreesByParent.set(entry.parentId, bucket);
    }
    for (const bucket of worktreesByParent.values()) {
      bucket.sort((a, b) => {
        const orderDiff =
          getSortOrderValue(a.settings.sortOrder) - getSortOrderValue(b.settings.sortOrder);
        if (orderDiff !== 0) {
          return orderDiff;
        }
        return a.name.localeCompare(b.name);
      });
    }

    const toOption = (
      entry: WorkspaceInfo,
      kind: "main" | "worktree",
      parentLabel?: string | null,
    ) =>
      ({
        id: entry.id,
        label: entry.name,
        kind,
        parentLabel: parentLabel ?? null,
      }) satisfies GitHistoryPickerOption;

    if (groupedWorkspaces.length > 0) {
      return groupedWorkspaces
        .map((section) => ({
          id: section.id,
          name: section.name,
          options: section.workspaces.flatMap((entry) => {
            const worktreeOptions = (worktreesByParent.get(entry.id) ?? []).map((worktree) =>
              toOption(worktree, "worktree", entry.name),
            );
            return [toOption(entry, "main"), ...worktreeOptions];
          }),
        }))
        .filter((section) => section.options.length > 0);
    }
    return [
      {
        id: null,
        name: "",
        options: projectOptions.map((entry) =>
          toOption(
            entry,
            (entry.kind ?? "main") === "worktree" ? "worktree" : "main",
          ),
        ),
      },
    ];
  }, [groupedWorkspaces, projectOptions]);
  const shouldShowWorkspacePickerPage = !workspace || repositoryUnavailable;
  const workspacePickerMessage = repositoryUnavailable
    ? t("git.historySelectGitWorkspace")
    : t("git.historySelectWorkspace");

  const refreshFallbackGitRoots = useCallback(async () => {
    if (!repositoryUnavailable || !workspace) {
      setFallbackGitRoots([]);
      setFallbackGitRootsLoading(false);
      setFallbackGitRootsError(null);
      return;
    }
    setFallbackGitRootsLoading(true);
    setFallbackGitRootsError(null);
    try {
      const roots = await listGitRoots(workspace.id, 2);
      setFallbackGitRoots(roots);
      setFallbackGitRootsLoading(false);
    } catch (error) {
      setFallbackGitRoots([]);
      setFallbackGitRootsLoading(false);
      setFallbackGitRootsError(error instanceof Error ? error.message : String(error));
    }
  }, [repositoryUnavailable, workspace]);

  useEffect(() => {
    if (!repositoryUnavailable || !workspace) {
      setFallbackGitRoots([]);
      setFallbackGitRootsLoading(false);
      setFallbackGitRootsError(null);
      return;
    }
    void refreshFallbackGitRoots();
  }, [refreshFallbackGitRoots, repositoryUnavailable, workspace]);

  const handleFallbackGitRootSelect = useCallback(
    async (relativeRoot: string) => {
      if (!workspace || !relativeRoot) {
        return;
      }
      const absolutePath = resolveGitRootPath(workspace.path, relativeRoot);
      if (onSelectWorkspacePath) {
        await onSelectWorkspacePath(absolutePath);
        return;
      }
      if (!onSelectWorkspace) {
        return;
      }
      const normalizedTarget = absolutePath.replace(/\\/g, "/").replace(/\/+$/, "");
      const matched = workspaces.find(
        (entry) => entry.path.replace(/\\/g, "/").replace(/\/+$/, "") === normalizedTarget,
      );
      if (matched) {
        onSelectWorkspace(matched.id);
      }
    },
    [onSelectWorkspace, onSelectWorkspacePath, resolveGitRootPath, workspace, workspaces],
  );

  useEffect(() => {
    setWorkspaceSelectingId(null);
  }, [workspace?.id]);

  useEffect(() => {
    if (!repositoryUnavailable) {
      setFallbackSelectingRoot(null);
    }
  }, [repositoryUnavailable]);

  const workspaceSelectingName = useMemo(() => {
    if (!workspaceSelectingId) {
      return "";
    }
    return (
      projectOptions.find((entry) => entry.id === workspaceSelectingId)?.name ??
      t("git.historyProject")
    );
  }, [projectOptions, t, workspaceSelectingId]);

  const emptyStateStatusText = useMemo(() => {
    if (fallbackSelectingRoot) {
      return t("git.historyWorkspacePickerStatusSwitchRepo", { repo: fallbackSelectingRoot });
    }
    if (workspaceSelectingId) {
      return t("git.historyWorkspacePickerStatusSwitchWorkspace", {
        workspace: workspaceSelectingName,
      });
    }
    if (fallbackGitRootsLoading) {
      return t("git.historyWorkspacePickerStatusScanning");
    }
    if (fallbackGitRoots.length > 0) {
      return t("git.historyWorkspacePickerStatusReady", { count: fallbackGitRoots.length });
    }
    return t("git.historyWorkspacePickerStatusNoRepo");
  }, [
    fallbackGitRoots.length,
    fallbackGitRootsLoading,
    fallbackSelectingRoot,
    t,
    workspaceSelectingId,
    workspaceSelectingName,
  ]);
  const handleWorktreeSummaryChange = useCallback(
    (summary: {
      changedFiles: number;
      totalAdditions: number;
      totalDeletions: number;
    }) => {
      setWorkingTreeChangedFiles(summary.changedFiles);
      setWorkingTreeTotalAdditions(summary.totalAdditions);
      setWorkingTreeTotalDeletions(summary.totalDeletions);
    },
    [],
  );
  const handleToggleLocalScope = useCallback((scope: string) => {
    setExpandedLocalScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) {
        next.delete(scope);
      } else {
        next.add(scope);
      }
      return next;
    });
  }, []);

  const handleToggleRemoteScope = useCallback((scope: string) => {
    setExpandedRemoteScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) {
        next.delete(scope);
      } else {
        next.add(scope);
      }
      return next;
    });
  }, []);

  const handleCheckoutBranch = useCallback(
    async (name: string) => {
      if (!workspaceId) {
        return;
      }
      await runOperation("checkout", async () => {
        await checkoutGitBranch(workspaceId, name);
        setSelectedBranch(name);
      });
    },
    [runOperation, workspaceId],
  );

  const handleCreateBranch = useCallback((sourceBranch?: string | null) => {
    if (!workspaceId || operationLoading) {
      return;
    }
    const source = sourceBranch?.trim() ?? "";
    const defaultSource = source
      || (currentBranch && createBranchSourceOptions.includes(currentBranch) ? currentBranch : null)
      || createBranchSourceOptions[0]
      || "";
    setCreateBranchSource(defaultSource);
    setCreateBranchName(t("git.historyPromptNewBranchDefault"));
    closeBranchContextMenu();
    setCreateBranchDialogOpen(true);
  }, [
    closeBranchContextMenu,
    createBranchSourceOptions,
    currentBranch,
    operationLoading,
    t,
    workspaceId,
  ]);

  const handleCreateBranchConfirm = useCallback(async () => {
    if (!workspaceId) {
      return;
    }
    const source = createBranchSource.trim();
    const target = createBranchName.trim();
    if (!source || !target || operationLoading) {
      return;
    }
    await runOperation("createBranch", async () => {
      await createGitBranchFromBranch(workspaceId, target, source);
      setSelectedBranch(target);
      setCreateBranchDialogOpen(false);
      setCreateBranchName("");
      setCreateBranchSource("");
    });
  }, [createBranchName, createBranchSource, operationLoading, runOperation, workspaceId]);

  const handleCreateBranchFromCommit = useCallback(async () => {
    if (!workspaceId || !selectedCommitSha) {
      return;
    }
    const suggested = `feature/commit-${selectedCommitSha.slice(0, 7)}`;
    const name = window.prompt(t("git.historyPromptBranchFromCommitName"), suggested);
    if (!name || !name.trim()) {
      return;
    }
    await runOperation("createFromCommit", async () => {
      const trimmed = name.trim();
      await createGitBranchFromCommit(workspaceId, trimmed, selectedCommitSha);
      setSelectedBranch(trimmed);
    });
  }, [runOperation, selectedCommitSha, t, workspaceId]);

  const handleJumpToCommit = useCallback(async () => {
    if (!workspaceId || operationLoading) {
      return;
    }
    const target = window.prompt(t("git.historyPromptJumpToCommit"), "");
    if (!target || !target.trim()) {
      return;
    }
    const trimmed = target.trim();
    setHistoryError(null);
    try {
      const resolvedSha = await resolveGitCommitRef(workspaceId, trimmed);
      setSelectedBranch("all");
      setCommitQuery(resolvedSha);
      setSelectedCommitSha(resolvedSha);
      applyHistorySnapshotId(null);
      return;
    } catch {
      setSelectedBranch("all");
      setCommitQuery(trimmed);
      setSelectedCommitSha(null);
      applyHistorySnapshotId(null);
    }
  }, [applyHistorySnapshotId, operationLoading, t, workspaceId]);

  const handleDeleteBranch = useCallback(async (targetBranch?: string | null) => {
    const branchName = targetBranch ?? selectedBranch;
    if (!workspaceId || !branchName || branchName === "all") {
      return;
    }
    const confirmed = await ask(t("git.historyConfirmDeleteBranch", { branch: branchName }), {
      title: t("git.historyTitleDeleteBranch"),
      kind: "warning",
    });
    if (!confirmed) {
      return;
    }
    closeBranchContextMenu();
    await runOperation("deleteBranch", async () => {
      await deleteGitBranch(workspaceId, branchName, false);
      setSelectedBranch(currentBranch ?? "all");
    });
  }, [closeBranchContextMenu, currentBranch, runOperation, selectedBranch, t, workspaceId]);

  const handleRenameBranch = useCallback(async (targetBranch?: string | null) => {
    const branchName = targetBranch ?? selectedBranch;
    if (!workspaceId || !branchName || branchName === "all") {
      return;
    }
    const next = window.prompt(t("git.historyPromptRenameBranch"), branchName);
    if (!next || !next.trim() || next.trim() === branchName) {
      return;
    }
    closeBranchContextMenu();
    await runOperation("renameBranch", async () => {
      const trimmed = next.trim();
      await renameGitBranch(workspaceId, branchName, trimmed);
      setSelectedBranch(trimmed);
    });
  }, [closeBranchContextMenu, runOperation, selectedBranch, t, workspaceId]);

  const handleMergeBranch = useCallback(async (targetBranch?: string | null) => {
    const branchName = targetBranch ?? selectedBranch;
    if (!workspaceId || !branchName || branchName === "all") {
      return;
    }
    const confirmed = await ask(
      t("git.historyConfirmMergeBranchIntoCurrent", { branch: branchName }),
      {
        title: t("git.historyTitleMergeBranch"),
        kind: "warning",
      },
    );
    if (!confirmed) {
      return;
    }
    closeBranchContextMenu();
    await runOperation("mergeBranch", async () => {
      await mergeGitBranch(workspaceId, branchName);
    });
  }, [closeBranchContextMenu, runOperation, selectedBranch, t, workspaceId]);

  const handleCheckoutAndRebaseCurrent = useCallback(async (targetBranch: string) => {
    if (!workspaceId) {
      return;
    }
    const current = currentBranch;
    if (!current || !targetBranch || targetBranch === current) {
      return;
    }
    const confirmed = await ask(
      t("git.historyConfirmCheckoutAndRebaseCurrent", {
        branch: targetBranch,
        current,
      }),
      {
        title: t("git.historyTitleCheckoutAndRebaseCurrent"),
        kind: "warning",
      },
    );
    if (!confirmed) {
      return;
    }
    closeBranchContextMenu();
    await runOperation("checkoutRebase", async () => {
      await checkoutGitBranch(workspaceId, targetBranch);
      await rebaseGitBranch(workspaceId, current);
      setSelectedBranch(targetBranch);
    });
  }, [closeBranchContextMenu, currentBranch, runOperation, t, workspaceId]);

  const handleRebaseCurrentOntoBranch = useCallback(async (targetBranch: string) => {
    if (!workspaceId) {
      return;
    }
    const current = currentBranch;
    if (!current || !targetBranch || targetBranch === current) {
      return;
    }
    const confirmed = await ask(
      t("git.historyConfirmRebaseCurrentOntoBranch", {
        current,
        branch: targetBranch,
      }),
      {
        title: t("git.historyTitleRebaseCurrentOntoBranch"),
        kind: "warning",
      },
    );
    if (!confirmed) {
      return;
    }
    closeBranchContextMenu();
    await runOperation("rebaseBranch", async () => {
      await rebaseGitBranch(workspaceId, targetBranch);
    });
  }, [closeBranchContextMenu, currentBranch, runOperation, t, workspaceId]);

  const handleShowDiffWithWorktree = useCallback(async (targetBranch: string) => {
    if (!workspaceId || !targetBranch) {
      return;
    }
    const compareBranch = currentBranch ?? "";
    closeBranchContextMenu();
    setBranchDiffState({
      mode: "worktree",
      branch: targetBranch,
      compareBranch,
      files: [],
      selectedPath: null,
      loading: true,
      error: null,
      selectedDiff: null,
      selectedDiffLoading: false,
      selectedDiffError: null,
    });
    try {
      const diffs = await getGitWorktreeDiffAgainstBranch(workspaceId, targetBranch);
      setBranchDiffState({
        mode: "worktree",
        branch: targetBranch,
        compareBranch,
        files: diffs.map((entry) => ({
          path: entry.path,
          status: entry.status,
        })),
        selectedPath: null,
        loading: false,
        error: null,
        selectedDiff: null,
        selectedDiffLoading: false,
        selectedDiffError: null,
      });
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      setBranchDiffState({
        mode: "worktree",
        branch: targetBranch,
        compareBranch,
        files: [],
        selectedPath: null,
        loading: false,
        error: localizeKnownGitError(raw) ?? raw,
        selectedDiff: null,
        selectedDiffLoading: false,
        selectedDiffError: null,
      });
    }
  }, [closeBranchContextMenu, currentBranch, localizeKnownGitError, workspaceId]);

  const handleCompareWithCurrentBranch = useCallback(async (targetBranch: string) => {
    if (!workspaceId || !targetBranch) {
      return;
    }
    const compareBranch = currentBranch;
    if (!compareBranch) {
      return;
    }
    closeBranchContextMenu();
    setComparePreviewFileKey(null);
    setBranchDiffState({
      mode: "branch",
      branch: targetBranch,
      compareBranch,
      targetOnlyCommits: [],
      currentOnlyCommits: [],
      loading: true,
      error: null,
      selectedDirection: null,
      selectedCommitSha: null,
      selectedCommitDetails: null,
      selectedCommitLoading: false,
      selectedCommitError: null,
    });
    try {
      const commitSets = await getGitBranchCompareCommits(
        workspaceId,
        targetBranch,
        compareBranch,
      );
      setBranchDiffState({
        mode: "branch",
        branch: targetBranch,
        compareBranch,
        targetOnlyCommits: commitSets.targetOnlyCommits,
        currentOnlyCommits: commitSets.currentOnlyCommits,
        loading: false,
        error: null,
        selectedDirection: null,
        selectedCommitSha: null,
        selectedCommitDetails: null,
        selectedCommitLoading: false,
        selectedCommitError: null,
      });
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      setBranchDiffState({
        mode: "branch",
        branch: targetBranch,
        compareBranch,
        targetOnlyCommits: [],
        currentOnlyCommits: [],
        loading: false,
        error: localizeKnownGitError(raw) ?? raw,
        selectedDirection: null,
        selectedCommitSha: null,
        selectedCommitDetails: null,
        selectedCommitLoading: false,
        selectedCommitError: null,
      });
    }
  }, [closeBranchContextMenu, currentBranch, localizeKnownGitError, workspaceId]);

  const handleSelectWorktreeDiffFile = useCallback(
    async (branch: string, compareBranch: string, file: Pick<GitCommitDiff, "path" | "status">) => {
      if (!workspaceId) {
        return;
      }
      const cacheKey = `${workspaceId}\u0000worktree\u0000${branch}\u0000${compareBranch}\u0000${file.path}`;
      const cached = branchDiffCacheRef.current.get(cacheKey) ?? null;
      setBranchDiffState((previous) => {
        if (
          !previous
          || previous.mode !== "worktree"
          || previous.branch !== branch
          || previous.compareBranch !== compareBranch
        ) {
          return previous;
        }
        return {
          ...previous,
          selectedPath: file.path,
          selectedDiff: cached,
          selectedDiffLoading: !cached,
          selectedDiffError: null,
        };
      });
      if (cached) {
        return;
      }
      try {
        const detail = await getGitWorktreeDiffFileAgainstBranch(workspaceId, branch, file.path);
        const resolvedDetail: GitCommitDiff = {
          ...detail,
          path: file.path,
          status: detail.status || file.status,
        };
        branchDiffCacheRef.current.set(cacheKey, resolvedDetail);
        setBranchDiffState((previous) => {
          if (
            !previous
            || previous.mode !== "worktree"
            || previous.branch !== branch
            || previous.compareBranch !== compareBranch
            || previous.selectedPath !== file.path
          ) {
            return previous;
          }
          return {
            ...previous,
            selectedDiff: resolvedDetail,
            selectedDiffLoading: false,
            selectedDiffError: null,
          };
        });
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error);
        setBranchDiffState((previous) => {
          if (
            !previous
            || previous.mode !== "worktree"
            || previous.branch !== branch
            || previous.compareBranch !== compareBranch
            || previous.selectedPath !== file.path
          ) {
            return previous;
          }
          return {
            ...previous,
            selectedDiff: null,
            selectedDiffLoading: false,
            selectedDiffError: localizeKnownGitError(raw) ?? raw,
          };
        });
      }
    },
    [localizeKnownGitError, workspaceId],
  );

  const handleSelectBranchCompareCommit = useCallback(
    async (
      branch: string,
      compareBranch: string,
      direction: BranchCompareDirection,
      commit: GitHistoryCommit,
    ) => {
      if (!workspaceId) {
        return;
      }
      setComparePreviewFileKey(null);
      const cacheKey = `${workspaceId}\u0000${commit.sha}`;
      const cached = branchCompareDetailsCacheRef.current.get(cacheKey) ?? null;
      setBranchDiffState((previous) => {
        if (
          !previous
          || previous.mode !== "branch"
          || previous.branch !== branch
          || previous.compareBranch !== compareBranch
        ) {
          return previous;
        }
        return {
          ...previous,
          selectedDirection: direction,
          selectedCommitSha: commit.sha,
          selectedCommitDetails: cached,
          selectedCommitLoading: !cached,
          selectedCommitError: null,
        };
      });
      if (cached) {
        return;
      }
      try {
        const details = await getGitCommitDetails(workspaceId, commit.sha);
        branchCompareDetailsCacheRef.current.set(cacheKey, details);
        setBranchDiffState((previous) => {
          if (
            !previous
            || previous.mode !== "branch"
            || previous.branch !== branch
            || previous.compareBranch !== compareBranch
            || previous.selectedCommitSha !== commit.sha
            || previous.selectedDirection !== direction
          ) {
            return previous;
          }
          return {
            ...previous,
            selectedCommitDetails: details,
            selectedCommitLoading: false,
            selectedCommitError: null,
          };
        });
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error);
        setBranchDiffState((previous) => {
          if (
            !previous
            || previous.mode !== "branch"
            || previous.branch !== branch
            || previous.compareBranch !== compareBranch
            || previous.selectedCommitSha !== commit.sha
            || previous.selectedDirection !== direction
          ) {
            return previous;
          }
          return {
            ...previous,
            selectedCommitDetails: null,
            selectedCommitLoading: false,
            selectedCommitError: localizeKnownGitError(raw) ?? raw,
          };
        });
      }
    },
    [localizeKnownGitError, workspaceId],
  );

  const branchContextTrackingSummary = useMemo(() => {
    if (!branchContextMenu) {
      return null;
    }
    const branchName = branchContextMenu.branch.name;
    const isRemote = branchContextMenu.source === "remote" || branchContextMenu.branch.isRemote;
    if (isRemote) {
      return `${branchName} -> ${branchName}`;
    }
    const upstreamName = branchContextMenu.branch.upstream?.trim();
    const trackingTarget = upstreamName && upstreamName.length > 0
      ? upstreamName
      : `(${t("git.historyBranchMenuNoUpstreamTracking")})`;
    return `${branchName} -> ${trackingTarget}`;
  }, [branchContextMenu, t]);

  const branchContextActions = useMemo<BranchContextAction[]>(() => {
    if (!workspaceId || !branchContextMenu) {
      return [];
    }
    const targetBranch = branchContextMenu.branch.name;
    const isCurrent = branchContextMenu.branch.isCurrent || currentBranch === targetBranch;
    const isRemote = branchContextMenu.source === "remote" || branchContextMenu.branch.isRemote;
    const baseDisabledReason = operationLoading ? t("git.historyBranchMenuUnavailableBusy") : null;
    const currentDisabledReason = t("git.historyBranchMenuUnavailableCurrent");
    const remoteDisabledReason = t("git.historyBranchMenuUnavailableRemote");
    const noCurrentBranchDisabledReason = t("git.historyBranchMenuUnavailableNoCurrent");
    const todoDisabledReason = t("git.historyBranchMenuUnavailableNotImplemented");
    const currentBranchName = currentBranch ?? t("git.unknown");
    const remoteName = branchContextMenu.branch.remote ?? null;

    const createDisabledReason = createBranchSourceOptions.length === 0
      ? baseDisabledReason
      : null;

    return [
      {
        id: "checkout",
        label: t("git.historyBranchMenuCheckout"),
        icon: <GitBranch size={14} aria-hidden />,
        disabled: Boolean(baseDisabledReason || isCurrent),
        disabledReason: baseDisabledReason || (isCurrent ? currentDisabledReason : null),
        onSelect: () => {
          closeBranchContextMenu();
          void handleCheckoutBranch(targetBranch);
        },
      },
      {
        id: "create-branch",
        label: t("git.historyBranchMenuCreateFromBranch", { branch: targetBranch }),
        icon: <Plus size={14} aria-hidden />,
        disabled: Boolean(baseDisabledReason || createDisabledReason),
        disabledReason: baseDisabledReason || createDisabledReason,
        onSelect: () => {
          closeBranchContextMenu();
          handleCreateBranch(targetBranch);
        },
      },
      {
        id: "checkout-rebase",
        label: t("git.historyBranchMenuCheckoutAndRebaseCurrent", { current: currentBranchName }),
        icon: <Repeat size={14} aria-hidden />,
        disabled: Boolean(baseDisabledReason || isCurrent || isRemote || !currentBranch),
        disabledReason:
          baseDisabledReason ||
          (isCurrent
            ? currentDisabledReason
            : isRemote
              ? remoteDisabledReason
              : !currentBranch
                ? noCurrentBranchDisabledReason
                : null),
        onSelect: () => {
          closeBranchContextMenu();
          void handleCheckoutAndRebaseCurrent(targetBranch);
        },
      },
      {
        id: "compare-current",
        label: t("git.historyBranchMenuCompareWithCurrent", { current: currentBranchName }),
        icon: <FileText size={14} aria-hidden />,
        dividerBefore: true,
        disabled: Boolean(baseDisabledReason || isCurrent),
        disabledReason: baseDisabledReason || (isCurrent ? currentDisabledReason : null),
        onSelect: () => {
          void handleCompareWithCurrentBranch(targetBranch);
        },
      },
      {
        id: "diff-worktree",
        label: t("git.historyBranchMenuShowDiffWithWorktree"),
        icon: <FolderTree size={14} aria-hidden />,
        disabled: Boolean(baseDisabledReason),
        disabledReason: baseDisabledReason,
        onSelect: () => {
          void handleShowDiffWithWorktree(targetBranch);
        },
      },
      {
        id: "rebase-current-onto",
        label: t("git.historyBranchMenuRebaseCurrentOnto", {
          current: currentBranchName,
          branch: targetBranch,
        }),
        icon: <RefreshCw size={14} aria-hidden />,
        dividerBefore: true,
        disabled: Boolean(baseDisabledReason || isCurrent || isRemote || !currentBranch),
        disabledReason:
          baseDisabledReason ||
          (isCurrent
            ? currentDisabledReason
            : isRemote
              ? remoteDisabledReason
              : !currentBranch
                ? noCurrentBranchDisabledReason
                : null),
        onSelect: () => {
          closeBranchContextMenu();
          void handleRebaseCurrentOntoBranch(targetBranch);
        },
      },
      {
        id: "merge-into-current",
        label: t("git.historyBranchMenuMergeIntoCurrent", {
          branch: targetBranch,
          current: currentBranchName,
        }),
        icon: <GitMerge size={14} aria-hidden />,
        disabled: Boolean(baseDisabledReason || isCurrent || isRemote),
        disabledReason: baseDisabledReason || (isCurrent ? currentDisabledReason : isRemote ? remoteDisabledReason : null),
        onSelect: () => {
          closeBranchContextMenu();
          void handleMergeBranch(targetBranch);
        },
      },
      {
        id: "update",
        label: t("git.historyBranchMenuUpdate"),
        icon: <Download size={14} aria-hidden />,
        dividerBefore: true,
        disabled: Boolean(
          baseDisabledReason ||
          (isRemote ? !remoteName : !isCurrent),
        ),
        disabledReason:
          baseDisabledReason ||
          (isRemote ? (!remoteName ? remoteDisabledReason : null) : !isCurrent ? currentDisabledReason : null),
        onSelect: () => {
          closeBranchContextMenu();
          if (isRemote && remoteName) {
            void runOperation("fetch", () => fetchGit(workspaceId, remoteName));
            return;
          }
          void runOperation("pull", () => pullGit(workspaceId));
        },
      },
      {
        id: "push",
        label: t("git.historyBranchMenuPush"),
        icon: <Upload size={14} aria-hidden />,
        disabled: Boolean(baseDisabledReason || isRemote || !isCurrent),
        disabledReason: baseDisabledReason || (isRemote ? remoteDisabledReason : !isCurrent ? currentDisabledReason : null),
        onSelect: () => {
          closeBranchContextMenu();
          void runOperation("push", () => pushGit(workspaceId));
        },
      },
      {
        id: "rename",
        label: t("git.historyBranchMenuRename"),
        icon: <Pencil size={14} aria-hidden />,
        dividerBefore: true,
        disabled: Boolean(baseDisabledReason || isCurrent || isRemote || DISABLE_HISTORY_BRANCH_RENAME),
        disabledReason:
          baseDisabledReason
          || (isCurrent ? currentDisabledReason : isRemote ? remoteDisabledReason : DISABLE_HISTORY_BRANCH_RENAME ? todoDisabledReason : null),
        onSelect: () => {
          closeBranchContextMenu();
          void handleRenameBranch(targetBranch);
        },
      },
      {
        id: "delete",
        label: t("git.historyBranchMenuDelete"),
        icon: <Trash2 size={14} aria-hidden />,
        tone: "danger",
        disabled: Boolean(baseDisabledReason || isCurrent || isRemote),
        disabledReason: baseDisabledReason || (isCurrent ? currentDisabledReason : isRemote ? remoteDisabledReason : null),
        onSelect: () => {
          closeBranchContextMenu();
          void handleDeleteBranch(targetBranch);
        },
      },
    ];
  }, [
    branchContextMenu,
    closeBranchContextMenu,
    createBranchSourceOptions.length,
    currentBranch,
    handleCompareWithCurrentBranch,
    handleCheckoutAndRebaseCurrent,
    handleCheckoutBranch,
    handleCreateBranch,
    handleDeleteBranch,
    handleMergeBranch,
    handleRebaseCurrentOntoBranch,
    handleRenameBranch,
    handleShowDiffWithWorktree,
    operationLoading,
    runOperation,
    t,
    workspaceId,
  ]);

  const handleBranchContextMenuKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const menuElement = branchContextMenuRef.current;
      if (!menuElement) {
        return;
      }
      const enabledItems = Array.from(
        menuElement.querySelectorAll<HTMLButtonElement>(
          '.git-history-branch-context-item[role="menuitem"]:not(:disabled)',
        ),
      );
      if (!enabledItems.length) {
        return;
      }
      const activeElement = document.activeElement;
      const currentIndex = enabledItems.findIndex((item) => item === activeElement);
      const focusIndex = (index: number) => {
        const normalized = ((index % enabledItems.length) + enabledItems.length) % enabledItems.length;
        enabledItems[normalized]?.focus();
      };

      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        focusIndex(currentIndex < 0 ? 0 : currentIndex + 1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        focusIndex(currentIndex < 0 ? enabledItems.length - 1 : currentIndex - 1);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        event.stopPropagation();
        focusIndex(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        event.stopPropagation();
        focusIndex(enabledItems.length - 1);
      }
    },
    [],
  );

  useEffect(() => {
    if (!branchContextMenu) {
      return;
    }
    const rafId = window.requestAnimationFrame(() => {
      const menuElement = branchContextMenuRef.current;
      if (!menuElement) {
        return;
      }
      const firstEnabled = menuElement.querySelector<HTMLButtonElement>(
        '.git-history-branch-context-item[role="menuitem"]:not(:disabled)',
      );
      firstEnabled?.focus();
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [branchContextActions, branchContextMenu]);

  const branchContextMenuStyle = useMemo<CSSProperties | undefined>(() => {
    if (!branchContextMenu) {
      return undefined;
    }
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1440;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 900;
    const longestLabelLength = branchContextActions.reduce(
      (max, action) => Math.max(max, action.label.length),
      0,
    );
    const estimatedMenuWidth = clamp(longestLabelLength * 8 + 96, 276, 520);
    const dividerCount = branchContextActions.reduce(
      (count, action) => count + (action.dividerBefore ? 1 : 0),
      0,
    );
    const estimatedMenuHeight = clamp(
      branchContextActions.length * 38 + dividerCount * 8 + 18,
      220,
      560,
    );
    const padding = 10;
    return {
      left: clamp(
        branchContextMenu.x,
        padding,
        Math.max(padding, viewportWidth - estimatedMenuWidth - padding),
      ),
      top: clamp(
        branchContextMenu.y,
        padding,
        Math.max(padding, viewportHeight - estimatedMenuHeight - padding),
      ),
    };
  }, [branchContextActions, branchContextMenu]);

  const handleRevertSelectedCommit = useCallback(async () => {
    if (!workspaceId || !selectedCommitSha) {
      return;
    }
    const confirmed = await ask(
      t("git.historyConfirmRevertCommit", { sha: selectedCommitSha.slice(0, 10) }),
      {
        title: t("git.historyTitleRevertCommit"),
        kind: "warning",
      },
    );
    if (!confirmed) {
      return;
    }
    await runOperation("revert", () => revertCommit(workspaceId, selectedCommitSha));
  }, [runOperation, selectedCommitSha, t, workspaceId]);

  const handleFileTreeDirToggle = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const handleWindowResize = () => {
      setDesktopSplitLayout(window.innerWidth > COMPACT_LAYOUT_BREAKPOINT);
    };
    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, []);

  const getCurrentDefaultColumnWidths = useCallback(() => {
    const containerWidth =
      workbenchGridRef.current?.getBoundingClientRect().width ??
      (typeof window !== "undefined" ? window.innerWidth : 1600);
    return getDefaultColumnWidths(containerWidth);
  }, []);

  useEffect(() => {
    if (!desktopSplitLayout) {
      return;
    }
    const defaults = getCurrentDefaultColumnWidths();
    setOverviewWidth(defaults.overviewWidth);
    setBranchesWidth(defaults.branchesWidth);
    setCommitsWidth(defaults.commitsWidth);
  }, [desktopSplitLayout, getCurrentDefaultColumnWidths]);

  const beginVerticalResize = useCallback(
    (event: MouseEvent<HTMLDivElement>, onDeltaChange: (deltaX: number) => void) => {
      event.preventDefault();
      const startX = event.clientX;

      const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
        onDeltaChange(moveEvent.clientX - startX);
      };

      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.body.style.webkitUserSelect = "";
        delete document.body.dataset.gitHistoryColumnResizing;
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
      document.body.dataset.gitHistoryColumnResizing = "true";
    },
    [],
  );

  const handleOverviewSplitResizeStart = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!desktopSplitLayout) {
        return;
      }
      const host = workbenchGridRef.current;
      if (!host) {
        return;
      }
      const hostWidth = host.getBoundingClientRect().width;
      const maxOverviewWidth =
        hostWidth -
        VERTICAL_SPLITTER_SIZE -
        (branchesWidth +
          VERTICAL_SPLITTER_SIZE +
          commitsWidth +
          VERTICAL_SPLITTER_SIZE +
          DETAILS_MIN_WIDTH);

      beginVerticalResize(event, (deltaX) => {
        const nextWidth = clamp(
          overviewWidth + deltaX,
          OVERVIEW_MIN_WIDTH,
          Math.max(OVERVIEW_MIN_WIDTH, maxOverviewWidth),
        );
        setOverviewWidth(nextWidth);
      });
    },
    [beginVerticalResize, branchesWidth, commitsWidth, desktopSplitLayout, overviewWidth],
  );

  const handleBranchesSplitResizeStart = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!desktopSplitLayout) {
        return;
      }
      const pairWidth = branchesWidth + commitsWidth;

      beginVerticalResize(event, (deltaX) => {
        const nextBranchesWidth = clamp(
          branchesWidth + deltaX,
          BRANCHES_MIN_WIDTH,
          pairWidth - COMMITS_MIN_WIDTH,
        );
        setBranchesWidth(nextBranchesWidth);
        setCommitsWidth(pairWidth - nextBranchesWidth);
      });
    },
    [beginVerticalResize, branchesWidth, commitsWidth, desktopSplitLayout],
  );

  const handleCommitsSplitResizeStart = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!desktopSplitLayout) {
        return;
      }
      const host = mainGridRef.current;
      if (!host) {
        return;
      }
      const hostWidth = host.getBoundingClientRect().width;
      const maxCommitsWidth =
        hostWidth -
        branchesWidth -
        VERTICAL_SPLITTER_SIZE -
        VERTICAL_SPLITTER_SIZE -
        DETAILS_MIN_WIDTH;

      beginVerticalResize(event, (deltaX) => {
        const nextCommitsWidth = clamp(
          commitsWidth + deltaX,
          COMMITS_MIN_WIDTH,
          Math.max(COMMITS_MIN_WIDTH, maxCommitsWidth),
        );
        setCommitsWidth(nextCommitsWidth);
      });
    },
    [beginVerticalResize, branchesWidth, commitsWidth, desktopSplitLayout],
  );

  const handleDetailsSplitResizeStart = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
      const host = detailsBodyRef.current;
      if (!host) {
        return;
      }
      const rect = host.getBoundingClientRect();
      if (rect.height <= 0) {
        return;
      }
      const nextRatio = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      const clamped = Math.max(DETAILS_SPLIT_MIN, Math.min(DETAILS_SPLIT_MAX, nextRatio));
      setDetailsSplitRatio(clamped);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, []);

  const workbenchGridStyle = desktopSplitLayout
    ? {
        gridTemplateColumns: `${Math.round(overviewWidth)}px ${VERTICAL_SPLITTER_SIZE}px minmax(0, 1fr)`,
      }
    : undefined;

  const mainGridStyle = desktopSplitLayout
    ? {
        gridTemplateColumns: `${Math.round(branchesWidth)}px ${VERTICAL_SPLITTER_SIZE}px ${Math.round(
          commitsWidth,
        )}px ${VERTICAL_SPLITTER_SIZE}px minmax(0, 1fr)`,
      }
    : undefined;

  const commitRowVirtualizer = useVirtualizer({
    count: commits.length,
    getScrollElement: () => commitListRef.current,
    estimateSize: () => COMMIT_ROW_ESTIMATED_HEIGHT,
    overscan: 10,
  });
  const virtualCommitRows = commitRowVirtualizer.getVirtualItems();

  useEffect(() => {
    if (!selectedCommitSha || !commits.length) {
      return;
    }
    const selectedIndex = commits.findIndex((entry) => entry.sha === selectedCommitSha);
    if (selectedIndex >= 0) {
      commitRowVirtualizer.scrollToIndex(selectedIndex, { align: "center" });
    }
  }, [commitRowVirtualizer, commits, selectedCommitSha]);

  useEffect(() => {
    if (!historyHasMore || historyLoading || historyLoadingMore || !virtualCommitRows.length) {
      return;
    }
    const lastVisible = virtualCommitRows[virtualCommitRows.length - 1];
    if (lastVisible.index >= commits.length - 8) {
      void loadHistory(true, commits.length);
    }
  }, [
    commits.length,
    historyHasMore,
    historyLoading,
    historyLoadingMore,
    loadHistory,
    virtualCommitRows,
  ]);

  useEffect(() => {
    writeClientStoreValue("layout", persistenceKey, {
      overviewWidth,
      branchesWidth,
      commitsWidth,
      detailsSplitRatio,
      selectedBranch,
      commitQuery,
      selectedCommitSha,
      diffStyle: diffViewMode,
    } satisfies GitHistoryPanelPersistedState);
  }, [
    branchesWidth,
    commitQuery,
    commitsWidth,
    detailsSplitRatio,
    diffViewMode,
    overviewWidth,
    persistenceKey,
    selectedBranch,
    selectedCommitSha,
  ]);

  const isWorktreeDiffMode = branchDiffState?.mode === "worktree";
  const branchDiffModeClassName = isWorktreeDiffMode ? "is-worktree-mode" : "is-branch-mode";
  const branchDiffTitle = branchDiffState
    ? branchDiffState.mode === "worktree"
      ? t("git.historyBranchWorktreeDiffTitle", {
        branch: branchDiffState.branch,
        currentBranch: branchDiffState.compareBranch || t("git.unknown"),
      })
      : t("git.historyBranchCompareDiffTitle", {
        branch: branchDiffState.branch,
        compareBranch: branchDiffState.compareBranch || t("git.unknown"),
      })
    : "";
  const branchDiffSubtitle = branchDiffState
    ? branchDiffState.mode === "worktree"
      ? t("git.historyBranchWorktreeDiffSubtitle", { branch: branchDiffState.branch })
      : t("git.historyBranchCompareDiffSubtitle", {
        branch: branchDiffState.branch,
        compareBranch: branchDiffState.compareBranch || t("git.unknown"),
      })
    : "";
  const branchDiffModeLabel = isWorktreeDiffMode
    ? t("git.historyBranchWorktreeDiffModeBadge")
    : t("git.historyBranchCompareDiffModeBadge");
  const branchDiffStatsLabel = branchDiffState
    ? branchDiffState.mode === "worktree"
      ? t("git.filesChanged", { count: branchDiffState.files.length })
      : t("git.historyBranchCompareCommitCount", {
        count: branchDiffState.targetOnlyCommits.length + branchDiffState.currentOnlyCommits.length,
      })
    : "";

  if (shouldShowWorkspacePickerPage) {
    const canPickFallbackGitRoot = repositoryUnavailable && Boolean(workspace);
    const isEmptyStateSelecting = Boolean(fallbackSelectingRoot || workspaceSelectingId);
    return (
      <div className="git-history-workbench">
        <div className="git-history-toolbar git-history-empty-toolbar">
          <div className="git-history-toolbar-left">
            <span className="git-history-empty-inline-text">{workspacePickerMessage}</span>
            {projectOptions.length > 0 && onSelectWorkspace ? (
              <GitHistoryProjectPicker
                sections={projectSections}
                selectedId={workspace?.id ?? null}
                selectedLabel={workspace?.name ?? t("git.historyProject")}
                ariaLabel={t("git.historyProject")}
                searchPlaceholder={t("workspace.searchProjects")}
                emptyText={t("workspace.noProjectsFound")}
                disabled={isEmptyStateSelecting}
                onSelect={(nextWorkspaceId) => {
                  if (nextWorkspaceId && nextWorkspaceId !== workspace?.id) {
                    setWorkspaceSelectingId(nextWorkspaceId);
                    onSelectWorkspace(nextWorkspaceId);
                  }
                }}
              />
            ) : null}
            {canPickFallbackGitRoot ? (
              <GitHistoryProjectPicker
                sections={[
                  {
                    id: null,
                    name: "",
                    options: fallbackGitRoots.map((root) => ({ id: root, label: root })),
                  },
                ]}
                selectedId={fallbackSelectingRoot}
                selectedLabel={
                  fallbackSelectingRoot
                  || (fallbackGitRootsLoading
                    ? t("git.scanningRepositories")
                    : fallbackGitRoots.length > 0
                      ? t("git.chooseRepo")
                      : t("git.noRepositoriesFound"))
                }
                ariaLabel={t("git.chooseRepo")}
                searchPlaceholder={t("workspace.searchProjects")}
                emptyText={t("git.noRepositoriesFound")}
                disabled={
                  fallbackGitRootsLoading
                  || isEmptyStateSelecting
                  || fallbackGitRoots.length === 0
                }
                onSelect={(selectedRoot) => {
                  if (!selectedRoot) {
                    return;
                  }
                  void (async () => {
                    setFallbackSelectingRoot(selectedRoot);
                    try {
                      await handleFallbackGitRootSelect(selectedRoot);
                    } finally {
                      setFallbackSelectingRoot(null);
                    }
                  })();
                }}
              />
            ) : null}
            {fallbackGitRootsError ? (
              <span className="git-history-empty-inline-text">
                {localizeKnownGitError(fallbackGitRootsError) ?? fallbackGitRootsError}
              </span>
            ) : null}
          </div>
          {onRequestClose ? (
            <div className="git-history-toolbar-actions">
              <ActionSurface
                className="git-history-close-chip"
                onActivate={() => onRequestClose()}
                title={t("git.historyClosePanel")}
              >
                <X size={14} />
              </ActionSurface>
            </div>
          ) : null}
        </div>
        <div className="git-history-empty git-history-empty-body">
          <div className="git-history-empty-guide">
            <div className="git-history-empty-guide-title">
              {t("git.historyWorkspacePickerGuideTitle")}
            </div>
            <p className="git-history-empty-guide-line">
              {t("git.historyWorkspacePickerGuideStepCheck")}
            </p>
            <p className="git-history-empty-guide-line">
              {t("git.historyWorkspacePickerGuideStepScan")}
            </p>
            <p className="git-history-empty-guide-line">
              {t("git.historyWorkspacePickerGuideStepSelect")}
            </p>
          </div>
          <div className={`git-history-empty-progress ${isEmptyStateSelecting ? "is-busy" : ""}`}>
            {emptyStateStatusText}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="git-history-workbench"
      tabIndex={0}
      onKeyDown={(event) => {
        if (branchDiffState && event.key === "Escape") {
          event.preventDefault();
          closeBranchDiff();
          return;
        }
        if (branchContextMenu && event.key === "Escape") {
          event.preventDefault();
          closeBranchContextMenu();
          return;
        }
        if (createBranchDialogOpen && event.key === "Escape") {
          event.preventDefault();
          if (!createBranchSubmitting) {
            setCreateBranchDialogOpen(false);
          }
          return;
        }
        if (createBranchDialogOpen || branchContextMenu || branchDiffState) {
          return;
        }
        const target = event.target as HTMLElement | null;
        const isTypingTarget = Boolean(
          target &&
            (target.tagName === "INPUT" ||
              target.tagName === "TEXTAREA" ||
              target.isContentEditable),
        );
        if (isTypingTarget) {
          return;
        }
        if (!commits.length) {
          return;
        }
        const currentIndex = commits.findIndex((entry) => entry.sha === selectedCommitSha);
        if (event.key === "ArrowDown") {
          event.preventDefault();
          const nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, commits.length - 1);
          setSelectedCommitSha(commits[nextIndex].sha);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          const nextIndex = currentIndex < 0 ? 0 : Math.max(currentIndex - 1, 0);
          setSelectedCommitSha(commits[nextIndex].sha);
        } else if (event.key === "Escape") {
          onRequestClose?.();
        }
      }}
    >
      <div className="git-history-toolbar">
        <div className="git-history-toolbar-left">
          <h2>{t("git.historyTitle")}</h2>
          {projectOptions.length > 0 && onSelectWorkspace ? (
            <GitHistoryProjectPicker
              sections={projectSections}
              selectedId={workspace.id}
              selectedLabel={workspace.name}
              ariaLabel={t("git.historyProject")}
              searchPlaceholder={t("workspace.searchProjects")}
              emptyText={t("workspace.noProjectsFound")}
              onSelect={(nextWorkspaceId) => {
                if (nextWorkspaceId && nextWorkspaceId !== workspace.id) {
                  setWorkspaceSelectingId(nextWorkspaceId);
                  onSelectWorkspace(nextWorkspaceId);
                }
              }}
            />
          ) : null}
          <div className="git-history-toolbar-meta">
            <span className="git-history-head-pill">HEAD</span>
            <code className="git-history-current-branch">{currentBranch ?? workspace.name}</code>
            <span
              className={`git-history-toolbar-worktree ${
                workingTreeChangedFiles > 0 ? "is-dirty" : "is-clean"
              }`}
            >
              {workingTreeSummaryLabel}
            </span>
            {workingTreeChangedFiles > 0 ? (
              <span className="git-history-toolbar-lines">
                +{workingTreeTotalAdditions} / -{workingTreeTotalDeletions}
              </span>
            ) : null}
            <span className="git-history-toolbar-count">
              {t("git.historyCommitCount", { count: historyTotal })}
            </span>
          </div>
        </div>
        <div className="git-history-toolbar-actions">
          <div className="git-history-toolbar-action-group">
            <ActionSurface
              className="git-history-chip"
              onActivate={() => void runOperation("pull", () => pullGit(workspace.id))}
              disabled={Boolean(operationLoading)}
              title={t("git.pull")}
            >
              <Download size={13} />
              <span>{t("git.pull")}</span>
            </ActionSurface>
            <ActionSurface
              className="git-history-chip"
              onActivate={() => void runOperation("push", () => pushGit(workspace.id))}
              disabled={Boolean(operationLoading)}
              title={t("git.push")}
            >
              <Upload size={13} />
              <span>{t("git.push")}</span>
            </ActionSurface>
            <ActionSurface
              className="git-history-chip"
              onActivate={() => void runOperation("sync", () => syncGit(workspace.id))}
              disabled={Boolean(operationLoading)}
              title={t("git.sync")}
            >
              <Repeat size={13} />
              <span>{t("git.sync")}</span>
            </ActionSurface>
            <ActionSurface
              className="git-history-chip"
              onActivate={() => void runOperation("fetch", () => fetchGit(workspace.id))}
              disabled={Boolean(operationLoading)}
              title={t("git.fetch")}
            >
              <RefreshCw size={13} />
              <span>{t("git.fetch")}</span>
            </ActionSurface>
            <ActionSurface
              className="git-history-chip"
              onActivate={() => void runOperation("refresh", refreshAll)}
              disabled={Boolean(operationLoading) || historyLoading}
              title={t("git.refresh")}
            >
              <RefreshCw size={13} />
              <span>{t("git.refresh")}</span>
            </ActionSurface>
          </div>
          <ActionSurface
            className="git-history-close-chip"
            onActivate={() => onRequestClose?.()}
            title={t("git.historyClosePanel")}
          >
            <X size={14} />
          </ActionSurface>
        </div>
      </div>

      {operationNotice && (
        <div
          className={operationNotice.kind === "error" ? "git-history-error" : "git-history-success"}
          title={operationNotice.debugMessage}
        >
          {operationNotice.message}
        </div>
      )}
      {localizedOperationName && (
        <div className="git-history-status">
          {t("git.historyRunningOperation", { operation: localizedOperationName })}
        </div>
      )}

      <div
        className={`git-history-grid${desktopSplitLayout ? " with-vertical-resizers" : ""}`}
        ref={workbenchGridRef}
        style={workbenchGridStyle}
      >
        <aside className="git-history-overview">
          <div className="git-history-overview-toolbar is-files-top-row">
            <div className="git-history-overview-list-toggle">
              <ActionSurface
                className="git-history-overview-list-chip is-icon"
                active={overviewListView === "flat"}
                onActivate={() => setOverviewListView("flat")}
                ariaLabel={t("git.listFlat")}
                title={t("git.listFlat")}
              >
                <LayoutGrid size={14} />
              </ActionSurface>
              <ActionSurface
                className="git-history-overview-list-chip is-icon"
                active={overviewListView === "tree"}
                onActivate={() => setOverviewListView("tree")}
                ariaLabel={t("git.listTree")}
                title={t("git.listTree")}
              >
                <FolderTree size={14} />
              </ActionSurface>
            </div>
            <ActionSurface
              className="git-history-overview-diff-chip"
              ariaLabel={t("git.historyOverviewDiffLabel")}
              title={t("git.historyOverviewDiffLabel")}
            >
              <FileText size={13} />
              <span>{t("git.historyOverviewDiffLabel")}</span>
              <ChevronDown size={12} />
            </ActionSurface>
          </div>
          <GitHistoryWorktreePanel
            workspaceId={workspace.id}
            listView={overviewListView}
            onMutated={() => refreshAll()}
            onSummaryChange={handleWorktreeSummaryChange}
            onOpenDiffPath={onOpenDiffPath}
          />
        </aside>

        {desktopSplitLayout && (
          <div
            className="git-history-vertical-resizer"
            role="separator"
            aria-orientation="vertical"
            onMouseDown={handleOverviewSplitResizeStart}
            onDoubleClick={() => {
              const defaults = getCurrentDefaultColumnWidths();
              setOverviewWidth(defaults.overviewWidth);
            }}
          />
        )}

        <div
          className={`git-history-main-grid${desktopSplitLayout ? " with-vertical-resizers" : ""}`}
          ref={mainGridRef}
          style={mainGridStyle}
        >
        <section className="git-history-branches">
          <div className="git-history-column-header">
            <span>
              <GitBranch size={14} /> {t("git.historyBranches")}
            </span>
            <div className="git-history-branch-actions">
              <ActionSurface
                className="git-history-mini-chip"
                onActivate={() => void handleCreateBranch()}
                disabled={Boolean(operationLoading) || createBranchSourceOptions.length === 0}
                title={t("git.historyNew")}
                ariaLabel={t("git.historyNew")}
              >
                <Plus size={13} aria-hidden />
              </ActionSurface>
              <ActionSurface
                className="git-history-mini-chip"
                onActivate={() => void handleRenameBranch()}
                disabled={DISABLE_HISTORY_BRANCH_RENAME || DISABLE_HISTORY_ACTION_BUTTONS}
                title={t("git.historyRename")}
                ariaLabel={t("git.historyRename")}
              >
                <Pencil size={13} aria-hidden />
              </ActionSurface>
              <ActionSurface
                className="git-history-mini-chip"
                onActivate={() => void handleDeleteBranch()}
                title={t("git.historyDelete")}
                ariaLabel={t("git.historyDelete")}
              >
                <Trash2 size={13} aria-hidden />
              </ActionSurface>
              <ActionSurface
                className="git-history-mini-chip"
                onActivate={() => void handleMergeBranch()}
                title={t("git.historyMerge")}
                ariaLabel={t("git.historyMerge")}
              >
                <GitMerge size={13} aria-hidden />
              </ActionSurface>
            </div>
          </div>
          <label className="git-history-search">
            <Search size={14} />
            <input
              value={branchQuery}
              onChange={(event) => setBranchQuery(event.target.value)}
              placeholder={t("git.historySearchBranches")}
            />
          </label>
          <div className="git-history-branch-list">
            <ActionSurface
              className="git-history-branch-item git-history-branch-all-item"
              active={selectedBranch === "all"}
              onActivate={() => setSelectedBranch("all")}
            >
              <span>{t("git.historyAllBranches")}</span>
            </ActionSurface>

            <div className="git-history-tree-section">
              <ActionSurface
                className="git-history-tree-section-toggle"
                onActivate={() => setLocalSectionExpanded((prev) => !prev)}
                ariaLabel={t("git.historyToggleLocalBranches")}
              >
                {localSectionExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <HardDrive size={13} />
                <span>{t("git.historyLocal")}</span>
              </ActionSurface>
              {localSectionExpanded && (
                <div className="git-history-tree-section-body">
                  {groupedLocalBranches.map((group) => {
                    const scopeExpanded = expandedLocalScopes.has(group.key);
                    return (
                      <div key={`local-group-${group.key}`} className="git-history-tree-scope-group">
                        <ActionSurface
                          className="git-history-tree-scope-toggle"
                          onActivate={() => handleToggleLocalScope(group.key)}
                          ariaLabel={t("git.historyToggleLocalGroup", { group: group.label })}
                        >
                          {scopeExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          {scopeExpanded ? <FolderOpen size={12} /> : <Folder size={12} />}
                          <span className="git-history-tree-scope-label">{group.label}</span>
                        </ActionSurface>
                        {scopeExpanded &&
                          group.items.map((entry) => (
                            <div
                              key={`local-${entry.name}`}
                              className="git-history-branch-row"
                              onContextMenu={(event) =>
                                handleOpenBranchContextMenu(event, entry, "local")
                              }
                            >
                              <ActionSurface
                                className={`git-history-branch-item git-history-branch-item-tree ${
                                  entry.isCurrent ? "is-head-branch" : ""
                                }`}
                                active={selectedBranch === entry.name}
                                onActivate={() => setSelectedBranch(entry.name)}
                              >
                                <span className="git-history-tree-branch-main">
                                  <GitBranch size={11} />
                                  <span className="git-history-branch-name">
                                    {getBranchLeafName(entry.name)}
                                  </span>
                                </span>
                                <span className="git-history-branch-badges">
                                  {entry.isCurrent ? <em className="is-head">HEAD</em> : null}
                                  {getSpecialBranchBadges(entry.name, t).map((badge) => (
                                    <i key={`${entry.name}-${badge}`} className="is-special">
                                      {badge}
                                    </i>
                                  ))}
                                  {entry.ahead > 0 ? <i className="is-ahead">+{entry.ahead}</i> : null}
                                  {entry.behind > 0 ? <i className="is-behind">-{entry.behind}</i> : null}
                                </span>
                              </ActionSurface>
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="git-history-tree-section">
              <ActionSurface
                className="git-history-tree-section-toggle"
                onActivate={() => setRemoteSectionExpanded((prev) => !prev)}
                ariaLabel={t("git.historyToggleRemoteBranches")}
              >
                {remoteSectionExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <Cloud size={13} />
                <span>{t("git.historyRemote")}</span>
              </ActionSurface>
              {remoteSectionExpanded && (
                <div className="git-history-tree-section-body">
                  {groupedRemoteBranches.map((group) => {
                    const scopeExpanded = expandedRemoteScopes.has(group.remote);
                    return (
                      <div key={`remote-group-${group.remote}`} className="git-history-tree-scope-group">
                        <ActionSurface
                          className="git-history-tree-scope-toggle"
                          onActivate={() => handleToggleRemoteScope(group.remote)}
                          ariaLabel={t("git.historyToggleRemoteGroup", { group: group.remote })}
                        >
                          {scopeExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          {scopeExpanded ? <FolderOpen size={12} /> : <Folder size={12} />}
                          <span className="git-history-tree-scope-label">{group.remote}</span>
                        </ActionSurface>
                        {scopeExpanded &&
                          group.items.map((entry) => (
                            <div
                              key={`remote-${entry.name}`}
                              className="git-history-branch-row git-history-branch-row-remote"
                              onContextMenu={(event) =>
                                handleOpenBranchContextMenu(event, entry, "remote")
                              }
                            >
                              <ActionSurface
                                className="git-history-branch-item git-history-branch-item-remote-tree"
                                active={selectedBranch === entry.name}
                                onActivate={() => setSelectedBranch(entry.name)}
                              >
                                <span className="git-history-tree-branch-main">
                                  <GitBranch size={11} />
                                  <span className="git-history-branch-name">
                                    {trimRemotePrefix(entry.name, group.remote)}
                                  </span>
                                </span>
                                <span className="git-history-branch-badges">
                                  {getSpecialBranchBadges(entry.name, t).map((badge) => (
                                    <i key={`${entry.name}-${badge}`} className="is-special">
                                      {badge}
                                    </i>
                                  ))}
                                </span>
                              </ActionSurface>
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {desktopSplitLayout && (
          <div
            className="git-history-vertical-resizer"
            role="separator"
            aria-orientation="vertical"
            onMouseDown={handleBranchesSplitResizeStart}
            onDoubleClick={() => {
              const defaults = getCurrentDefaultColumnWidths();
              setBranchesWidth(defaults.branchesWidth);
              setCommitsWidth(defaults.commitsWidth);
            }}
          />
        )}

        <section className="git-history-commits">
          <div className="git-history-column-header">
            <span>
              <GitCommit size={14} /> {t("git.historyCommits")}
            </span>
            <div className="git-history-detail-actions">
              <ActionSurface
                className="git-history-mini-chip"
                onActivate={() => void handleJumpToCommit()}
                disabled={DISABLE_HISTORY_COMMIT_ACTIONS || DISABLE_HISTORY_ACTION_BUTTONS || Boolean(operationLoading)}
              >
                {t("git.historyJumpToCommit")}
              </ActionSurface>
              <ActionSurface
                className="git-history-mini-chip"
                onActivate={() => void handleCreateBranchFromCommit()}
                disabled={
                  DISABLE_HISTORY_COMMIT_ACTIONS
                  || DISABLE_HISTORY_ACTION_BUTTONS
                  || !selectedCommitSha
                  || Boolean(operationLoading)
                }
              >
                {t("git.historyBranchFromCommit")}
              </ActionSurface>
            </div>
          </div>
          <label className="git-history-search">
            <Search size={14} />
            <input
              value={commitQuery}
              onChange={(event) => setCommitQuery(event.target.value)}
              placeholder={t("git.historySearchCommits")}
            />
          </label>

          {historyError && (
            <div className="git-history-error">
              {localizeKnownGitError(historyError) ?? historyError}
            </div>
          )}
          {!historyError && historyLoading && (
            <div className="git-history-empty">{t("git.historyLoadingCommits")}</div>
          )}
          {!historyLoading && !commits.length && (
            <div className="git-history-empty">{t("git.historyNoCommitsFound")}</div>
          )}

          <div className="git-history-commit-list" ref={commitListRef}>
            <div
              className="git-history-commit-list-virtual"
              style={{ height: `${commitRowVirtualizer.getTotalSize()}px` }}
            >
              {virtualCommitRows.map((virtualRow) => {
                const entry = commits[virtualRow.index];
                if (!entry) {
                  return null;
                }
              const active = selectedCommitSha === entry.sha;
              const graphClassName = [
                "git-history-graph",
                  virtualRow.index === 0 ? "is-first" : "",
                  virtualRow.index === commits.length - 1 ? "is-last" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <ActionSurface
                  key={entry.sha}
                  className="git-history-commit-row"
                  active={active}
                  onActivate={() => setSelectedCommitSha(entry.sha)}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                >
                  <span className={graphClassName} aria-hidden>
                    <i className="git-history-graph-line" />
                    <i className="git-history-graph-dot" />
                  </span>
                  <span className="git-history-commit-content">
                    <span
                      className="git-history-commit-summary"
                      title={entry.summary || t("git.historyNoMessage")}
                    >
                      {entry.summary || t("git.historyNoMessage")}
                    </span>
                    <span className="git-history-commit-meta">
                      <code>{entry.shortSha}</code>
                      <em>{entry.author || t("git.unknown")}</em>
                      <time>{formatRelativeTime(entry.timestamp, t)}</time>
                    </span>
                    {entry.refs.length > 0 && (
                      <span className="git-history-commit-refs" title={entry.refs.join(", ")}>
                        {entry.refs.slice(0, 3).join(" · ")}
                      </span>
                    )}
                  </span>
                </ActionSurface>
              );
              })}
            </div>
          </div>

          {historyHasMore && (
            <div className="git-history-load-more">
              <ActionSurface
                className="git-history-load-more-chip"
                disabled={historyLoadingMore}
                onActivate={() => void loadHistory(true, commits.length)}
              >
                {historyLoadingMore ? t("common.loading") : t("git.historyLoadMore")}
              </ActionSurface>
            </div>
          )}
        </section>

        {desktopSplitLayout && (
          <div
            className="git-history-vertical-resizer"
            role="separator"
            aria-orientation="vertical"
            onMouseDown={handleCommitsSplitResizeStart}
            onDoubleClick={() => {
              const defaults = getCurrentDefaultColumnWidths();
              setCommitsWidth(defaults.commitsWidth);
            }}
          />
        )}

        <section className="git-history-details">
          <div className="git-history-column-header">
            <span>{t("git.historyCommitDetails")}</span>
            <div className="git-history-detail-actions">
              <ActionSurface
                className="git-history-mini-chip"
                disabled={
                  DISABLE_HISTORY_COMMIT_ACTIONS
                  || DISABLE_HISTORY_ACTION_BUTTONS
                  || !selectedCommitSha
                  || Boolean(operationLoading)
                }
                onActivate={() => {
                  if (!workspaceId || !selectedCommitSha) {
                    return;
                  }
                  void runOperation("cherry-pick", () =>
                    cherryPickCommit(workspaceId, selectedCommitSha),
                  );
                }}
              >
                {t("git.historyCherryPick")}
              </ActionSurface>
              <ActionSurface
                className="git-history-mini-chip"
                disabled={
                  DISABLE_HISTORY_COMMIT_ACTIONS
                  || DISABLE_HISTORY_ACTION_BUTTONS
                  || !selectedCommitSha
                  || Boolean(operationLoading)
                }
                onActivate={() => void handleRevertSelectedCommit()}
              >
                {t("git.historyRevert")}
              </ActionSurface>
            </div>
          </div>

          {detailsError && (
            <div className="git-history-error">
              {localizeKnownGitError(detailsError) ?? detailsError}
            </div>
          )}
          {!detailsError && detailsLoading && (
            <div className="git-history-empty">{t("git.historyLoadingCommitDetails")}</div>
          )}
          {!detailsLoading && !details && (
            <div className="git-history-empty">{t("git.historySelectCommitToViewDetails")}</div>
          )}

          {details && (
            <>
              <div className="git-history-metadata">
                <div>
                  <strong>{details.summary || t("git.historyNoMessage")}</strong>
                </div>
                <div className="git-history-metadata-row">
                  <code>{details.sha}</code>
                  <span>{details.author}</span>
                  <time>{new Date(details.commitTime * 1000).toLocaleString()}</time>
                </div>
                <div className="git-history-metadata-row">
                  <span>
                    {t("git.historyChangedFilesSummary", {
                      count: details.files.length,
                      additions: details.totalAdditions,
                      deletions: details.totalDeletions,
                    })}
                  </span>
                </div>
              </div>

              <div
                className="git-history-details-body"
                ref={detailsBodyRef}
                style={{
                  gridTemplateRows: `minmax(140px, ${detailsSplitRatio}%) 8px minmax(0, 1fr)`,
                }}
              >
                <div className="git-history-file-list">
                  <div className="git-history-file-tree-head">
                    <FolderTree size={13} />
                    <span>{t("git.historyChangedFiles")}</span>
                  </div>

                  {!fileTreeItems.length && (
                    <div className="git-history-empty">
                      {t("git.historyNoFileChangesInCommit")}
                    </div>
                  )}

                  {fileTreeItems.map((item) => {
                    if (item.type === "dir") {
                      return (
                        <ActionSurface
                          key={item.id}
                          className="git-history-tree-item git-history-tree-dir"
                          onActivate={() => handleFileTreeDirToggle(item.path)}
                          style={{ paddingLeft: `${10 + item.depth * 14}px` }}
                        >
                          <span className="git-history-tree-caret" aria-hidden>
                            {item.expanded ? "▾" : "▸"}
                          </span>
                          <span className="git-history-tree-label">{item.label}</span>
                        </ActionSurface>
                      );
                    }

                    const file = item.change;
                    const active = selectedFileKey === buildFileKey(file);
                    return (
                      <ActionSurface
                        key={item.id}
                        className="git-history-tree-item git-history-file-item"
                        active={active}
                        onActivate={() => {
                          const fileKey = buildFileKey(file);
                          setSelectedFileKey(fileKey);
                          setPreviewFileKey(fileKey);
                        }}
                        style={{ paddingLeft: `${10 + item.depth * 14}px` }}
                        title={statusLabel(file)}
                      >
                        <span
                          className={`git-history-file-status git-status-${file.status.toLowerCase()}`}
                        >
                          {file.status}
                        </span>
                        <span className="git-history-file-path">{item.label}</span>
                        <span className="git-history-file-stats">
                          +{file.additions} / -{file.deletions}
                        </span>
                      </ActionSurface>
                    );
                  })}
                </div>

                <div
                  className="git-history-details-resizer"
                  role="separator"
                  aria-orientation="horizontal"
                  aria-label={t("git.historyResizeFileListAndDiff")}
                  onMouseDown={handleDetailsSplitResizeStart}
                  onDoubleClick={() => setDetailsSplitRatio(DEFAULT_DETAILS_SPLIT)}
                />

                <div className="git-history-diff-view">
                  <pre className="git-history-diff-code">
                    {details.message.trim() || details.summary || t("git.historyNoMessage")}
                  </pre>
                </div>
              </div>

              {previewDetailFile && (
                <div
                  className="git-history-diff-modal-overlay"
                  role="presentation"
                  onClick={() => setPreviewFileKey(null)}
                >
                  <div
                    className="git-history-diff-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label={previewDetailFile.path}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="git-history-diff-modal-header">
                      <div className="git-history-diff-modal-title">
                        <span
                          className={`git-history-file-status git-status-${previewDetailFile.status.toLowerCase()}`}
                        >
                          {previewDetailFile.status}
                        </span>
                        <span>{previewDetailFile.path}</span>
                        <span className="git-history-diff-modal-stats">
                          +{previewDetailFile.additions} / -{previewDetailFile.deletions}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="git-history-diff-modal-close"
                        onClick={() => setPreviewFileKey(null)}
                        aria-label={t("common.close")}
                        title={t("common.close")}
                      >
                        <span className="git-history-diff-modal-close-glyph" aria-hidden>
                          ×
                        </span>
                      </button>
                    </div>

                    {previewDetailFile.truncated && !previewDetailFile.isBinary && (
                      <div className="git-history-warning">
                        {t("git.historyDiffTooLargeTruncated", {
                          lineCount: previewDetailFile.lineCount,
                        })}
                      </div>
                    )}
                    {previewDetailFile.isBinary ? (
                      <pre className="git-history-diff-modal-code">{previewDetailFileDiff}</pre>
                    ) : (
                      <div className="git-history-diff-modal-viewer">
                        <GitDiffViewer
                          workspaceId={workspaceId}
                          diffs={previewDiffEntries}
                          selectedPath={previewDetailFile.path}
                          isLoading={false}
                          error={null}
                          listView="flat"
                          diffStyle={diffViewMode}
                          onDiffStyleChange={setDiffViewMode}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
        </div>
        {branchDiffState ? (
          <div
            className="git-history-diff-modal-overlay"
            role="presentation"
            onClick={closeBranchDiff}
          >
            <div
              className={`git-history-diff-modal ${
                branchDiffState.mode === "worktree"
                  ? `git-history-branch-worktree-diff-modal ${branchDiffModeClassName}`
                  : "git-history-branch-compare-modal"
              }`}
              role="dialog"
              aria-modal="true"
              aria-label={branchDiffTitle}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="git-history-diff-modal-header">
                <div className="git-history-diff-modal-title git-history-branch-worktree-diff-title">
                  <span className="git-history-branch-worktree-diff-title-main">
                    <span
                      className={`git-history-branch-worktree-diff-title-icon ${branchDiffModeClassName}`}
                      aria-hidden
                    >
                      {isWorktreeDiffMode ? <FolderTree size={14} /> : <GitCommit size={14} />}
                    </span>
                    <span className={`git-history-branch-worktree-diff-mode-badge ${branchDiffModeClassName}`}>
                      {branchDiffModeLabel}
                    </span>
                    <span className="git-history-branch-worktree-diff-title-text">{branchDiffTitle}</span>
                  </span>
                  <span className="git-history-branch-worktree-diff-subtitle">{branchDiffSubtitle}</span>
                  <span className="git-history-diff-modal-stats git-history-branch-worktree-diff-stats">
                    {branchDiffStatsLabel}
                  </span>
                </div>
                <button
                  type="button"
                  className="git-history-diff-modal-close"
                  onClick={closeBranchDiff}
                  aria-label={t("common.close")}
                  title={t("common.close")}
                >
                  <span className="git-history-diff-modal-close-glyph" aria-hidden>
                    ×
                  </span>
                </button>
              </div>

              {branchDiffState.loading ? (
                <div className="git-history-empty">{t("common.loading")}</div>
              ) : branchDiffState.error ? (
                <div className="git-history-error">{branchDiffState.error}</div>
              ) : branchDiffState.mode === "worktree" ? (
                branchDiffState.files.length === 0 ? (
                  <div className="git-history-empty">{t("git.historyBranchWorktreeDiffEmpty")}</div>
                ) : (
                  <div className="git-history-branch-worktree-diff-layout">
                    <div className="git-history-branch-worktree-diff-detail">
                      {!branchDiffState.selectedPath ? (
                        <div className="git-history-empty">
                          {t("git.historyBranchWorktreeDiffSelectFile")}
                        </div>
                      ) : branchDiffState.selectedDiffLoading ? (
                        <div className="git-history-empty">{t("common.loading")}</div>
                      ) : branchDiffState.selectedDiffError ? (
                        <div className="git-history-error">{branchDiffState.selectedDiffError}</div>
                      ) : branchDiffState.selectedDiff ? (
                        <div className="git-history-diff-modal-viewer">
                          <GitDiffViewer
                            workspaceId={workspaceId}
                            diffs={[branchDiffState.selectedDiff]}
                            selectedPath={branchDiffState.selectedDiff.path}
                            isLoading={false}
                            error={null}
                            listView="flat"
                            diffStyle={diffViewMode}
                            onDiffStyleChange={setDiffViewMode}
                          />
                        </div>
                      ) : (
                        <div className="git-history-empty">{t("git.diffUnavailable")}</div>
                      )}
                    </div>
                    <div className="git-history-branch-worktree-diff-files">
                      <div className="git-history-branch-worktree-diff-files-title">
                        {t("git.historyBranchWorktreeDiffFilesTitle")}
                      </div>
                      <div className="git-history-branch-worktree-diff-files-list">
                        {branchDiffState.files.map((entry) => (
                          <button
                            key={entry.path}
                            type="button"
                            className={`git-history-branch-worktree-diff-file${
                              branchDiffState.selectedPath === entry.path ? " is-active" : ""
                            }`}
                            onClick={() => {
                              void handleSelectWorktreeDiffFile(
                                branchDiffState.branch,
                                branchDiffState.compareBranch,
                                entry,
                              );
                            }}
                          >
                            <span
                              className={`git-history-file-status git-status-${entry.status.toLowerCase()}`}
                            >
                              {entry.status}
                            </span>
                            <span className="git-history-branch-worktree-diff-file-path">
                              {entry.path}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="git-history-branch-compare-layout">
                  <div className="git-history-branch-compare-lists">
                    <section className="git-history-branch-compare-list-card is-target">
                      <header className="git-history-branch-compare-list-header is-target">
                        <span className="git-history-branch-compare-list-title-wrap">
                          <span className="git-history-branch-compare-list-dot" aria-hidden />
                          <span className="git-history-branch-compare-list-title">
                            {t("git.historyBranchCompareDirectionTargetOnly", {
                              target: branchDiffState.branch,
                              current: branchDiffState.compareBranch,
                            })}
                          </span>
                        </span>
                        <span className="git-history-branch-compare-list-count">
                          {t("git.historyCommitCount", { count: branchDiffState.targetOnlyCommits.length })}
                        </span>
                      </header>
                      {branchDiffState.targetOnlyCommits.length === 0 ? (
                        <div className="git-history-empty">
                          {t("git.historyBranchCompareDirectionEmpty")}
                        </div>
                      ) : (
                        <div className="git-history-branch-compare-list">
                          {branchDiffState.targetOnlyCommits.map((entry) => (
                            <button
                              key={`target-${entry.sha}`}
                              type="button"
                              className={`git-history-branch-compare-commit${
                                branchDiffState.selectedDirection === "targetOnly"
                                && branchDiffState.selectedCommitSha === entry.sha
                                  ? " is-active"
                                  : ""
                              }`}
                              onClick={() => {
                                void handleSelectBranchCompareCommit(
                                  branchDiffState.branch,
                                  branchDiffState.compareBranch,
                                  "targetOnly",
                                  entry,
                                );
                              }}
                            >
                              <span className="git-history-branch-compare-commit-summary">
                                {entry.summary || t("git.historyNoMessage")}
                              </span>
                              <span className="git-history-branch-compare-commit-meta">
                                <code>{entry.shortSha}</code>
                                <span>{entry.author}</span>
                                <time>{formatRelativeTime(entry.timestamp, t)}</time>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="git-history-branch-compare-list-card is-current">
                      <header className="git-history-branch-compare-list-header is-current">
                        <span className="git-history-branch-compare-list-title-wrap">
                          <span className="git-history-branch-compare-list-dot" aria-hidden />
                          <span className="git-history-branch-compare-list-title">
                            {t("git.historyBranchCompareDirectionCurrentOnly", {
                              target: branchDiffState.branch,
                              current: branchDiffState.compareBranch,
                            })}
                          </span>
                        </span>
                        <span className="git-history-branch-compare-list-count">
                          {t("git.historyCommitCount", { count: branchDiffState.currentOnlyCommits.length })}
                        </span>
                      </header>
                      {branchDiffState.currentOnlyCommits.length === 0 ? (
                        <div className="git-history-empty">
                          {t("git.historyBranchCompareDirectionEmpty")}
                        </div>
                      ) : (
                        <div className="git-history-branch-compare-list">
                          {branchDiffState.currentOnlyCommits.map((entry) => (
                            <button
                              key={`current-${entry.sha}`}
                              type="button"
                              className={`git-history-branch-compare-commit${
                                branchDiffState.selectedDirection === "currentOnly"
                                && branchDiffState.selectedCommitSha === entry.sha
                                  ? " is-active"
                                  : ""
                              }`}
                              onClick={() => {
                                void handleSelectBranchCompareCommit(
                                  branchDiffState.branch,
                                  branchDiffState.compareBranch,
                                  "currentOnly",
                                  entry,
                                );
                              }}
                            >
                              <span className="git-history-branch-compare-commit-summary">
                                {entry.summary || t("git.historyNoMessage")}
                              </span>
                              <span className="git-history-branch-compare-commit-meta">
                                <code>{entry.shortSha}</code>
                                <span>{entry.author}</span>
                                <time>{formatRelativeTime(entry.timestamp, t)}</time>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>

                  <div className="git-history-branch-compare-detail">
                    {!branchDiffState.selectedCommitSha ? (
                      <div className="git-history-empty">
                        {t("git.historyBranchCompareSelectCommit")}
                      </div>
                    ) : branchDiffState.selectedCommitLoading ? (
                      <div className="git-history-empty">{t("common.loading")}</div>
                    ) : branchDiffState.selectedCommitError ? (
                      <div className="git-history-error">{branchDiffState.selectedCommitError}</div>
                    ) : branchDiffState.selectedCommitDetails ? (
                      <div className="git-history-branch-compare-detail-body">
                        <div className="git-history-branch-compare-detail-summary">
                          {branchDiffState.selectedCommitDetails.summary || t("git.historyNoMessage")}
                        </div>
                        <div className="git-history-branch-compare-detail-meta">
                          <code>{branchDiffState.selectedCommitDetails.sha.slice(0, 7)}</code>
                          <span>{branchDiffState.selectedCommitDetails.author}</span>
                          <time>
                            {new Date(branchDiffState.selectedCommitDetails.commitTime * 1000).toLocaleString()}
                          </time>
                        </div>
                        {branchDiffState.selectedCommitDetails.message.trim().length > 0 ? (
                          <pre className="git-history-branch-compare-detail-message">
                            {branchDiffState.selectedCommitDetails.message.trim()}
                          </pre>
                        ) : null}
                        <div className="git-history-branch-compare-files-title">
                          {t("git.historyChangedFilesSummary", {
                            count: branchDiffState.selectedCommitDetails.files.length,
                            additions: branchDiffState.selectedCommitDetails.totalAdditions,
                            deletions: branchDiffState.selectedCommitDetails.totalDeletions,
                          })}
                        </div>
                        {branchDiffState.selectedCommitDetails.files.length === 0 ? (
                          <div className="git-history-empty">{t("git.historyNoFileChangesInCommit")}</div>
                        ) : (
                          <div className="git-history-branch-compare-files-list">
                            {branchDiffState.selectedCommitDetails.files.map((file) => {
                              const fileKey = buildFileKey(file);
                              return (
                                <button
                                  key={fileKey}
                                  type="button"
                                  className={`git-history-branch-compare-file${
                                    comparePreviewFileKey === fileKey ? " is-active" : ""
                                  }`}
                                  onClick={() => setComparePreviewFileKey(fileKey)}
                                  title={statusLabel(file)}
                                >
                                  <span
                                    className={`git-history-file-status git-status-${file.status.toLowerCase()}`}
                                  >
                                    {file.status}
                                  </span>
                                  <span className="git-history-branch-compare-file-path">
                                    {statusLabel(file)}
                                  </span>
                                  <span className="git-history-branch-compare-file-stats">
                                    +{file.additions} / -{file.deletions}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="git-history-empty">{t("git.diffUnavailable")}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
        {comparePreviewDetailFile ? (
          <div
            className="git-history-diff-modal-overlay"
            role="presentation"
            onClick={() => setComparePreviewFileKey(null)}
          >
            <div
              className="git-history-diff-modal"
              role="dialog"
              aria-modal="true"
              aria-label={comparePreviewDetailFile.path}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="git-history-diff-modal-header">
                <div className="git-history-diff-modal-title">
                  <span
                    className={`git-history-file-status git-status-${comparePreviewDetailFile.status.toLowerCase()}`}
                  >
                    {comparePreviewDetailFile.status}
                  </span>
                  <span>{comparePreviewDetailFile.path}</span>
                  <span className="git-history-diff-modal-stats">
                    +{comparePreviewDetailFile.additions} / -{comparePreviewDetailFile.deletions}
                  </span>
                </div>
                <button
                  type="button"
                  className="git-history-diff-modal-close"
                  onClick={() => setComparePreviewFileKey(null)}
                  aria-label={t("common.close")}
                  title={t("common.close")}
                >
                  <span className="git-history-diff-modal-close-glyph" aria-hidden>
                    ×
                  </span>
                </button>
              </div>

              {comparePreviewDetailFile.truncated && !comparePreviewDetailFile.isBinary && (
                <div className="git-history-warning">
                  {t("git.historyDiffTooLargeTruncated", {
                    lineCount: comparePreviewDetailFile.lineCount,
                  })}
                </div>
              )}
              {comparePreviewDetailFile.isBinary ? (
                <pre className="git-history-diff-modal-code">{comparePreviewDetailFileDiff}</pre>
              ) : (
                <div className="git-history-diff-modal-viewer">
                  <GitDiffViewer
                    workspaceId={workspaceId}
                    diffs={comparePreviewDiffEntries}
                    selectedPath={comparePreviewDetailFile.path}
                    isLoading={false}
                    error={null}
                    listView="flat"
                    diffStyle={diffViewMode}
                    onDiffStyleChange={setDiffViewMode}
                  />
                </div>
              )}
            </div>
          </div>
        ) : null}
        {branchContextMenu ? (
          <div className="git-history-branch-context-backdrop">
            <div
              ref={branchContextMenuRef}
              className="git-history-branch-context-menu"
              role="menu"
              style={branchContextMenuStyle}
              onKeyDown={handleBranchContextMenuKeyDown}
            >
              {branchContextTrackingSummary ? (
                <div className="git-history-branch-context-tracking" aria-label={t("git.upstream")}>
                  <span className="git-history-branch-context-tracking-text">
                    {branchContextTrackingSummary}
                  </span>
                </div>
              ) : null}
              {branchContextActions.map((action) => (
                <div
                  key={action.id}
                  className={`git-history-branch-context-item-wrap${action.dividerBefore ? " with-divider" : ""}`}
                >
                  <button
                    type="button"
                    className={`git-history-branch-context-item${action.disabled ? " is-disabled" : ""}${
                      action.tone === "danger" ? " is-danger" : ""
                    }`}
                    role="menuitem"
                    disabled={action.disabled}
                    title={action.disabledReason ?? undefined}
                    onClick={() => {
                      action.onSelect();
                    }}
                  >
                    <span className="git-history-branch-context-item-main">
                      <span className="git-history-branch-context-item-icon">{action.icon}</span>
                      <span className="git-history-branch-context-item-label">{action.label}</span>
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {createBranchDialogOpen ? (
          <div
            className="git-history-create-branch-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !createBranchSubmitting) {
                setCreateBranchDialogOpen(false);
              }
            }}
          >
            <div
              className="git-history-create-branch-dialog"
              role="dialog"
              aria-modal="true"
              aria-label={t("git.historyCreateBranchDialogTitle")}
            >
              <div className="git-history-create-branch-title">
                {t("git.historyCreateBranchDialogTitle")}
              </div>
              <label className="git-history-create-branch-field">
                <span>{t("git.historyCreateBranchDialogSourceLabel")}</span>
                <select
                  value={createBranchSource}
                  disabled={createBranchSubmitting}
                  onChange={(event) => setCreateBranchSource(event.target.value)}
                >
                  {createBranchSourceOptions.map((branchName) => (
                    <option key={branchName} value={branchName}>
                      {branchName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="git-history-create-branch-field">
                <span>{t("git.historyCreateBranchDialogNameLabel")}</span>
                <input
                  ref={createBranchNameInputRef}
                  value={createBranchName}
                  disabled={createBranchSubmitting}
                  placeholder={t("git.historyPromptNewBranchName")}
                  onChange={(event) => setCreateBranchName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && createBranchCanConfirm) {
                      event.preventDefault();
                      void handleCreateBranchConfirm();
                    }
                  }}
                />
              </label>
              {createBranchSubmitting ? (
                <div className="git-history-create-branch-hint">
                  {t("git.historyCreateBranchDialogBusy")}
                </div>
              ) : null}
              <div className="git-history-create-branch-actions">
                <button
                  type="button"
                  className="git-history-create-branch-btn is-cancel"
                  disabled={createBranchSubmitting}
                  onClick={() => setCreateBranchDialogOpen(false)}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className="git-history-create-branch-btn is-confirm"
                  disabled={!createBranchCanConfirm}
                  onClick={() => void handleCreateBranchConfirm()}
                >
                  {createBranchSubmitting ? t("common.loading") : t("common.confirm")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
