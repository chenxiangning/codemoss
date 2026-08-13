import { useEffect, useRef, type RefObject } from "react";
import {
  hideBrowserAgentWebview,
  mountBrowserAgentWebview,
  syncBrowserAgentWebviewBounds,
} from "@/services/tauri";
import type { BrowserSession, BrowserWebviewBounds } from "../types";

// Browser Dock 的 tab 是 session 数据，不是 native WebView 实例。内嵌模式只维护一个
// renderer，并把它导航到当前 tab；否则多个 child WebView 会在同一矩形互相覆盖。
let embeddedRendererMounted = false;
let renderedEmbeddedSessionId: string | null = null;

// 当前期望可见的 session。native renderer 的 mount / sync / hide 会影响同一块 surface，
// 因此必须由同一串行队列执行；不能只在 Promise 返回后丢弃旧结果。
let desiredVisibleSessionId: string | null = null;
let nativeVisibilityOperation = Promise.resolve();

function enqueueNativeVisibilityOperation(
  operation: () => Promise<void>,
): Promise<void> {
  const scheduled = nativeVisibilityOperation.then(operation, operation);
  // 某次 mount 失败不应阻断后续 tab 的恢复操作。
  nativeVisibilityOperation = scheduled.catch(() => {});
  return scheduled;
}

function measureContainer(
  container: HTMLElement | null,
): BrowserWebviewBounds | null {
  if (!container) {
    return null;
  }
  const rect = container.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) {
    return null;
  }
  // CSS px 与 Tauri logical px 一致（无页面缩放），可直接作为子 webview bounds。
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

/**
 * 显示内嵌 renderer：切换 tab 或打开新 URL 时调用 mount，让 native 侧导航到目标 session；
 * 仅 bounds 变化时走 sync，避免同一页面无意义导航。
 */
export async function showEmbeddedBrowserWebview(
  browserSessionId: string,
  bounds: BrowserWebviewBounds,
  forceRemount = false,
): Promise<void> {
  desiredVisibleSessionId = browserSessionId;
  return enqueueNativeVisibilityOperation(async () => {
    // 队列中的旧 tab 已被新的激活意图取代，不得再碰 native surface。
    if (desiredVisibleSessionId !== browserSessionId) {
      return;
    }
    try {
      const needsNavigation =
        forceRemount ||
        !embeddedRendererMounted ||
        renderedEmbeddedSessionId !== browserSessionId;
      if (needsNavigation) {
        await mountBrowserAgentWebview({ browserSessionId, bounds });
        embeddedRendererMounted = true;
        renderedEmbeddedSessionId = browserSessionId;
      } else {
        await syncBrowserAgentWebviewBounds(browserSessionId, bounds);
      }
    } catch (error) {
      // 旧请求失败不应把已经选中的新 tab 误标为失败。
      if (desiredVisibleSessionId === browserSessionId) {
        throw error;
      }
      return;
    }
  });
}

/** 仅当该 session 不再是期望可见页时才 hide，避免卸载/切 tab 的过期 cleanup 把刚 show 的页藏掉。 */
export function requestHideEmbeddedBrowserWebview(browserSessionId: string): void {
  if (desiredVisibleSessionId === browserSessionId) {
    desiredVisibleSessionId = null;
  }
  void enqueueNativeVisibilityOperation(async () => {
    // 已重新激活或已切换到其它 tab 时，过期 cleanup 不能触碰当前 renderer。
    if (
      desiredVisibleSessionId === browserSessionId ||
      renderedEmbeddedSessionId !== browserSessionId
    ) {
      return;
    }
    await hideBrowserAgentWebview(browserSessionId);
  }).catch(() => {});
}

/**
 * 隐藏并注销内嵌子 webview（弹出独立窗体 / 会话关闭时调用）。
 * 注销后下次内嵌显示会重新 mount，保证 renderer 绑定与页面内容最新。
 */
export function unmountEmbeddedBrowserWebview(browserSessionId: string): void {
  const rendererBelongsToSession =
    renderedEmbeddedSessionId === browserSessionId;
  if (desiredVisibleSessionId === browserSessionId) {
    desiredVisibleSessionId = null;
  }
  if (!rendererBelongsToSession) {
    requestHideEmbeddedBrowserWebview(browserSessionId);
    return;
  }

  embeddedRendererMounted = false;
  renderedEmbeddedSessionId = null;
  void enqueueNativeVisibilityOperation(async () => {
    // 若关闭动作尚未执行时又回到同一 tab，新的 show 优先，不能把它藏掉。
    if (desiredVisibleSessionId === browserSessionId) {
      return;
    }
    await hideBrowserAgentWebview(browserSessionId);
  }).catch(() => {});
}

/**
 * 内嵌模式的显隐与 bounds 同步纪律（native 子 webview 不受 CSS 隐藏管辖）：
 * - activeSession 切换：当前 renderer 直接导航到新会话，旧 tab 不保留 native 实例
 * - 容器/窗口尺寸变化（含 split 拖拽）：ResizeObserver 单点收敛 sync bounds
 * - 组件卸载（关 dock / 离开 chat mode）：cleanup 兜底隐藏，webview 本体保留以便秒回
 */
export function useEmbeddedBrowserWebview({
  containerRef,
  activeSession,
  active,
}: {
  containerRef: RefObject<HTMLElement | null>;
  activeSession: BrowserSession | null;
  active: boolean;
}): void {
  const activeSessionId = activeSession?.browserSessionId ?? null;
  const latestActiveSessionIdRef = useRef(activeSessionId);
  const visibilityLifecycleVersionRef = useRef(0);
  const lastVisibleSessionIdRef = useRef<string | null>(null);
  latestActiveSessionIdRef.current = activeSessionId;

  useEffect(() => {
    const lifecycleVersion = ++visibilityLifecycleVersionRef.current;
    if (!active || !activeSessionId) {
      const previousSessionId = lastVisibleSessionIdRef.current;
      if (previousSessionId) {
        requestHideEmbeddedBrowserWebview(previousSessionId);
        lastVisibleSessionIdRef.current = null;
      }
      return;
    }
    lastVisibleSessionIdRef.current = activeSessionId;
    const bounds = measureContainer(containerRef.current);
    if (bounds) {
      // 打开动作的报错由 openSessionWindow 链路呈现；此处静默避免双 notice。
      void showEmbeddedBrowserWebview(activeSessionId, bounds).catch(() => {});
    }
    return () => {
      // dependency 切换时，React 会先执行旧 cleanup 再建立新 effect。延后一轮后只有
      // 生命周期没有被新 tab 接管（组件卸载 / Dock 失活）才真的 hide。
      queueMicrotask(() => {
        if (visibilityLifecycleVersionRef.current === lifecycleVersion) {
          requestHideEmbeddedBrowserWebview(activeSessionId);
        }
      });
    };
  }, [active, activeSessionId, containerRef]);

  useEffect(() => {
    if (!active || !activeSessionId) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const syncBounds = () => {
      // ResizeObserver 可能在 effect cleanup 后投递旧回调；它只能同步当前 tab，
      // 否则旧 tab 会重新写入 native renderer binding 并遮住新页面。
      if (latestActiveSessionIdRef.current !== activeSessionId) {
        return;
      }
      const nextBounds = measureContainer(containerRef.current);
      if (!nextBounds) {
        return;
      }
      if (
        desiredVisibleSessionId !== null &&
        desiredVisibleSessionId !== activeSessionId
      ) {
        return;
      }
      // 首帧 bounds 为空时 effect 会跳过 mount；尺寸就绪后在同一协调器补一次 show。
      void showEmbeddedBrowserWebview(activeSessionId, nextBounds).catch(
        () => {},
      );
    };
    const observer = new ResizeObserver(syncBounds);
    observer.observe(container);
    window.addEventListener("resize", syncBounds);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncBounds);
    };
  }, [active, activeSessionId, containerRef]);
}

export { measureContainer as measureEmbeddedWebviewContainer };
