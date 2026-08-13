import { describe, expect, it } from "vitest";
import { resolveBrowserTabLabel } from "./browserTabLabel";

describe("resolveBrowserTabLabel", () => {
  it("prefers a real page title over the raw url", () => {
    expect(
      resolveBrowserTabLabel({
        title: "幕布场景示例",
        normalizedUrl: "file:///Users/demo/docs/file-edit-collapse-demo.html",
      }),
    ).toBe("幕布场景示例");
  });

  it("uses the last filename for local html when title is missing or url-like", () => {
    expect(
      resolveBrowserTabLabel({
        title: "file:///Users/demo/docs/file-edit-collapse-demo.html",
        normalizedUrl: "file:///Users/demo/docs/file-edit-collapse-demo.html",
      }),
    ).toBe("file-edit-collapse-demo.html");
    expect(
      resolveBrowserTabLabel({
        title: "",
        url: "file:///Users/chenxiangning/code/%E5%86%85%E5%AE%B9/docs/intro.html",
      }),
    ).toBe("intro.html");
  });

  it("uses the last path file for http html when title is missing", () => {
    expect(
      resolveBrowserTabLabel({
        title: "",
        normalizedUrl: "https://one.example/path/page.html",
      }),
    ).toBe("page.html");
  });

  it("falls back to hostname for site roots without a title", () => {
    expect(
      resolveBrowserTabLabel({
        title: "",
        normalizedUrl: "https://one.example/",
      }),
    ).toBe("one.example");
  });
});
