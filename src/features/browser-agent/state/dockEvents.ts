/**
 * 内嵌浏览器 dock 的窗口内事件契约。
 * 打开链路：先入 FIFO pending 队列（兜底，挂载晚于事件或 busy 时消费），
 * 再派发 BROWSER_OPEN_DOCK_EVENT（布局层开 dock 并切 chat 模式），
 * 最后派发 BROWSER_OPEN_URL_EVENT（已挂载的 BrowserDock 直接消费）。
 */
export const BROWSER_OPEN_DOCK_EVENT = "browser-agent:open-dock";
export const BROWSER_OPEN_URL_EVENT = "browser-agent:open-url";
/** 兼容旧单值读取；写入时同步队首。 */
export const PENDING_BROWSER_URL_KEY = "ccgui.browserAgent.pendingUrl";
export const PENDING_BROWSER_URLS_KEY = "ccgui.browserAgent.pendingUrls";

function readPendingBrowserUrls(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  const rawQueue = window.sessionStorage.getItem(PENDING_BROWSER_URLS_KEY);
  if (rawQueue) {
    try {
      const parsed: unknown = JSON.parse(rawQueue);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0,
        );
      }
    } catch {
      // 损坏的队列回退到旧单值 key。
    }
  }
  const legacy = window.sessionStorage.getItem(PENDING_BROWSER_URL_KEY);
  return legacy?.trim() ? [legacy] : [];
}

function writePendingBrowserUrls(urls: string[]): void {
  if (typeof window === "undefined") {
    return;
  }
  if (urls.length === 0) {
    window.sessionStorage.removeItem(PENDING_BROWSER_URLS_KEY);
    window.sessionStorage.removeItem(PENDING_BROWSER_URL_KEY);
    return;
  }
  window.sessionStorage.setItem(PENDING_BROWSER_URLS_KEY, JSON.stringify(urls));
  window.sessionStorage.setItem(PENDING_BROWSER_URL_KEY, urls[0] ?? "");
}

/** 追加一个待打开 URL；连点多个 HTML 时不得互相覆盖。 */
export function enqueuePendingBrowserUrl(url: string): void {
  const trimmed = url.trim();
  if (!trimmed) {
    return;
  }
  writePendingBrowserUrls([...readPendingBrowserUrls(), trimmed]);
}

/**
 * 取出待打开 URL。
 * 传入 url 时只移除该条（事件消费）；否则弹出队首（mount / busy 结束后 drain）。
 */
export function dequeuePendingBrowserUrl(url?: string): string | null {
  const queue = readPendingBrowserUrls();
  if (queue.length === 0) {
    return null;
  }
  if (url === undefined) {
    const next = queue.shift() ?? null;
    writePendingBrowserUrls(queue);
    return next;
  }
  const index = queue.indexOf(url);
  if (index < 0) {
    return null;
  }
  const [removed] = queue.splice(index, 1);
  writePendingBrowserUrls(queue);
  return removed ?? null;
}

/** 请求内嵌 dock 打开指定 URL（打开 dock + 投递 URL，含未挂载兜底）。 */
export function requestBrowserDockOpenUrl(url: string): void {
  enqueuePendingBrowserUrl(url);
  window.dispatchEvent(new CustomEvent(BROWSER_OPEN_DOCK_EVENT));
  window.dispatchEvent(
    new CustomEvent(BROWSER_OPEN_URL_EVENT, { detail: { url } }),
  );
}
