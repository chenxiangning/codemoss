import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildLocalFileUrl,
  formatOpenHtmlInBrowserError,
  isHtmlFilePath,
  openHtmlInBrowser,
  resolveOpenHtmlInBrowserErrorKind,
} from "./openHtmlInBrowser";

const createBrowserAgentSessionMock = vi.fn();
const openBrowserAgentWindowMock = vi.fn();

vi.mock("../../../services/tauri", () => ({
  createBrowserAgentSession: (...args: unknown[]) =>
    createBrowserAgentSessionMock(...args),
  openBrowserAgentWindow: (...args: unknown[]) =>
    openBrowserAgentWindowMock(...args),
}));

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
    createBrowserAgentSessionMock.mockReset();
    openBrowserAgentWindowMock.mockReset();
    createBrowserAgentSessionMock.mockResolvedValue({
      browserSessionId: "session-1",
    });
    openBrowserAgentWindowMock.mockResolvedValue({
      browserSessionId: "session-1",
    });
  });

  it("opens the encoded file:// URL via built-in Browser Agent", async () => {
    await openHtmlInBrowser("/repo/docs/demo.html", {
      workspaceId: "ws-1",
      ownerSurface: "file-view",
    });
    expect(createBrowserAgentSessionMock).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      url: "file:///repo/docs/demo.html",
      ownerSurface: "file-view",
    });
    expect(openBrowserAgentWindowMock).toHaveBeenCalledWith("session-1", null);
  });

  it("requires workspaceId", async () => {
    await expect(
      openHtmlInBrowser("/repo/a.html", { workspaceId: "  " }),
    ).rejects.toThrow(/workspaceId is required/);
    expect(createBrowserAgentSessionMock).not.toHaveBeenCalled();
  });

  it("propagates Browser Agent failures", async () => {
    createBrowserAgentSessionMock.mockRejectedValue(new Error("blocked"));
    await expect(
      openHtmlInBrowser("/repo/a.html", { workspaceId: "ws-1" }),
    ).rejects.toThrow("blocked");
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
