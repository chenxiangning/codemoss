import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Crosshair from "lucide-react/dist/esm/icons/crosshair";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Globe from "lucide-react/dist/esm/icons/globe";
import Link2 from "lucide-react/dist/esm/icons/link-2";
import Minus from "lucide-react/dist/esm/icons/minus";
import Plus from "lucide-react/dist/esm/icons/plus";
import X from "lucide-react/dist/esm/icons/x";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  startBrowserAgentElementSelect,
  stopBrowserAgentElementSelect,
} from "@/services/tauri";
import type { BrowserSession } from "../types";
import { requestBrowserContextAttachment } from "../state/browserContextAttachmentCommands";

const BROWSER_ELEMENT_SELECT_ENDED_EVENT = "browser-agent://element-select-ended";

type TauriInternalsWindow = Window & {
  __TAURI_INTERNALS__?: {
    transformCallback?: unknown;
  };
};

function hasTauriEventBridge(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return typeof (window as TauriInternalsWindow).__TAURI_INTERNALS__?.transformCallback === "function";
}

export type BrowserDockNotice = {
  kind: "info" | "warning" | "error";
  message: string;
};

/** 编辑器标签模式的 tab 文案：取 hostname（file:// 等无 host 时回退完整 URL，由 CSS 截断）。 */
function sessionHostLabel(session: BrowserSession): string {
  try {
    const hostname = new URL(session.normalizedUrl).hostname;
    return hostname || session.normalizedUrl;
  } catch {
    return session.normalizedUrl;
  }
}

/** tab 状态点：ready 绿 / loading 黄 / 异常红 / 其余灰。 */
function sessionStatusDotClass(session: BrowserSession): string {
  if (session.status === "ready") {
    return "is-ready";
  }
  if (session.status === "loading") {
    return "is-loading";
  }
  if (session.status === "failed" || session.status === "blocked") {
    return "is-attention";
  }
  return "is-idle";
}

type BrowserDockEditorChromeProps = {
  workspaceId: string;
  openSessions: BrowserSession[];
  activeSession: BrowserSession | null;
  activeSessionId: string | null;
  busy: boolean;
  resolvedEnabled: boolean;
  notice: BrowserDockNotice | null;
  urlDraft: string;
  onUrlDraftChange: (value: string) => void;
  onOpen: () => void;
  onActivateSession: (session: BrowserSession) => void;
  onCloseSession: (sessionId: string) => void;
  onNewTab: () => void;
  onPopOut: () => void;
  onEnable: () => void;
  onMinimize: () => void;
  setBusy: (busy: boolean) => void;
  setNotice: (notice: BrowserDockNotice | null) => void;
};

/**
 * 内嵌模式的编辑器标签 chrome：顶栏只留 tab，地址行沉底且仅 icon 操作。
 * floating 模式的悬浮岛不经过此组件。
 */
export function BrowserDockEditorChrome({
  workspaceId,
  openSessions,
  activeSession,
  activeSessionId,
  busy,
  resolvedEnabled,
  notice,
  urlDraft,
  onUrlDraftChange,
  onOpen,
  onActivateSession,
  onCloseSession,
  onNewTab,
  onPopOut,
  onEnable,
  onMinimize,
  setBusy,
  setNotice,
}: BrowserDockEditorChromeProps) {
  const { t } = useTranslation();
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const [elementSelectArmed, setElementSelectArmed] = useState(false);

  // ⌘L / Ctrl+L 聚焦地址栏（浏览器肌肉记忆；组件仅在内嵌展开态挂载）
  useEffect(() => {
    const handleFocusUrlShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "l") {
        event.preventDefault();
        urlInputRef.current?.focus();
        urlInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleFocusUrlShortcut);
    return () => {
      window.removeEventListener("keydown", handleFocusUrlShortcut);
    };
  }, []);

  useEffect(() => {
    setElementSelectArmed(false);
  }, [activeSessionId]);

  useEffect(() => {
    if (!hasTauriEventBridge()) {
      return;
    }
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<{ browserSessionId?: string }>(
      BROWSER_ELEMENT_SELECT_ENDED_EVENT,
      (event) => {
        const endedSessionId = event.payload?.browserSessionId;
        if (!endedSessionId || endedSessionId === activeSessionId) {
          setElementSelectArmed(false);
        }
      },
    ).then((fn) => {
      if (disposed) {
        fn();
        return;
      }
      unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [activeSessionId]);

  // 关联浏览器上下文：主窗口内本地 listener 直达 Composer（与浮动窗注入工具条同一事件通道）
  const handleAttachContext = useCallback(() => {
    if (!activeSession || busy) {
      return;
    }
    requestBrowserContextAttachment({
      workspaceId,
      browserSessionId: activeSession.browserSessionId,
    });
  }, [activeSession, busy, workspaceId]);

  // 选择网页元素：再点一次走 stop，只 cleanup，不再重新注入选择器
  const handleToggleElementSelect = useCallback(async () => {
    if (!activeSession || busy) {
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      if (elementSelectArmed) {
        await stopBrowserAgentElementSelect(activeSession.browserSessionId);
        setElementSelectArmed(false);
      } else {
        await startBrowserAgentElementSelect(activeSession.browserSessionId);
        setElementSelectArmed(true);
      }
    } catch (error) {
      setElementSelectArmed(false);
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  }, [activeSession, busy, elementSelectArmed, setBusy, setNotice]);

  const sessionActionsDisabled = !activeSession || busy;

  return (
    <>
      <div className="browser-agent-editor-tabbar">
        <div className="browser-agent-tab-track" role="tablist" aria-label={t("browserAgent.dock.tabs")}>
          {openSessions.map((session) => (
            <div
              key={session.browserSessionId}
              className={`browser-agent-tab browser-agent-editor-tab${session.browserSessionId === activeSessionId ? " is-active" : ""}`}
              role="presentation"
            >
              <button
                type="button"
                role="tab"
                aria-selected={session.browserSessionId === activeSessionId}
                className="browser-agent-tab-main"
                onClick={() => onActivateSession(session)}
                title={session.title || session.normalizedUrl}
              >
                <span className="browser-agent-tab-main-content">
                  <span className="browser-agent-editor-tab-avatar" aria-hidden>
                    {sessionHostLabel(session).charAt(0).toUpperCase() || "?"}
                  </span>
                  <span className="browser-agent-tab-label">
                    {sessionHostLabel(session)}
                  </span>
                  <span
                    className={`browser-agent-editor-tab-status ${sessionStatusDotClass(session)}`}
                    aria-hidden
                  />
                </span>
              </button>
              <button
                type="button"
                className="browser-agent-tab-close"
                aria-label={t("browserAgent.dock.close")}
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseSession(session.browserSessionId);
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
            onClick={onNewTab}
            aria-label={t("browserAgent.dock.newTab")}
          >
            <Plus size={14} aria-hidden />
          </Button>
        </div>
      </div>
      <div className="browser-agent-editor-urlbar">
        {!resolvedEnabled ? (
          <Button type="button" className="browser-agent-dock-enable" onClick={onEnable} disabled={busy}>
            {busy ? t("browserAgent.dock.busy") : t("browserAgent.dock.enable")}
          </Button>
        ) : (
          <div className="browser-agent-editor-url-row">
            <Globe size={14} aria-hidden className="browser-agent-editor-url-icon" />
            <Input
              ref={urlInputRef}
              unstyled
              className="browser-agent-editor-url-input"
              value={urlDraft}
              onChange={(event) => onUrlDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onOpen();
                }
              }}
              placeholder="https://example.com"
              disabled={!resolvedEnabled || busy}
              aria-invalid={notice?.kind === "error" || notice?.kind === "warning"}
              aria-label="Browser Agent URL"
              title={notice?.message}
            />
          </div>
        )}
        <div className="browser-agent-editor-urlbar-side">
          <button
            type="button"
            className="browser-agent-dock-icon"
            onClick={onOpen}
            disabled={!resolvedEnabled || busy}
            aria-label={t("browserAgent.dock.open")}
            title={`${t("browserAgent.dock.open")} (⌘L)`}
          >
            <ArrowRight size={14} aria-hidden />
          </button>
          <button
            type="button"
            className="browser-agent-dock-icon"
            onClick={handleAttachContext}
            disabled={sessionActionsDisabled}
            aria-label={t("browserAgent.dock.attachContext")}
            title={t("browserAgent.dock.attachContext")}
          >
            <Link2 size={14} aria-hidden />
          </button>
          <button
            type="button"
            className={`browser-agent-dock-icon${elementSelectArmed ? " is-on" : ""}`}
            onClick={() => void handleToggleElementSelect()}
            disabled={sessionActionsDisabled}
            aria-pressed={elementSelectArmed}
            aria-label={
              elementSelectArmed
                ? t("browserAgent.dock.cancelSelectElement")
                : t("browserAgent.dock.selectElement")
            }
            title={
              elementSelectArmed
                ? t("browserAgent.dock.cancelSelectElement")
                : t("browserAgent.dock.selectElement")
            }
          >
            <Crosshair size={14} aria-hidden />
          </button>
          <button
            type="button"
            className="browser-agent-dock-icon"
            onClick={onPopOut}
            disabled={sessionActionsDisabled}
            aria-label={t("browserAgent.dock.popOutWindow")}
            title={t("browserAgent.dock.popOutWindow")}
          >
            <ExternalLink size={14} aria-hidden />
          </button>
          <button
            type="button"
            className="browser-agent-dock-icon"
            onClick={onMinimize}
            aria-label={t("browserAgent.dock.collapseDock")}
            title={t("browserAgent.dock.collapseDock")}
          >
            <Minus size={14} aria-hidden />
          </button>
        </div>
      </div>
    </>
  );
}
