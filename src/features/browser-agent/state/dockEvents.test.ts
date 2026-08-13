/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import {
  dequeuePendingBrowserUrl,
  enqueuePendingBrowserUrl,
  PENDING_BROWSER_URL_KEY,
  PENDING_BROWSER_URLS_KEY,
  requestBrowserDockOpenUrl,
} from "./dockEvents";

describe("pending browser URL queue", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("keeps every queued URL instead of overwriting the last one", () => {
    enqueuePendingBrowserUrl("file:///a.html");
    enqueuePendingBrowserUrl("file:///b.html");
    enqueuePendingBrowserUrl("file:///c.html");

    expect(window.sessionStorage.getItem(PENDING_BROWSER_URL_KEY)).toBe(
      "file:///a.html",
    );
    expect(JSON.parse(window.sessionStorage.getItem(PENDING_BROWSER_URLS_KEY) ?? "[]")).toEqual([
      "file:///a.html",
      "file:///b.html",
      "file:///c.html",
    ]);
    expect(dequeuePendingBrowserUrl()).toBe("file:///a.html");
    expect(dequeuePendingBrowserUrl()).toBe("file:///b.html");
    expect(dequeuePendingBrowserUrl("file:///c.html")).toBe("file:///c.html");
    expect(dequeuePendingBrowserUrl()).toBeNull();
    expect(window.sessionStorage.getItem(PENDING_BROWSER_URL_KEY)).toBeNull();
  });

  it("does not dequeue a URL that was already consumed", () => {
    enqueuePendingBrowserUrl("file:///a.html");
    expect(dequeuePendingBrowserUrl("file:///a.html")).toBe("file:///a.html");
    expect(dequeuePendingBrowserUrl("file:///a.html")).toBeNull();
  });

  it("enqueues on requestBrowserDockOpenUrl so late dock mount can drain", () => {
    requestBrowserDockOpenUrl("file:///one.html");
    requestBrowserDockOpenUrl("file:///two.html");
    expect(dequeuePendingBrowserUrl()).toBe("file:///one.html");
    expect(dequeuePendingBrowserUrl()).toBe("file:///two.html");
  });
});
