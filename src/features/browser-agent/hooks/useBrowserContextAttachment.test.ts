import { describe, expect, it } from "vitest";
import { buildBrowserContextAttachment } from "../utils";
import type {
  BrowserContextSnapshot,
  BrowserSelectedElementEvidence,
} from "../types";
import { appendSelectedElementAnnotation } from "./useBrowserContextAttachment";

function makeSnapshot(snapshotId: string): BrowserContextSnapshot {
  return {
    snapshotId,
    browserSessionId: "browser-session-1",
    workspaceId: "workspace-1",
    capturedAt: 1000,
    freshness: "fresh",
    source: {
      url: "https://ai.17nas.com/tools/codex-iq/",
      normalizedUrl: "https://ai.17nas.com/tools/codex-iq/",
      title: "Codex GPT 模型降智雷达",
      origin: "https://ai.17nas.com",
      tabLabel: "Codex GPT 模型降智雷达",
      captureReason: "manual_attach",
      workspaceLocalAllowed: false,
    },
    viewport: {
      width: 2048,
      height: 920,
      scrollX: 0,
      scrollY: 0,
      scrollHeight: 1400,
      scrollWidth: 2048,
      devicePixelRatio: 2,
    },
    page: {
      visibleText: "LATEST DETECTION · hidden full page summary",
      pageType: "dashboard",
      primaryContent: null,
      readableBlocks: [],
      noiseDiagnostics: [],
      visualEvidence: [],
      textTruncated: false,
      headings: [],
      landmarks: [],
      elementLandmarks: [],
      contentRegions: [],
      links: [],
      buttons: [],
      forms: [],
      selectedText: null,
      languageHint: null,
    },
    codeCandidates: [],
    diagnostics: {
      console: [],
      network: null,
      captureWarnings: [],
    },
    evidence: {
      screenshotRef: null,
      htmlExcerptRef: null,
    },
    privacy: {
      redactionApplied: false,
      redactedKinds: [],
      omittedKinds: ["raw_dom", "cookies", "headers", "scripts", "styles", "hidden_nodes"],
    },
    budget: {
      charLimit: 12_000,
      visibleTextLimit: 8_000,
      elementLimit: 120,
      formFieldLimit: 80,
      diagnosticLimit: 50,
      tokenEstimate: null,
      truncated: false,
      omittedElementCount: 0,
    },
    availability: "available",
  };
}

function selectedElement(
  label: string,
  selectedAt: number,
  x: number,
): BrowserSelectedElementEvidence {
  return {
    tagName: "button",
    role: "button",
    label,
    text: label,
    href: null,
    selectorHint: `button[data-label="${label}"]`,
    sensitive: false,
    bounds: {
      x,
      y: 537,
      width: label === "刷新数据" ? 78 : 86,
      height: 36,
    },
    viewport: {
      width: 2048,
      height: 920,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 2,
    },
    selectedAt,
  };
}

describe("appendSelectedElementAnnotation", () => {
  it("appends repeated selector evidence to the current attachment instead of overwriting it", () => {
    const firstAttachment = appendSelectedElementAnnotation(
      buildBrowserContextAttachment(makeSnapshot("snapshot-1")),
      selectedElement("刷新数据", 1200, 1557),
      null,
    );
    const secondAttachment = appendSelectedElementAnnotation(
      buildBrowserContextAttachment(makeSnapshot("snapshot-2")),
      selectedElement("JSON", 1300, 1675),
      firstAttachment,
    );

    expect(secondAttachment.annotations?.map((item) => item.userNote)).toEqual([
      "刷新数据",
      "JSON",
    ]);
    expect(secondAttachment.elementCounts.annotations).toBe(2);
  });

  it("replaces a repeated click on the same element instead of appending another row", () => {
    const firstAttachment = appendSelectedElementAnnotation(
      buildBrowserContextAttachment(makeSnapshot("snapshot-1")),
      selectedElement("assets/icons.svg 移除", 1200, 24),
      null,
    );
    const secondAttachment = appendSelectedElementAnnotation(
      buildBrowserContextAttachment(makeSnapshot("snapshot-2")),
      selectedElement("assets/icons.svg 移除", 1800, 26),
      firstAttachment,
    );

    expect(secondAttachment.annotations).toHaveLength(1);
    expect(secondAttachment.annotations?.[0]?.userNote).toBe("assets/icons.svg 移除");
    expect(secondAttachment.annotations?.[0]?.createdAt).toBe(1800);
    expect(secondAttachment.elementCounts.annotations).toBe(1);
  });
});
