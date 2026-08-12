/**
 * 内嵌浏览器 dock 的窗口内事件契约。
 * 打开链路：先写 PENDING_BROWSER_URL_KEY（兜底，挂载晚于事件时消费），
 * 再派发 BROWSER_OPEN_DOCK_EVENT（布局层开 dock 并切 chat 模式），
 * 最后派发 BROWSER_OPEN_URL_EVENT（已挂载的 BrowserDock 直接消费）。
 */
export const BROWSER_OPEN_DOCK_EVENT = "browser-agent:open-dock";
export const BROWSER_OPEN_URL_EVENT = "browser-agent:open-url";
export const PENDING_BROWSER_URL_KEY = "ccgui.browserAgent.pendingUrl";

/** 请求内嵌 dock 打开指定 URL（打开 dock + 投递 URL，含未挂载兜底）。 */
export function requestBrowserDockOpenUrl(url: string): void {
  window.sessionStorage.setItem(PENDING_BROWSER_URL_KEY, url);
  window.dispatchEvent(new CustomEvent(BROWSER_OPEN_DOCK_EVENT));
  window.dispatchEvent(
    new CustomEvent(BROWSER_OPEN_URL_EVENT, { detail: { url } }),
  );
}
