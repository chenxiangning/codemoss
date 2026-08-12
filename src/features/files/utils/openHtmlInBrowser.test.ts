// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildLocalFileUrl,
  formatOpenHtmlInBrowserError,
  isHtmlFilePath,
  openHtmlInBrowser,
  resolveOpenHtmlInBrowserErrorKind,
} from "./openHtmlInBrowser";
import {
  BROWSER_OPEN_DOCK_EVENT,
  BROWSER_OPEN_URL_EVENT,
  PENDING_BROWSER_URL_KEY,
} from "../../browser-agent/state/dockEvents";

describe("isHtmlFilePath", () => {
  it("accepts .html and .htm regardless of case", () => {
    expect(isHtmlFilePath("index.html")).toBe(true);
    expect(isHtmlFilePath("docs/Page.HTM")).toBe(true);
    expect(isHtmlFilePath("C:\\site\\App.HTML")).toBe(true);
  });

  it("rejects non-html extensions and empty paths", () => {
    expect(isHtmlFilePath("readme.md")).toBe(false);
    expect(isHtmlFilePath("index.html.bak")).toBe(false);
    expect(isHtmlFilePath("")).toBe(false);
    expect(isHtmlFilePath("   ")).toBe(false);
  });
});

describe("buildLocalFileUrl", () => {
  it("builds POSIX file URLs", () => {
    expect(buildLocalFileUrl("/Users/me/site/index.html")).toBe(
      "file:///Users/me/site/index.html",
    );
  });

  it("builds Windows drive-letter file URLs", () => {
    expect(buildLocalFileUrl("C:\\Users\\me\\site\\index.html")).toBe(
      "file:///C:/Users/me/site/index.html",
    );
  });

  it("encodes spaces, Chinese characters, and URL-significant chars", () => {
    expect(buildLocalFileUrl("/Users/me/my site/测试.html")).toBe(
      "file:///Users/me/my%20site/%E6%B5%8B%E8%AF%95.html",
    );
    expect(buildLocalFileUrl("C:/docs/a#b?.html")).toBe(
      "file:///C:/docs/a%23b%3F.html",
    );
  });
});

describe("openHtmlInBrowser", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("routes the encoded file:// URL to the embedded dock event chain", async () => {
    const events: Array<{ type: string; url?: string }> = [];
    const record = (type: string) => (event: Event) => {
      events.push({
        type,
        url: (event as CustomEvent<{ url?: string }>).detail?.url,
      });
    };
    const recordOpenDock = record(BROWSER_OPEN_DOCK_EVENT);
    const recordOpenUrl = record(BROWSER_OPEN_URL_EVENT);
    window.addEventListener(BROWSER_OPEN_DOCK_EVENT, recordOpenDock);
    window.addEventListener(BROWSER_OPEN_URL_EVENT, recordOpenUrl);
    try {
      await openHtmlInBrowser("/repo/docs/demo.html", { workspaceId: "ws-1" });
    } finally {
      window.removeEventListener(BROWSER_OPEN_DOCK_EVENT, recordOpenDock);
      window.removeEventListener(BROWSER_OPEN_URL_EVENT, recordOpenUrl);
    }

    expect(events).toEqual([
      { type: BROWSER_OPEN_DOCK_EVENT, url: undefined },
      { type: BROWSER_OPEN_URL_EVENT, url: "file:///repo/docs/demo.html" },
    ]);
    // 兜底：dock 尚未挂载时由 BrowserDock 挂载后消费 pending URL
    expect(window.sessionStorage.getItem(PENDING_BROWSER_URL_KEY)).toBe(
      "file:///repo/docs/demo.html",
    );
  });

  it("requires workspaceId", async () => {
    await expect(
      openHtmlInBrowser("/repo/a.html", { workspaceId: "  " }),
    ).rejects.toThrow(/workspaceId is required/);
    expect(window.sessionStorage.getItem(PENDING_BROWSER_URL_KEY)).toBeNull();
  });
});

describe("resolveOpenHtmlInBrowserErrorKind / formatOpenHtmlInBrowserError", () => {
  const t = (key: string) => key;

  it("maps window-already-exists to window-busy", () => {
    const error = new Error(
      "Failed to open Browser Agent window: a webview with label `browser-agent-window` already exists",
    );
    expect(resolveOpenHtmlInBrowserErrorKind(error)).toBe("window-busy");
    expect(formatOpenHtmlInBrowserError(error, t)).toBe(
      "files.openInBrowserWindowBusy",
    );
  });

  it("maps missing workspaceId to no-workspace", () => {
    expect(
      resolveOpenHtmlInBrowserErrorKind(
        new Error("workspaceId is required to open HTML in the built-in browser"),
      ),
    ).toBe("no-workspace");
  });

  it("maps blocked policy errors to blocked", () => {
    expect(
      resolveOpenHtmlInBrowserErrorKind(new Error("URL blocked_file_type")),
    ).toBe("blocked");
  });

  it("falls back to failed without leaking raw text", () => {
    const error = new Error("browser missing internal detail xyz");
    expect(resolveOpenHtmlInBrowserErrorKind(error)).toBe("failed");
    expect(formatOpenHtmlInBrowserError(error, t)).toBe(
      "files.openInBrowserFailed",
    );
    expect(formatOpenHtmlInBrowserError(error, t)).not.toContain("xyz");
  });
});
