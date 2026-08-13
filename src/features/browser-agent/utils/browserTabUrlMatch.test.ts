import { describe, expect, it } from "vitest";
import { urlsPointToSameBrowserResource } from "./browserTabUrlMatch";

describe("urlsPointToSameBrowserResource", () => {
  it("treats encoded and decoded file URLs as the same page", () => {
    expect(
      urlsPointToSameBrowserResource(
        "file:///Users/demo/%E5%86%85%E5%AE%B9/docs/a.html",
        "file:///Users/demo/内容/docs/a.html",
      ),
    ).toBe(true);
  });

  it("ignores a trailing slash", () => {
    expect(
      urlsPointToSameBrowserResource("https://one.example/", "https://one.example"),
    ).toBe(true);
  });

  it("distinguishes different files", () => {
    expect(
      urlsPointToSameBrowserResource("file:///tmp/a.html", "file:///tmp/b.html"),
    ).toBe(false);
  });
});
