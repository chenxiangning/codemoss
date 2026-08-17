import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import Bot from "lucide-react/dist/esm/icons/bot";
import Brain from "lucide-react/dist/esm/icons/brain";
import Columns3 from "lucide-react/dist/esm/icons/columns-3";
import FileClock from "lucide-react/dist/esm/icons/file-clock";
import FolderOpen from "lucide-react/dist/esm/icons/folder-open";
import GitCompareArrows from "lucide-react/dist/esm/icons/git-compare-arrows";
import History from "lucide-react/dist/esm/icons/history";
import MapIcon from "lucide-react/dist/esm/icons/map";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import MessagesSquare from "lucide-react/dist/esm/icons/messages-square";
import NotebookPen from "lucide-react/dist/esm/icons/notebook-pen";
import PanelsTopLeft from "lucide-react/dist/esm/icons/panels-top-left";
import Search from "lucide-react/dist/esm/icons/search";
import Settings2 from "lucide-react/dist/esm/icons/settings-2";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import TerminalSquare from "lucide-react/dist/esm/icons/terminal-square";
import { FileIcon } from "../../../components/FileIcon";
import { usePluginPresence } from "../../../services/pluginPresence";
import { loadQuickSwitcherStyles } from "../../../styles/featureStyleLoaders";
import { useFeatureStylesReady } from "../../../styles/useFeatureStylesReady";
import { formatRelativeTimeShort } from "../../../utils/time";
import { formatShortcutForPlatform } from "../../../utils/shortcuts";
import type { EngineType } from "../../../types";
import { EngineIcon } from "../../engine/components/EngineIcon";
import { SharedSessionIcon } from "@mossx/plugin-shared-session/ui";
import { useQuickSwitcherRecentFiles } from "../hooks/useQuickSwitcherRecentFiles";
import type {
  QuickSwitcherNavigationId,
  QuickSwitcherRunningSession,
  QuickSwitcherSession,
  QuickSwitcherSessionGroup,
} from "../types";

const NAVIGATION_ITEMS: QuickSwitcherNavigationId[] = [
  "globalSearch",
  "chat",
  "files",
  "git",
  "history",
  "kanban",
  "spec",
  "intentCanvas",
  "projectMap",
  "terminal",
  "notes",
  "memory",
  "settings",
];

const NAVIGATION_ICONS = {
  globalSearch: Search,
  chat: MessageSquare,
  files: FolderOpen,
  git: GitCompareArrows,
  history: History,
  kanban: Columns3,
  spec: Bot,
  intentCanvas: PanelsTopLeft,
  projectMap: MapIcon,
  notes: NotebookPen,
  memory: Brain,
  terminal: TerminalSquare,
  settings: Settings2,
} satisfies Record<QuickSwitcherNavigationId, typeof MessageSquare>;

type QuickSwitcherPane = "navigation" | "sessions" | "files";

// 稳定的空数组哨兵：activeNavigationIds 缺省时保持常量引用，避免破坏下游 memo。
const EMPTY_ACTIVE_NAVIGATION_IDS: QuickSwitcherNavigationId[] = [];
Object.freeze(EMPTY_ACTIVE_NAVIGATION_IDS);

type QuickSwitcherProps = {
  workspaces: Array<{ id: string; name: string }>;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  activeFilePath?: string | null;
  sessionGroups: QuickSwitcherSessionGroup[];
  runningSessions: QuickSwitcherRunningSession[];
  // 当前已打开模块的导航 id 集合（wrapper 按 D1 口径计算）；命中行渲染
  // is-active 高亮态。可选且默认空数组，向后兼容既有调用与 mocks。
  activeNavigationIds?: QuickSwitcherNavigationId[];
  onNavigate: (target: QuickSwitcherNavigationId) => void;
  onSelectSession: (workspaceId: string, threadId: string) => void;
  onSelectFile: (workspaceId: string, path: string) => void;
  onClose: () => void;
};

type QuickSwitcherSessionRow =
  | { kind: "running"; session: QuickSwitcherRunningSession }
  | { kind: "recent"; session: QuickSwitcherSession };

function resolveRunningEngine(engine: string): EngineType {
  const normalized = engine.toUpperCase();
  if (normalized === "CLAUDE") {
    return "claude";
  }
  if (normalized === "GEMINI") {
    return "gemini";
  }
  if (normalized === "GROK") {
    return "grok";
  }
  if (normalized === "KIMI") {
    return "kimi";
  }
  if (normalized === "OPENCODE") {
    return "opencode";
  }
  return "codex";
}

function splitFilePath(path: string) {
  const separator = path.lastIndexOf("/");
  return separator < 0
    ? { name: path, parent: "" }
    : { name: path.slice(separator + 1), parent: path.slice(0, separator) };
}

export function QuickSwitcher({
  workspaces,
  activeWorkspaceId,
  activeThreadId,
  activeFilePath,
  sessionGroups,
  runningSessions,
  activeNavigationIds = EMPTY_ACTIVE_NAVIGATION_IDS,
  onNavigate,
  onSelectSession,
  onSelectFile,
  onClose,
}: QuickSwitcherProps) {
  const stylesReady = useFeatureStylesReady(loadQuickSwitcherStyles, true);
  const { t } = useTranslation();
  const pluginPresence = usePluginPresence();
  const navigationItems = useMemo(
    () =>
      NAVIGATION_ITEMS.filter((item) => {
        if (item === "notes") {
          return pluginPresence.notes;
        }
        if (item === "projectMap" || item === "memory") {
          return pluginPresence.projectMap;
        }
        return true;
      }),
    [pluginPresence.notes, pluginPresence.projectMap],
  );
  const fileGroups = useQuickSwitcherRecentFiles(workspaces);
  // is-active 纯展示态：不改变键盘导航模型（D3）。
  const activeNavigationIdSet = useMemo(
    () => new Set(activeNavigationIds),
    [activeNavigationIds],
  );
  // 去重：进行中会话不再重复出现在下方最近会话分组（D2，组件渲染前过滤）。
  const filteredSessionGroups = useMemo(() => {
    if (!runningSessions.length) {
      return sessionGroups;
    }
    const runningKeys = new Set(
      runningSessions.map((session) => `${session.workspaceId}:${session.threadId}`),
    );
    return sessionGroups
      .map((group) => ({
        ...group,
        sessions: group.sessions.filter(
          (session) => !runningKeys.has(`${session.workspaceId}:${session.id}`),
        ),
      }))
      .filter((group) => group.sessions.length > 0);
  }, [sessionGroups, runningSessions]);
  const sessions = useMemo(
    () => filteredSessionGroups.flatMap((group) => group.sessions),
    [filteredSessionGroups],
  );
  // sessions pane 扁平化行模型：running 行在各 workspace group 之前（D2）。
  const sessionRows = useMemo<QuickSwitcherSessionRow[]>(
    () => [
      ...runningSessions.map(
        (session): QuickSwitcherSessionRow => ({ kind: "running", session }),
      ),
      ...sessions.map(
        (session): QuickSwitcherSessionRow => ({ kind: "recent", session }),
      ),
    ],
    [runningSessions, sessions],
  );
  const files = useMemo(
    () => fileGroups.flatMap((group) => group.files),
    [fileGroups],
  );
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const activeFileIndex = files.findIndex(
    (file) =>
      file.workspaceId === activeWorkspaceId && file.path === activeFilePath,
  );
  const activeSessionIndex = sessionRows.findIndex((row) =>
    row.kind === "running"
      ? row.session.workspaceId === activeWorkspaceId &&
        row.session.threadId === activeThreadId
      : row.session.workspaceId === activeWorkspaceId &&
        row.session.id === activeThreadId,
  );
  const [activePane, setActivePane] = useState<QuickSwitcherPane>(() =>
    activeFileIndex >= 0 ? "files" : sessionRows.length ? "sessions" : "navigation",
  );
  const [navigationIndex, setNavigationIndex] = useState(0);
  const [sessionIndex, setSessionIndex] = useState(() =>
    activeSessionIndex >= 0 && activeSessionIndex + 1 < sessionRows.length
      ? activeSessionIndex + 1
      : Math.max(0, activeSessionIndex),
  );
  const [fileIndex, setFileIndex] = useState(() =>
    activeFileIndex >= 0 && activeFileIndex + 1 < files.length
      ? activeFileIndex + 1
      : Math.max(0, activeFileIndex),
  );

  const sessionRowIndexes = useMemo(
    () =>
      new Map(
        sessionRows.map((row, index) => [
          row.kind === "running"
            ? `running:${row.session.workspaceId}:${row.session.threadId}`
            : `recent:${row.session.workspaceId}:${row.session.id}`,
          index,
        ]),
      ),
    [sessionRows],
  );
  const fileIndexes = useMemo(
    () =>
      new Map(
        files.map((file, index) => [
          `${file.workspaceId}:${file.path}`,
          index,
        ]),
      ),
    [files],
  );

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    setSessionIndex((current) =>
      Math.min(current, Math.max(0, sessionRows.length - 1)),
    );
  }, [sessionRows.length]);

  useEffect(() => {
    setFileIndex((current) => Math.min(current, Math.max(0, files.length - 1)));
  }, [files.length]);

  useEffect(() => {
    setNavigationIndex((current) =>
      Math.min(current, Math.max(0, navigationItems.length - 1)),
    );
  }, [navigationItems.length]);

  useEffect(() => {
    const selectedRow = dialogRef.current?.querySelector<HTMLElement>(
      ".quick-switcher-row.is-selected",
    );
    selectedRow?.scrollIntoView?.({ block: "nearest" });
  }, [activePane, fileIndex, navigationIndex, sessionIndex]);

  const movePane = (direction: -1 | 1) => {
    const panes: QuickSwitcherPane[] = ["navigation", "sessions", "files"];
    const currentIndex = panes.indexOf(activePane);
    setActivePane(panes[(currentIndex + direction + panes.length) % panes.length]!);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      movePane(event.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      if (activePane === "navigation") {
        setNavigationIndex(
          (current) =>
            (current + delta + navigationItems.length) % navigationItems.length,
        );
      } else if (activePane === "sessions" && sessionRows.length) {
        setSessionIndex(
          (current) => (current + delta + sessionRows.length) % sessionRows.length,
        );
      } else if (activePane === "files" && files.length) {
        setFileIndex((current) => (current + delta + files.length) % files.length);
      }
      return;
    }
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    if (activePane === "navigation") {
      onNavigate(navigationItems[navigationIndex] ?? "chat");
    } else if (activePane === "sessions") {
      const row = sessionRows[sessionIndex];
      if (row) {
        if (row.kind === "running") {
          onSelectSession(row.session.workspaceId, row.session.threadId);
        } else {
          onSelectSession(row.session.workspaceId, row.session.id);
        }
      }
    } else {
      const file = files[fileIndex];
      if (file) onSelectFile(file.workspaceId, file.path);
    }
  };

  if (!stylesReady) {
    return null;
  }

  return (
    <div
      className="quick-switcher-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="quick-switcher"
        role="dialog"
        aria-modal="true"
        aria-label={t("quickSwitcher.title")}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className="quick-switcher-header">
          <h2>{t("quickSwitcher.title")}</h2>
          <kbd>{formatShortcutForPlatform("cmd+e")}</kbd>
        </header>

        <div className="quick-switcher-body">
          <nav
            className={`quick-switcher-navigation${
              activePane === "navigation" ? " is-active-pane" : ""
            }`}
            aria-label={t("quickSwitcher.navigation")}
          >
            <div className="quick-switcher-section-label">
              {t("quickSwitcher.navigation")}
            </div>
            {navigationItems.map((item, index) => {
              const Icon = NAVIGATION_ICONS[item];
              const selected = activePane === "navigation" && navigationIndex === index;
              const active = activeNavigationIdSet.has(item);
              return (
                <button
                  key={item}
                  type="button"
                  className={`quick-switcher-row${selected ? " is-selected" : ""}${active ? " is-active" : ""}`}
                  onMouseEnter={() => {
                    setActivePane("navigation");
                    setNavigationIndex(index);
                  }}
                  onClick={() => onNavigate(item)}
                >
                  <Icon size={15} aria-hidden strokeWidth={1.7} />
                  <span>{t(`quickSwitcher.nav.${item}`)}</span>
                </button>
              );
            })}
          </nav>

          <section
            className={`quick-switcher-recent-pane${
              activePane === "sessions" ? " is-active-pane" : ""
            }`}
            aria-label={t("quickSwitcher.recentSessions")}
          >
            <div className="quick-switcher-section-label quick-switcher-pane-heading">
              <span className="quick-switcher-section-title">
                <MessagesSquare size={13} aria-hidden />
                {t("quickSwitcher.recentSessions")}
              </span>
              <span>{sessions.length}</span>
            </div>
            <div className="quick-switcher-pane-scroll scrollable">
              {runningSessions.length ? (
                <div className="quick-switcher-workspace-group">
                  <div className="quick-switcher-workspace-heading">
                    <span className="quick-switcher-live-dot" aria-hidden />
                    <span>{t("quickSwitcher.runningSessions")}</span>
                    <small>{runningSessions.length}</small>
                  </div>
                  {runningSessions.map((session) => {
                    const index =
                      sessionRowIndexes.get(
                        `running:${session.workspaceId}:${session.threadId}`,
                      ) ?? -1;
                    const selected = activePane === "sessions" && sessionIndex === index;
                    const active =
                      session.workspaceId === activeWorkspaceId &&
                      session.threadId === activeThreadId;
                    return (
                      <button
                        key={`${session.workspaceId}:${session.threadId}`}
                        type="button"
                        className={`quick-switcher-row quick-switcher-recent-row quick-switcher-running-row${
                          selected ? " is-selected" : ""
                        }${active ? " is-current" : ""}`}
                        onMouseEnter={() => {
                          setActivePane("sessions");
                          setSessionIndex(index);
                        }}
                        onClick={() => onSelectSession(session.workspaceId, session.threadId)}
                      >
                        <span className="quick-switcher-live-dot" aria-hidden />
                        <span className="quick-switcher-leading-icon">
                          <EngineIcon
                            engine={resolveRunningEngine(session.engine)}
                            size={16}
                          />
                        </span>
                        <span className="quick-switcher-primary">
                          <span>{session.threadName}</span>
                          <small>{session.workspaceName}</small>
                        </span>
                        {session.startedAt != null ? (
                          <time>{formatRelativeTimeShort(session.startedAt)}</time>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {filteredSessionGroups.length ? (
                filteredSessionGroups.map((group) => (
                  <div className="quick-switcher-workspace-group" key={group.workspaceId}>
                    <div className="quick-switcher-workspace-heading">
                      <FolderOpen size={11} aria-hidden />
                      <span>{group.workspaceName}</span>
                      <small>{group.sessions.length}</small>
                    </div>
                    {group.sessions.map((session) => {
                      const index =
                        sessionRowIndexes.get(
                          `recent:${session.workspaceId}:${session.id}`,
                        ) ?? -1;
                      const selected = activePane === "sessions" && sessionIndex === index;
                      const active =
                        session.workspaceId === activeWorkspaceId &&
                        session.id === activeThreadId;
                      return (
                        <button
                          key={session.id}
                          type="button"
                          className={`quick-switcher-row quick-switcher-recent-row${
                            selected ? " is-selected" : ""
                          }${active ? " is-current" : ""}`}
                          onMouseEnter={() => {
                            setActivePane("sessions");
                            setSessionIndex(index);
                          }}
                          onClick={() => onSelectSession(session.workspaceId, session.id)}
                        >
                          <span className="quick-switcher-leading-icon">
                            {session.isShared ? (
                              <SharedSessionIcon size={16} />
                            ) : (
                              <EngineIcon engine={session.engine} size={16} />
                            )}
                          </span>
                          <span className="quick-switcher-primary">{session.title}</span>
                          <time>{formatRelativeTimeShort(session.updatedAt)}</time>
                        </button>
                      );
                    })}
                  </div>
                ))
              ) : !runningSessions.length ? (
                <div className="quick-switcher-empty">
                  {t("quickSwitcher.emptySessions")}
                </div>
              ) : null}
            </div>
          </section>

          <section
            className={`quick-switcher-recent-pane${
              activePane === "files" ? " is-active-pane" : ""
            }`}
            aria-label={t("quickSwitcher.recentFiles")}
          >
            <div className="quick-switcher-section-label quick-switcher-pane-heading">
              <span className="quick-switcher-section-title">
                <FileClock size={13} aria-hidden />
                {t("quickSwitcher.recentFiles")}
              </span>
              <span>{files.length}</span>
            </div>
            <div className="quick-switcher-pane-scroll scrollable">
              {fileGroups.length ? (
                fileGroups.map((group) => (
                  <div className="quick-switcher-workspace-group" key={group.workspaceId}>
                    <div className="quick-switcher-workspace-heading">
                      <FolderOpen size={11} aria-hidden />
                      <span>{group.workspaceName}</span>
                      <small>{group.files.length}</small>
                    </div>
                    {group.files.map((file) => {
                      const index = fileIndexes.get(`${file.workspaceId}:${file.path}`) ?? -1;
                      const selected = activePane === "files" && fileIndex === index;
                      const active =
                        file.workspaceId === activeWorkspaceId &&
                        file.path === activeFilePath;
                      const pathParts = splitFilePath(file.path);
                      return (
                        <button
                          key={file.path}
                          type="button"
                          className={`quick-switcher-row quick-switcher-recent-row${
                            selected ? " is-selected" : ""
                          }${active ? " is-current" : ""}`}
                          onMouseEnter={() => {
                            setActivePane("files");
                            setFileIndex(index);
                          }}
                          onClick={() => onSelectFile(file.workspaceId, file.path)}
                        >
                          <FileIcon filePath={file.path} size={16} />
                          <span className="quick-switcher-primary quick-switcher-file-label">
                            <span>{pathParts.name}</span>
                            {pathParts.parent ? <small>{pathParts.parent}</small> : null}
                          </span>
                          {file.aiModifiedAt ? (
                            <span className="quick-switcher-ai-badge" title={t("quickSwitcher.aiModified")}>
                              <Sparkles size={9} aria-hidden />
                            </span>
                          ) : null}
                          <time>{formatRelativeTimeShort(file.touchedAt)}</time>
                        </button>
                      );
                    })}
                  </div>
                ))
              ) : (
                <div className="quick-switcher-empty">
                  {t("quickSwitcher.emptyFiles")}
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="quick-switcher-footer">
          <span><kbd>←</kbd><kbd>→</kbd> {t("quickSwitcher.switchPaneHint")}</span>
          <span><kbd>↑</kbd><kbd>↓</kbd> {t("quickSwitcher.keyboardHint")}</span>
          <span><kbd>↵</kbd> {t("quickSwitcher.openHint")}</span>
          <span><kbd>esc</kbd> {t("quickSwitcher.closeHint")}</span>
        </footer>
      </div>
    </div>
  );
}
