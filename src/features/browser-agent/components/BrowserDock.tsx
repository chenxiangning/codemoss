import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import Globe from "lucide-react/dist/esm/icons/globe";
import Info from "lucide-react/dist/esm/icons/info";
import Minus from "lucide-react/dist/esm/icons/minus";
import Plus from "lucide-react/dist/esm/icons/plus";
import X from "lucide-react/dist/esm/icons/x";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { loadBrowserAgentStyles } from "../../../styles/featureStyleLoaders";
import type {
  BrowserSession,
  BrowserWebviewEvent,
} from "../types";
import {
  clearActiveBrowserContextSession,
  setActiveBrowserContextSession,
} from "../state/activeBrowserContext";
import {
  BROWSER_OPEN_URL_EVENT,
  PENDING_BROWSER_URL_KEY,
} from "../state/dockEvents";
import {
  measureEmbeddedWebviewContainer,
  showEmbeddedBrowserWebview,
  unmountEmbeddedBrowserWebview,
  useEmbeddedBrowserWebview,
} from "../hooks/useEmbeddedBrowserWebview";
import {
  BrowserDockEditorChrome,
  type BrowserDockNotice,
} from "./BrowserDockEditorChrome";
import {
  closeBrowserAgentSession,
  createBrowserAgentSession,
  getAppSettings,
  getBrowserAgentStatus,
  listBrowserAgentSessions,
  openBrowserAgentWindow,
  updateBrowserAgentSession,
  updateAppSettings,
  validateBrowserAgentUrl,
} from "@/services/tauri";

const BROWSER_WEBVIEW_EVENT = "browser-agent://webview-event";

type BrowserDockProps = {
  workspaceId: string;
  ownerSurface?: string;
  /**
   * floating（默认）：会话内容开在独立浮动窗（既有行为）。
   * embedded：会话内容作为主窗口子 webview 内嵌到 dock 容器矩形。
   */
  displayMode?: "floating" | "embedded";
  enabled?: boolean;
  className?: string;
  onSessionChange?: (session: BrowserSession | null) => void;
};

type TauriInternalsWindow = Window & {
  __TAURI_INTERNALS__?: {
    transformCallback?: unknown;
  };
};

function normalizeUrlDraft(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  // Keep absolute schemes as-is (including local file:// HTML previews).
  if (/^(https?|file):\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function sessionStatusKey(session: BrowserSession | null): string {
  if (!session) {
    return "browserAgent.dock.statusDisconnected";
  }
  if (session.status === "loading") {
    return "browserAgent.dock.statusLoading";
  }
  if (session.status === "ready") {
    return "browserAgent.dock.statusReady";
  }
  if (session.status === "closed") {
    return "browserAgent.dock.statusClosed";
  }
  if (session.status === "failed" || session.status === "blocked") {
    return "browserAgent.dock.statusNeedsAttention";
  }
  return "browserAgent.dock.statusPreparing";
}

function hasTauriEventBridge(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return typeof (window as TauriInternalsWindow).__TAURI_INTERNALS__?.transformCallback === "function";
}

export function BrowserDock({
  workspaceId,
  ownerSurface = "vibecoding",
  displayMode = "floating",
  enabled,
  className,
  onSessionChange,
}: BrowserDockProps) {
  useEffect(() => {
    void loadBrowserAgentStyles();
  }, []);
  const { t, i18n } = useTranslation();
  const [statusEnabled, setStatusEnabled] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [sessions, setSessions] = useState<BrowserSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<BrowserDockNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  // 岛 ⇄ 状态行形变：纯展示态，不影响会话逻辑
  const [docked, setDocked] = useState(false);
  const activeSessionRef = useRef<BrowserSession | null>(null);
  const onSessionChangeRef = useRef(onSessionChange);
  const isEmbedded = displayMode === "embedded";
  // 内嵌模式：native 子 webview 对齐此容器矩形（岛下方 webview-frame 区域）
  const webviewContainerRef = useRef<HTMLDivElement | null>(null);

  const openSessions = useMemo(
    () => sessions.filter((session) => session.status !== "closed"),
    [sessions],
  );
  const activeSession = useMemo(() => {
    if (!activeSessionId) {
      return null;
    }
    return openSessions.find((session) => session.browserSessionId === activeSessionId) ?? null;
  }, [activeSessionId, openSessions]);
  activeSessionRef.current = activeSession;
  onSessionChangeRef.current = onSessionChange;

  const statusLabel = useMemo(
    () => t(sessionStatusKey(activeSession)),
    [activeSession, t],
  );
  const resolvedEnabled = enabled ?? statusEnabled;
  const infoMessage = notice?.message
    ? `${notice.message}\n${t("browserAgent.dock.footnote")}`
    : t("browserAgent.dock.footnote");

  // 内嵌显隐纪律：切会话/关 dock/离开 chat（组件卸载）时显式 hide，bounds 随容器同步。
  useEmbeddedBrowserWebview({
    containerRef: webviewContainerRef,
    activeSession,
    active: isEmbedded && resolvedEnabled,
  });

  useEffect(() => {
    if (enabled !== undefined) {
      setStatusEnabled(enabled);
      return;
    }
    let mounted = true;
    void (async () => {
      try {
        const status = await getBrowserAgentStatus();
        if (mounted) {
          setStatusEnabled(status.settings.enabled);
        }
      } catch (error) {
        if (mounted) {
          setStatusEnabled(false);
          setNotice({
            kind: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [enabled]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const nextSessions = await listBrowserAgentSessions(workspaceId);
        if (!mounted) {
          return;
        }
        setSessions(nextSessions);
        const nextActive = nextSessions.find((session) => session.status !== "closed") ?? null;
        setActiveSessionId(nextActive?.browserSessionId ?? null);
        if (nextActive) {
          setActiveBrowserContextSession(nextActive, { rendererBound: false });
        } else {
          clearActiveBrowserContextSession();
        }
        onSessionChangeRef.current?.(nextActive);
      } catch (error) {
        if (mounted) {
          setNotice({
            kind: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!hasTauriEventBridge()) {
      return;
    }
    let disposed = false;
    let cleanup: (() => void) | null = null;
    void listen<BrowserWebviewEvent>(BROWSER_WEBVIEW_EVENT, (event) => {
      if (disposed) {
        return;
      }
      const payload = event.payload;
      setSessions((current) =>
        current.map((session) =>
          session.browserSessionId === payload.browserSessionId
            ? {
                ...session,
                url: payload.url ?? session.url,
                normalizedUrl: payload.url ?? session.normalizedUrl,
                title: payload.title ?? session.title,
                status: payload.status,
                errorCode: payload.errorCode ?? session.errorCode,
                diagnosticMessage:
                  payload.diagnosticMessage ?? session.diagnosticMessage,
                updatedAt: payload.occurredAt,
                lastActivatedAt: payload.occurredAt,
              }
            : session,
        ),
      );
      setActiveSessionId((current) => {
        if (current !== payload.browserSessionId) {
          return current;
        }
        if (payload.url) {
          setUrlDraft(payload.url);
        }
        const currentActiveSession = activeSessionRef.current;
        if (currentActiveSession) {
          const nextActiveSession = {
            ...currentActiveSession,
            url: payload.url ?? currentActiveSession.url,
            normalizedUrl: payload.url ?? currentActiveSession.normalizedUrl,
            title: payload.title ?? currentActiveSession.title,
            status: payload.status,
            errorCode: payload.errorCode ?? currentActiveSession.errorCode,
            diagnosticMessage:
              payload.diagnosticMessage ?? currentActiveSession.diagnosticMessage,
            updatedAt: payload.occurredAt,
            lastActivatedAt: payload.occurredAt,
          };
          setActiveBrowserContextSession(nextActiveSession, { rendererBound: true });
          onSessionChangeRef.current?.({ ...nextActiveSession });
        }
        return current;
      });
    }).then((unlisten) => {
      if (disposed) {
        unlisten();
        return;
      }
      cleanup = unlisten;
    }).catch((error: unknown) => {
      if (disposed) {
        return;
      }
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  const openSessionWindow = useCallback(async (session: BrowserSession, forceRemount = false) => {
    if (isEmbedded) {
      // 内嵌：子 webview 挂到容器矩形。bounds 为 null（首个会话 frame 尚未渲染）时
      // 由 useEmbeddedBrowserWebview 的 effect 在渲染后兜底 mount。
      const bounds = measureEmbeddedWebviewContainer(webviewContainerRef.current);
      if (bounds) {
        await showEmbeddedBrowserWebview(
          session.browserSessionId,
          bounds,
          forceRemount,
        );
      }
      setActiveBrowserContextSession(session, { rendererBound: true });
      return session;
    }
    try {
      const openedSession = await openBrowserAgentWindow(session.browserSessionId, i18n.language);
      setActiveBrowserContextSession(openedSession, { rendererBound: true });
      return openedSession;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedSession = await updateBrowserAgentSession({
        browserSessionId: session.browserSessionId,
        status: "failed",
        errorCode: "browser_window_open_failed",
        diagnosticMessage: message,
      });
      setActiveBrowserContextSession(failedSession, { rendererBound: false });
      throw error;
    }
  }, [i18n.language, isEmbedded]);

  const handleOpen = useCallback(async (nextUrl?: string) => {
    if (!resolvedEnabled || busy) {
      return;
    }
    const normalizedDraft = normalizeUrlDraft(nextUrl ?? urlDraft);
    if (!normalizedDraft) {
      setNotice({ kind: "warning", message: t("browserAgent.dock.emptyUrl") });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const validation = await validateBrowserAgentUrl(normalizedDraft, workspaceId);
      if (!validation.allowed || !validation.normalizedUrl) {
        setNotice({
          kind: "warning",
          message:
            validation.diagnostic?.message ?? t("browserAgent.dock.blockedUrl"),
        });
        return;
      }
      if (activeSession && nextUrl === undefined) {
        const preparedSession = await updateBrowserAgentSession({
          browserSessionId: activeSession.browserSessionId,
          workspaceId,
          url: validation.normalizedUrl,
          status: "loading",
          diagnosticMessage: null,
          errorCode: null,
        });
        const openedSession = await openSessionWindow(preparedSession, true);
        setActiveSessionId(openedSession.browserSessionId);
        setUrlDraft(validation.normalizedUrl);
        setSessions((current) =>
          current.map((item) =>
            item.browserSessionId === openedSession.browserSessionId
              ? openedSession
              : item,
          ),
        );
        setNotice({ kind: "info", message: t("browserAgent.dock.opened") });
        return;
      }
      const preparedSession = await createBrowserAgentSession({
        workspaceId,
        url: validation.normalizedUrl,
        ownerSurface,
      });
      const openedSession = await openSessionWindow(preparedSession);
      setActiveSessionId(openedSession.browserSessionId);
      setUrlDraft(validation.normalizedUrl);
      setSessions((current) => [
        openedSession,
        ...current.filter((item) => item.browserSessionId !== openedSession.browserSessionId),
      ]);
      setNotice({ kind: "info", message: t("browserAgent.dock.opened") });
    } catch (error) {
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  }, [
    activeSession,
    busy,
    ownerSurface,
    openSessionWindow,
    resolvedEnabled,
    t,
    urlDraft,
    workspaceId,
  ]);

  useEffect(() => {
    const consumePendingUrl = () => {
      if (!resolvedEnabled) {
        return;
      }
      const pendingUrl = window.sessionStorage.getItem(PENDING_BROWSER_URL_KEY);
      if (!pendingUrl) {
        return;
      }
      window.sessionStorage.removeItem(PENDING_BROWSER_URL_KEY);
      void handleOpen(pendingUrl);
    };
    consumePendingUrl();
    const handleOpenUrl = (event: Event) => {
      const detail = (event as CustomEvent<{ url?: string }>).detail;
      if (detail?.url) {
        if (!resolvedEnabled) {
          return;
        }
        window.sessionStorage.removeItem(PENDING_BROWSER_URL_KEY);
        void handleOpen(detail.url);
        return;
      }
      consumePendingUrl();
    };
    window.addEventListener(BROWSER_OPEN_URL_EVENT, handleOpenUrl);
    return () => {
      window.removeEventListener(BROWSER_OPEN_URL_EVENT, handleOpenUrl);
    };
  }, [handleOpen, resolvedEnabled]);

  const handleEnableBrowserAgent = useCallback(async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const settings = await getAppSettings();
      await updateAppSettings({
        ...settings,
        browserAgentEnabled: true,
        browserAgentPreferBuiltIn: true,
      });
      setStatusEnabled(true);
      setNotice({ kind: "info", message: t("browserAgent.dock.enabled") });
    } catch (error) {
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  }, [busy, t]);

  const handleActivateSession = useCallback(
    (session: BrowserSession) => {
      setActiveSessionId(session.browserSessionId);
      setUrlDraft(session.normalizedUrl);
      setNotice(null);
      setActiveBrowserContextSession(session, {
        rendererBound: false,
      });
      onSessionChangeRef.current?.(session);
      if (resolvedEnabled && session.status !== "closed") {
        void openSessionWindow(session)
          .then((openedSession) => {
            setSessions((current) =>
              current.map((item) =>
                item.browserSessionId === openedSession.browserSessionId
                  ? openedSession
                  : item,
              ),
            );
            onSessionChangeRef.current?.(openedSession);
          })
          .catch((error) => {
            setNotice({
              kind: "error",
              message: error instanceof Error ? error.message : String(error),
            });
          });
      }
    },
    [openSessionWindow, resolvedEnabled],
  );

  const handleCloseSession = useCallback(async (sessionId: string) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const closed = await closeBrowserAgentSession(sessionId);
      clearActiveBrowserContextSession(sessionId);
      if (isEmbedded) {
        // 注销内嵌子 webview 记录（Rust 侧 close 已按 renderer 绑定 hide，此处再兜底并清集合）
        unmountEmbeddedBrowserWebview(sessionId);
      }
      setSessions((current) =>
        current.map((session) =>
          session.browserSessionId === closed.browserSessionId ? closed : session,
        ),
      );
      const nextActive = openSessions.find(
        (session) => session.browserSessionId !== sessionId,
      ) ?? null;
      const shouldOpenNextSession = activeSessionId === sessionId && nextActive !== null;
      setActiveSessionId((current) => {
        if (current !== sessionId) {
          return current;
        }
        setUrlDraft(nextActive?.normalizedUrl ?? "");
        if (nextActive) {
          setActiveBrowserContextSession(nextActive, {
            rendererBound: false,
          });
        }
        onSessionChangeRef.current?.(nextActive);
        return nextActive?.browserSessionId ?? null;
      });
      if (shouldOpenNextSession) {
        void openSessionWindow(nextActive)
          .then((openedSession) => {
            setSessions((current) =>
              current.map((session) =>
                session.browserSessionId === openedSession.browserSessionId
                  ? openedSession
                  : session,
              ),
            );
            onSessionChangeRef.current?.(openedSession);
          })
          .catch((error) => {
            setNotice({
              kind: "error",
              message: error instanceof Error ? error.message : String(error),
            });
          });
      }
      setNotice({ kind: "info", message: t("browserAgent.dock.closed") });
    } catch (error) {
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  }, [activeSessionId, busy, isEmbedded, openSessionWindow, openSessions, t]);

  const handleCloseActiveSession = useCallback(async () => {
    if (!activeSession) {
      return;
    }
    await handleCloseSession(activeSession.browserSessionId);
  }, [activeSession, handleCloseSession]);

  // 弹出独立窗体：hide 内嵌子 webview 并注销挂载记录，当前会话移交浮动窗（含注入工具条）
  const handlePopOut = useCallback(async () => {
    if (!activeSession || busy) {
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      unmountEmbeddedBrowserWebview(activeSession.browserSessionId);
      const openedSession = await openBrowserAgentWindow(
        activeSession.browserSessionId,
        i18n.language,
      );
      setActiveBrowserContextSession(openedSession, { rendererBound: true });
      setNotice({ kind: "info", message: t("browserAgent.dock.opened") });
    } catch (error) {
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  }, [activeSession, busy, i18n.language, t]);

  return (
    <Card className={className} data-browser-agent-dock="true">
      <CardContent
        className={`browser-agent-dock-content${docked ? " is-docked" : ""}${resolvedEnabled ? "" : " is-disabled"}${isEmbedded ? " is-embedded p-0" : ""}`}
      >
        {docked ? null : isEmbedded ? (
          <BrowserDockEditorChrome
            workspaceId={workspaceId}
            openSessions={openSessions}
            activeSession={activeSession}
            activeSessionId={activeSessionId}
            busy={busy}
            resolvedEnabled={resolvedEnabled}
            notice={notice}
            urlDraft={urlDraft}
            onUrlDraftChange={setUrlDraft}
            onOpen={() => void handleOpen()}
            onActivateSession={handleActivateSession}
            onCloseSession={(sessionId) => void handleCloseSession(sessionId)}
            onNewTab={() => {
              setActiveSessionId(null);
              setUrlDraft("");
              onSessionChange?.(null);
            }}
            onPopOut={() => void handlePopOut()}
            onEnable={() => void handleEnableBrowserAgent()}
            onMinimize={() => setDocked(true)}
            setBusy={setBusy}
            setNotice={setNotice}
          />
        ) : (
          <div className="browser-agent-dock-island">
            <span className="browser-agent-dock-dot" aria-hidden />
            <div className="browser-agent-tab-track" role="tablist" aria-label={t("browserAgent.dock.tabs")}>
              {openSessions.map((session) => (
                <div
                  key={session.browserSessionId}
                  className={`browser-agent-tab${session.browserSessionId === activeSessionId ? " is-active" : ""}`}
                  role="presentation"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={session.browserSessionId === activeSessionId}
                    className="browser-agent-tab-main"
                    onClick={() => handleActivateSession(session)}
                    title={session.title || session.normalizedUrl}
                  >
                    <span className="browser-agent-tab-main-content">
                      <Globe size={12} aria-hidden />
                      <span className="browser-agent-tab-label">
                        {session.title || session.normalizedUrl}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="browser-agent-tab-close"
                    aria-label={t("browserAgent.dock.close")}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleCloseSession(session.browserSessionId);
                    }}
                    disabled={busy}
                  >
                    <X size={11} aria-hidden />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="browser-agent-tab-new"
                onClick={() => {
                  setActiveSessionId(null);
                  setUrlDraft("");
                  onSessionChange?.(null);
                }}
                aria-label={t("browserAgent.dock.newTab")}
              >
                <Plus size={14} aria-hidden />
              </Button>
            </div>
            {!resolvedEnabled ? (
              <Button type="button" className="browser-agent-dock-enable" onClick={() => void handleEnableBrowserAgent()} disabled={busy}>
                {busy ? t("browserAgent.dock.busy") : t("browserAgent.dock.enable")}
              </Button>
            ) : (
              <div className="browser-agent-dock-url-pill">
                <Input
                  className="browser-agent-dock-url-input"
                  value={urlDraft}
                  onChange={(event) => setUrlDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleOpen();
                    }
                  }}
                  placeholder="https://example.com"
                  disabled={!resolvedEnabled || busy}
                  aria-label="Browser Agent URL"
                />
                <Button
                  type="button"
                  className="browser-agent-dock-open"
                  onClick={() => void handleOpen()}
                  disabled={!resolvedEnabled || busy}
                >
                  {busy ? t("browserAgent.dock.busy") : t("browserAgent.dock.open")}
                </Button>
              </div>
            )}
            <Badge className="browser-agent-dock-status" variant={resolvedEnabled ? "default" : "outline"}>
              {resolvedEnabled ? statusLabel : t("browserAgent.dock.disabled")}
            </Badge>
            <Button
              type="button"
              variant="outline"
              className="browser-agent-dock-icon"
              onClick={() => void handleCloseActiveSession()}
              disabled={!activeSession || busy}
              aria-label={t("browserAgent.dock.close")}
            >
              <X size={14} aria-hidden />
            </Button>
            <span className="browser-agent-dock-info-wrap">
              <button
                type="button"
                className={`browser-agent-dock-info${notice ? ` is-${notice.kind}` : ""}`}
                aria-label={t("browserAgent.dock.info")}
                aria-expanded={infoOpen}
                onClick={() => setInfoOpen((current) => !current)}
              >
                {notice ? <AlertCircle size={14} aria-hidden /> : <Info size={14} aria-hidden />}
              </button>
              {infoOpen ? (
                <div className={`browser-agent-dock-popover${notice ? ` is-${notice.kind}` : ""}`} role="status">
                  {infoMessage.split("\n").map((line, index) => (
                    <p key={`${index}-${line}`}>{line}</p>
                  ))}
                </div>
              ) : null}
            </span>
            <button
              type="button"
              className="browser-agent-dock-icon browser-agent-dock-minimize"
              onClick={() => setDocked(true)}
              aria-label={t("browserAgent.dock.collapseDock")}
              title={t("browserAgent.dock.collapseDock")}
            >
              <Minus size={14} aria-hidden />
            </button>
          </div>
        )}
        {activeSession && resolvedEnabled ? (
          <div
            className="browser-agent-webview-frame"
            data-browser-agent-window-status="true"
            ref={webviewContainerRef}
          >
            <div className="browser-agent-webview-placeholder">
              <Globe size={18} aria-hidden />
              <span>{t("browserAgent.dock.windowOpened")}</span>
            </div>
          </div>
        ) : (
          <div className="browser-agent-webview-empty">
            {t("browserAgent.dock.noPage")}
          </div>
        )}
        {docked ? (
          <button
            type="button"
            className="browser-agent-dock-restore"
            onClick={() => setDocked(false)}
            aria-label={t("browserAgent.dock.expandDock")}
            title={t("browserAgent.dock.expandDock")}
          >
            <span
              className="browser-agent-dock-restore-seg is-status"
              title={resolvedEnabled ? statusLabel : t("browserAgent.dock.disabled")}
            >
              <span className="browser-agent-dock-dot" aria-hidden />
            </span>
            <span className="browser-agent-dock-restore-seg is-host">
              {activeSession?.title || activeSession?.normalizedUrl || t("browserAgent.dock.noPage")}
            </span>
            <span className="browser-agent-dock-restore-rest">
              <span className="browser-agent-dock-restore-count">
                {openSessions.length}
              </span>
              <span className="browser-agent-dock-restore-up">
                <ChevronUp size={12} aria-hidden />
              </span>
            </span>
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}
