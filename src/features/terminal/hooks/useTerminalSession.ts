import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Ref } from "react";
import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import type { SearchAddon } from "@xterm/addon-search";
import type { WebLinksAddon } from "@xterm/addon-web-links";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { DebugEntry, TerminalStatus, WorkspaceInfo } from "../../../types";
import { buildErrorDebugEntry } from "../../../utils/debugEntries";
import { subscribeTerminalOutput, type TerminalOutputEvent } from "../../../services/events";
import {
  openTerminalSession,
  resizeTerminalSession,
  writeTerminalSession,
} from "../../../services/tauri";
import { isThemeMutationAttribute } from "../../theme/utils/themeAppearance";

const MAX_BUFFER_CHARS = 200_000;
/** Maximum number of terminal session buffers to keep in memory.
 *  Oldest inactive sessions are evicted when this limit is reached. */
const MAX_CACHED_SESSIONS = 10;

type XtermModules = {
  Terminal: typeof import("@xterm/xterm").Terminal;
  FitAddon: typeof import("@xterm/addon-fit").FitAddon;
  SearchAddon: typeof import("@xterm/addon-search").SearchAddon | null;
  WebLinksAddon: typeof import("@xterm/addon-web-links").WebLinksAddon | null;
};

// 本 hook 被 app-shell 常驻区段静态可达；xterm(~250KB+CSS) 若静态导入会进启动包。
// 首次真正显示终端时才动态加载，Promise 模块级缓存保证只加载一次。
let xtermModulesPromise: Promise<XtermModules> | null = null;

function loadXtermModules(): Promise<XtermModules> {
  if (!xtermModulesPromise) {
    xtermModulesPromise = Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
      import("@xterm/xterm/css/xterm.css"),
    ]).then(async ([xterm, fit]) => {
      const [search, webLinks] = await Promise.allSettled([
        import("@xterm/addon-search"),
        import("@xterm/addon-web-links"),
      ]);
      return {
        Terminal: xterm.Terminal,
        FitAddon: fit.FitAddon,
        SearchAddon:
          search.status === "fulfilled" ? search.value.SearchAddon : null,
        WebLinksAddon:
          webLinks.status === "fulfilled" ? webLinks.value.WebLinksAddon : null,
      };
    });
  }
  return xtermModulesPromise;
}

type UseTerminalSessionOptions = {
  activeWorkspace: WorkspaceInfo | null;
  activeTerminalId: string | null;
  isVisible: boolean;
  onDebug?: (entry: DebugEntry) => void;
};

type TerminalAppearance = {
  theme: {
    background: string;
    foreground: string;
    cursor: string;
    selectionBackground?: string;
  };
  fontFamily: string;
};

export type TerminalSessionState = {
  status: TerminalStatus;
  message: string;
  /**
   * Callback/object ref for the xterm host node.
   * Must be a callback (or equivalent remount signal) so that route switches
   * which unmount the dock (e.g. settings) can dispose and reattach xterm.
   */
  containerRef: Ref<HTMLDivElement>;
  hasSession: boolean;
  readyKey: string | null;
  cleanupTerminalSession: (workspaceId: string, terminalId: string) => void;
  getSelection: () => string;
  findNext: (query: string) => boolean;
  findPrevious: (query: string) => boolean;
};

export function isSafeTerminalWebUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function appendBuffer(existing: string | undefined, data: string): string {
  const next = (existing ?? "") + data;
  if (next.length <= MAX_BUFFER_CHARS) {
    return next;
  }
  return next.slice(next.length - MAX_BUFFER_CHARS);
}

function shouldIgnoreTerminalError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Terminal session not found");
}

function getTerminalAppearance(container: HTMLElement | null): TerminalAppearance {
  if (typeof window === "undefined") {
    return {
      theme: {
        background: "transparent",
        foreground: "#d9dee7",
        cursor: "#d9dee7",
      },
      fontFamily: "Menlo, Monaco, \"Courier New\", monospace",
    };
  }

  const target = container ?? document.documentElement;
  const styles = getComputedStyle(target);
  const background =
    styles.getPropertyValue("--terminal-background").trim() ||
    styles.getPropertyValue("--surface-debug").trim() ||
    styles.getPropertyValue("--surface-panel").trim() ||
    "#11151b";
  const foreground =
    styles.getPropertyValue("--terminal-foreground").trim() ||
    styles.getPropertyValue("--text-stronger").trim() ||
    "#d9dee7";
  const cursor =
    styles.getPropertyValue("--terminal-cursor").trim() || foreground;
  const selection = styles.getPropertyValue("--terminal-selection").trim();
  const fontFamily =
    styles.getPropertyValue("--terminal-font-family").trim() ||
    styles.getPropertyValue("--code-font-family").trim() ||
    "Menlo, Monaco, \"Courier New\", monospace";

  return {
    theme: {
      background,
      foreground,
      cursor,
      selectionBackground: selection || undefined,
    },
    fontFamily,
  };
}

function disposeFrontendTerminalInstance(refs: {
  terminalRef: { current: Terminal | null };
  fitAddonRef: { current: FitAddon | null };
  searchAddonRef: { current: SearchAddon | null };
  webLinksAddonRef: { current: WebLinksAddon | null };
  inputDisposableRef: { current: { dispose: () => void } | null };
  renderedKeyRef: { current: string | null };
  attachedHostRef?: { current: HTMLElement | null };
}) {
  refs.inputDisposableRef.current?.dispose();
  refs.inputDisposableRef.current = null;
  if (refs.terminalRef.current) {
    refs.terminalRef.current.dispose();
    refs.terminalRef.current = null;
  }
  refs.fitAddonRef.current = null;
  refs.searchAddonRef.current = null;
  refs.webLinksAddonRef.current = null;
  refs.renderedKeyRef.current = null;
  if (refs.attachedHostRef) {
    refs.attachedHostRef.current = null;
  }
}

export function useTerminalSession({
  activeWorkspace,
  activeTerminalId,
  isVisible,
  onDebug,
}: UseTerminalSessionOptions): TerminalSessionState {
  // Object ref holds the live host node; callback ref drives remount detection.
  // Settings / memory / home / chat↔extensions transitions unmount the dock while
  // terminalOpen stays true — without a remount signal, xterm stays attached to a
  // detached node and the remounted panel is blank (white).
  //
  // Important: chat↔extensions is a single React commit that fires
  // callback-ref(null) then callback-ref(newHost) before any effect runs.
  // Effects only see the final host; we must compare against attachedHostRef
  // rather than assuming "terminalRef.current exists ⇒ already on the live host".
  const containerNodeRef = useRef<HTMLDivElement | null>(null);
  const attachedHostRef = useRef<HTMLElement | null>(null);
  const [containerEpoch, setContainerEpoch] = useState(0);
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (containerNodeRef.current === node) {
      return;
    }
    containerNodeRef.current = node;
    setContainerEpoch((prev) => prev + 1);
  }, []);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const webLinksAddonRef = useRef<WebLinksAddon | null>(null);
  const inputDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const openedSessionsRef = useRef<Set<string>>(new Set());
  const outputBuffersRef = useRef<Map<string, string>>(new Map());
  const activeKeyRef = useRef<string | null>(null);
  const renderedKeyRef = useRef<string | null>(null);
  const activeWorkspaceRef = useRef<WorkspaceInfo | null>(null);
  const activeTerminalIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<TerminalStatus>("idle");
  const [message, setMessage] = useState("Open a terminal to start a session.");
  const [hasSession, setHasSession] = useState(false);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [sessionResetCounter, setSessionResetCounter] = useState(0);
  // xterm 实例经动态导入异步创建；ref 赋值不会触发 effect，用 tick 通知依赖方重跑。
  const [terminalInstanceTick, setTerminalInstanceTick] = useState(0);
  const cleanupTerminalSession = useCallback((workspaceId: string, terminalId: string) => {
    const key = `${workspaceId}:${terminalId}`;
    outputBuffersRef.current.delete(key);
    openedSessionsRef.current.delete(key);
    if (readyKey === key) {
      setReadyKey(null);
    }
    setSessionResetCounter((prev) => prev + 1);
    if (activeKeyRef.current === key) {
      terminalRef.current?.reset();
      setHasSession(false);
      setStatus("idle");
      setMessage("Open a terminal to start a session.");
    }
  }, [readyKey]);

  const activeKey = useMemo(() => {
    if (!activeWorkspace || !activeTerminalId) {
      return null;
    }
    return `${activeWorkspace.id}:${activeTerminalId}`;
  }, [activeTerminalId, activeWorkspace]);

  useEffect(() => {
    activeKeyRef.current = activeKey;
    activeWorkspaceRef.current = activeWorkspace;
    activeTerminalIdRef.current = activeTerminalId;
  }, [activeKey, activeTerminalId, activeWorkspace]);

  const writeToTerminal = useCallback((data: string) => {
    terminalRef.current?.write(data);
  }, []);

  // 用户拖蓝的高亮由 xterm 内部选区模型绘制(.xterm 是 user-select: none,
  // 根本不存在浏览器原生选区),所以选区文本只能从内部模型读。
  const getSelection = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal || !terminal.hasSelection()) {
      return "";
    }
    return terminal.getSelection().trim();
  }, []);
  const findNext = useCallback((query: string) => {
    const normalized = query.trim();
    return normalized
      ? (searchAddonRef.current?.findNext(normalized, {
          caseSensitive: false,
          incremental: true,
        }) ?? false)
      : false;
  }, []);
  const findPrevious = useCallback((query: string) => {
    const normalized = query.trim();
    return normalized
      ? (searchAddonRef.current?.findPrevious(normalized, {
          caseSensitive: false,
        }) ?? false)
      : false;
  }, []);

  // Visual-only refresh. Never call terminal.focus() here — appearance sync,
  // buffer restore, HMR/theme observers, and session readiness all call this
  // while the user may be typing in the composer.
  const refreshTerminal = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }
    const lastRow = Math.max(0, terminal.rows - 1);
    terminal.refresh(0, lastRow);
  }, []);
  const applyTerminalAppearance = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }
    const appearance = getTerminalAppearance(containerNodeRef.current);
    terminal.options.fontFamily = appearance.fontFamily;
    terminal.options.theme = appearance.theme;
    refreshTerminal();
  }, [refreshTerminal]);

  const syncActiveBuffer = useCallback(
    (key: string) => {
      const term = terminalRef.current;
      if (!term) {
        return;
      }
      term.reset();
      const buffered = outputBuffersRef.current.get(key);
      if (buffered) {
        term.write(buffered);
      }
      refreshTerminal();
    },
    [refreshTerminal],
  );

  useEffect(() => {
    const unlisten = subscribeTerminalOutput(
      (payload: TerminalOutputEvent) => {
        const { workspaceId, terminalId, data } = payload;
        const key = `${workspaceId}:${terminalId}`;
        const next = appendBuffer(outputBuffersRef.current.get(key), data);
        outputBuffersRef.current.set(key, next);
        // Evict oldest inactive sessions when cache exceeds limit.
        // Collect keys first to avoid mutating the Map during iteration.
        if (outputBuffersRef.current.size > MAX_CACHED_SESSIONS) {
          const keysToEvict: string[] = [];
          for (const cachedKey of outputBuffersRef.current.keys()) {
            if (cachedKey !== activeKeyRef.current) {
              keysToEvict.push(cachedKey);
              if (outputBuffersRef.current.size - keysToEvict.length <= MAX_CACHED_SESSIONS) break;
            }
          }
          for (const evictKey of keysToEvict) {
            outputBuffersRef.current.delete(evictKey);
            openedSessionsRef.current.delete(evictKey);
          }
        }
        if (activeKeyRef.current === key) {
          writeToTerminal(data);
        }
      },
      {
        onError: (error) => {
          onDebug?.(buildErrorDebugEntry("terminal listen error", error));
        },
      },
    );
    return () => {
      unlisten();
    };
  }, [onDebug, writeToTerminal]);

  useEffect(() => {
    // Host node gone (settings/memory/home/extensions tree swap unmounts the dock)
    // or panel closed: drop the frontend xterm so a later remount can reattach.
    const host = containerNodeRef.current;
    if (!isVisible || !host) {
      disposeFrontendTerminalInstance({
        terminalRef,
        fitAddonRef,
        searchAddonRef,
        webLinksAddonRef,
        inputDisposableRef,
        renderedKeyRef,
        attachedHostRef,
      });
      return;
    }

    // Already bound to the live host — keep the instance.
    if (terminalRef.current && attachedHostRef.current === host) {
      return;
    }

    // Stale instance on a detached / previous host. Same-commit remount
    // (chat ↔ extensions) never flushes intermediate null into this effect,
    // so "terminalRef.current exists" alone would leave a white blank panel.
    if (terminalRef.current) {
      disposeFrontendTerminalInstance({
        terminalRef,
        fitAddonRef,
        searchAddonRef,
        webLinksAddonRef,
        inputDisposableRef,
        renderedKeyRef,
        attachedHostRef,
      });
    }

    let cancelled = false;
    const openHost = host;
    void loadXtermModules()
      .then(({ Terminal, FitAddon, SearchAddon, WebLinksAddon }) => {
        if (
          cancelled ||
          terminalRef.current ||
          containerNodeRef.current !== openHost
        ) {
          return;
        }
        const appearance = getTerminalAppearance(openHost);
        const terminal = new Terminal({
          cursorBlink: true,
          fontSize: 12,
          fontFamily: appearance.fontFamily,
          theme: appearance.theme,
          scrollback: 5000,
        });
        const fitAddon = new FitAddon();
        const searchAddon = SearchAddon ? new SearchAddon() : null;
        const webLinksAddon = WebLinksAddon
          ? new WebLinksAddon((_event, uri) => {
              if (!isSafeTerminalWebUrl(uri)) {
                return;
              }
              void openUrl(uri).catch((error) => {
                onDebug?.(
                  buildErrorDebugEntry("terminal link open error", error),
                );
              });
            })
          : null;
        terminal.loadAddon(fitAddon);
        if (searchAddon) {
          terminal.loadAddon(searchAddon);
        }
        if (webLinksAddon) {
          terminal.loadAddon(webLinksAddon);
        }
        terminal.open(openHost);
        fitAddon.fit();
        terminalRef.current = terminal;
        fitAddonRef.current = fitAddon;
        searchAddonRef.current = searchAddon;
        webLinksAddonRef.current = webLinksAddon;
        attachedHostRef.current = openHost;
        applyTerminalAppearance();

        inputDisposableRef.current = terminal.onData((data: string) => {
          const workspace = activeWorkspaceRef.current;
          const terminalId = activeTerminalIdRef.current;
          if (!workspace || !terminalId) {
            return;
          }
          const key = `${workspace.id}:${terminalId}`;
          if (!openedSessionsRef.current.has(key)) {
            return;
          }
          void writeTerminalSession(workspace.id, terminalId, data).catch((error) => {
            if (shouldIgnoreTerminalError(error)) {
              openedSessionsRef.current.delete(key);
              return;
            }
            onDebug?.(buildErrorDebugEntry("terminal write error", error));
          });
        });
        setTerminalInstanceTick((prev) => prev + 1);
      })
      .catch((error) => {
        // 加载失败时清空缓存的 Promise，下次可见性变化可以重试。
        xtermModulesPromise = null;
        if (!cancelled) {
          onDebug?.(buildErrorDebugEntry("terminal module load error", error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [applyTerminalAppearance, containerEpoch, isVisible, onDebug]);

  useEffect(() => {
    return () => {
      disposeFrontendTerminalInstance({
        terminalRef,
        fitAddonRef,
        searchAddonRef,
        webLinksAddonRef,
        inputDisposableRef,
        renderedKeyRef,
        attachedHostRef,
      });
    };
  }, []);

  useEffect(() => {
    if (!isVisible) {
      setHasSession(false);
      setReadyKey(null);
      return;
    }
    if (!activeWorkspace || !activeTerminalId) {
      setStatus("idle");
      setMessage("Open a terminal to start a session.");
      setHasSession(false);
      setReadyKey(null);
      return;
    }
    if (!terminalRef.current || !fitAddonRef.current) {
      setStatus("idle");
      setMessage("Preparing terminal...");
      setHasSession(false);
      setReadyKey(null);
      return;
    }
    const key = `${activeWorkspace.id}:${activeTerminalId}`;
    const fitAddon = fitAddonRef.current;
    fitAddon.fit();

    const cols = terminalRef.current.cols;
    const rows = terminalRef.current.rows;
    const openSession = async () => {
      setStatus("connecting");
      setMessage("Starting terminal session...");
      if (!openedSessionsRef.current.has(key)) {
        await openTerminalSession(activeWorkspace.id, activeTerminalId, cols, rows);
        openedSessionsRef.current.add(key);
      }
      setStatus("ready");
      setMessage("Terminal ready.");
      setHasSession(true);
      setReadyKey(key);
      if (renderedKeyRef.current !== key) {
        syncActiveBuffer(key);
        renderedKeyRef.current = key;
      } else {
        refreshTerminal();
      }
    };

    openSession().catch((error) => {
      setStatus("error");
      setMessage("Failed to start terminal session.");
      onDebug?.(buildErrorDebugEntry("terminal open error", error));
    });
  }, [
    activeTerminalId,
    activeWorkspace,
    isVisible,
    onDebug,
    refreshTerminal,
    syncActiveBuffer,
    sessionResetCounter,
    terminalInstanceTick,
  ]);

  useEffect(() => {
    if (!isVisible || !activeKey || !terminalRef.current || !fitAddonRef.current) {
      return;
    }
    fitAddonRef.current.fit();
    refreshTerminal();
  }, [activeKey, isVisible, refreshTerminal]);

  useEffect(() => {
    if (
      !isVisible ||
      typeof document === "undefined" ||
      typeof MutationObserver === "undefined"
    ) {
      return;
    }
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (isThemeMutationAttribute(mutation.attributeName)) {
          applyTerminalAppearance();
          return;
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, [applyTerminalAppearance, isVisible]);

  useEffect(() => {
    if (
      !isVisible ||
      !terminalRef.current ||
      !activeWorkspace ||
      !activeTerminalId ||
      !hasSession
    ) {
      return;
    }
    const fitAddon = fitAddonRef.current;
    const terminal = terminalRef.current;
    if (!fitAddon) {
      return;
    }

    const resize = () => {
      fitAddon.fit();
      const key = `${activeWorkspace.id}:${activeTerminalId}`;
      resizeTerminalSession(
        activeWorkspace.id,
        activeTerminalId,
        terminal.cols,
        terminal.rows,
      ).catch((error) => {
        if (shouldIgnoreTerminalError(error)) {
          openedSessionsRef.current.delete(key);
          return;
        }
        onDebug?.(buildErrorDebugEntry("terminal resize error", error));
      });
    };

    const observer = new ResizeObserver(() => {
      resize();
    });

    if (containerNodeRef.current) {
      observer.observe(containerNodeRef.current);
    }
    resize();

    return () => {
      observer.disconnect();
    };
  }, [
    activeTerminalId,
    activeWorkspace,
    containerEpoch,
    hasSession,
    isVisible,
    onDebug,
  ]);

  return {
    status,
    message,
    containerRef: setContainerRef,
    hasSession,
    readyKey,
    cleanupTerminalSession,
    getSelection,
    findNext,
    findPrevious,
  };
}
