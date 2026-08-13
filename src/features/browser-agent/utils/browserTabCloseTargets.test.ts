import { describe, expect, it } from "vitest";
import { resolveBrowserTabCloseTargets } from "./browserTabCloseTargets";

const SESSION_IDS = ["a", "b", "c"];

describe("resolveBrowserTabCloseTargets", () => {
  it("closes only the invoked tab", () => {
    expect(resolveBrowserTabCloseTargets(SESSION_IDS, "b", "current")).toEqual([
      "b",
    ]);
  });

  it("closes every tab except the invoked one", () => {
    expect(resolveBrowserTabCloseTargets(SESSION_IDS, "b", "others")).toEqual([
      "a",
      "c",
    ]);
  });

  it("closes tabs to the right of the invoked one", () => {
    expect(resolveBrowserTabCloseTargets(SESSION_IDS, "a", "right")).toEqual([
      "b",
      "c",
    ]);
    expect(resolveBrowserTabCloseTargets(SESSION_IDS, "c", "right")).toEqual([]);
  });

  it("closes every open tab", () => {
    expect(resolveBrowserTabCloseTargets(SESSION_IDS, "b", "all")).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("returns nothing when the invoked tab is gone", () => {
    expect(resolveBrowserTabCloseTargets(SESSION_IDS, "missing", "current")).toEqual(
      [],
    );
    expect(resolveBrowserTabCloseTargets(SESSION_IDS, "missing", "all")).toEqual([]);
  });
});
