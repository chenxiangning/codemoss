import { describe, expect, it } from "vitest";
import type { BrowserUserAnnotation } from "../types";
import {
  dedupeBrowserUserAnnotations,
  upsertBrowserUserAnnotation,
} from "./browserSelectionIdentity";

function annotation(
  annotationId: string,
  text: string,
  selectorHint = "p",
): BrowserUserAnnotation {
  return {
    annotationId,
    observationId: "obs-1",
    browserSessionId: "session-1",
    workspaceId: "workspace-1",
    createdAt: Number(annotationId.replace(/\D/g, "") || 1),
    url: "https://example.com/",
    title: "Example",
    anchor: "element",
    userNote: text,
    viewport: {
      width: 1280,
      height: 720,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 2,
    },
    region: {
      x: 10,
      y: 20,
      width: 100,
      height: 24,
    },
    nearbyText: text,
    nearestElement: {
      role: "paragraph",
      label: text,
      placeholder: null,
      hrefOrigin: null,
      selectorHint,
      sensitive: false,
    },
    privacy: {
      redactionApplied: false,
      redactedKinds: [],
      omittedKinds: [],
    },
    staleReasons: [],
    diagnostics: [],
  };
}

describe("browserSelectionIdentity", () => {
  it("keeps one row when the same excerpt is upserted again", () => {
    const first = annotation("selection-1", "assets/icons.svg 移除", "li");
    const second = annotation("selection-2", "assets/icons.svg 移除", "li");

    expect(upsertBrowserUserAnnotation([first], second)).toEqual([second]);
  });

  it("keeps different excerpts even when they share a generic tag", () => {
    const paragraph = annotation("selection-1", "一段正文B", "p");
    const heading = annotation("selection-2", "文件修改 (2 个)", "button");

    expect(
      upsertBrowserUserAnnotation([paragraph], heading).map((item) => item.userNote),
    ).toEqual(["一段正文B", "文件修改 (2 个)"]);
  });

  it("drops already stored duplicate clicks when rendering", () => {
    const unique = dedupeBrowserUserAnnotations([
      annotation("selection-1", "一段正文B", "p"),
      annotation("selection-2", "一段正文B", "p"),
      annotation("selection-3", "assets/icons.svg 移除", "li"),
      annotation("selection-4", "assets/icons.svg 移除", "li"),
    ]);

    expect(unique.map((item) => item.userNote)).toEqual([
      "一段正文B",
      "assets/icons.svg 移除",
    ]);
  });
});
