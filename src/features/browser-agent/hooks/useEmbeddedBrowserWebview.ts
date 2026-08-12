import { useEffect, type RefObject } from "react";
import {
  hideBrowserAgentWebview,
  mountBrowserAgentWebview,
  syncBrowserAgentWebviewBounds,
} from "@/services/tauri";
import type { BrowserSession, BrowserWebviewBounds } from "../types";

// 已创建的 native 子 webview 记录：native 层存活于组件卸载/重挂载之外，
// 重挂载（如 centerMode 往返）只需 sync bounds 恢复显示，避免重复 mount 触发整页刷新。
const mountedEmbeddedSessions = new Set<string>();

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
 * 显示内嵌子 webview：已挂载则 sync bounds（含 show），未挂载则 mount 新建。
 * forceRemount 用于「同会话打开新 URL」——重建子 webview 完成导航
 * （与浮动窗 openBrowserAgentWindow 每次重建窗口的行为对齐）。
 */
export async function showEmbeddedBrowserWebview(
  browserSessionId: string,
  bounds: BrowserWebviewBounds,
  forceRemount = false,
): Promise<void> {
  if (!forceRemount && mountedEmbeddedSessions.has(browserSessionId)) {
    await syncBrowserAgentWebviewBounds(browserSessionId, bounds);
    return;
  }
  await mountBrowserAgentWebview({ browserSessionId, bounds });
  mountedEmbeddedSessions.add(browserSessionId);
}

/**
 * 隐藏并注销内嵌子 webview（弹出独立窗体 / 会话关闭时调用）。
 * 注销后下次内嵌显示会重新 mount，保证 renderer 绑定与页面内容最新。
 */
export function unmountEmbeddedBrowserWebview(browserSessionId: string): void {
  mountedEmbeddedSessions.delete(browserSessionId);
  void hideBrowserAgentWebview(browserSessionId).catch(() => {
    // webview 可能本就不存在（从未内嵌挂载），hide 容错路径忽略。
  });
}

/**
 * 内嵌模式的显隐与 bounds 同步纪律（native 子 webview 不受 CSS 隐藏管辖）：
 * - activeSession 切换：cleanup 隐藏旧会话，effect 显示新会话
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

  useEffect(() => {
    if (!active || !activeSessionId) {
      return;
    }
    const bounds = measureContainer(containerRef.current);
    if (bounds) {
      // 打开动作的报错由 openSessionWindow 链路呈现；此处静默避免双 notice。
      void showEmbeddedBrowserWebview(activeSessionId, bounds).catch(() => {});
    }
    return () => {
      void hideBrowserAgentWebview(activeSessionId).catch(() => {});
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
      const nextBounds = measureContainer(containerRef.current);
      if (!nextBounds || !mountedEmbeddedSessions.has(activeSessionId)) {
        return;
      }
      void syncBrowserAgentWebviewBounds(activeSessionId, nextBounds).catch(
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
