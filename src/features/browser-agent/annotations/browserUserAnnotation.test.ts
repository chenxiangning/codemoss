import { describe, expect, it } from "vitest";
import {
  buildBrowserUserAnnotationFromSelectedElement,
  buildBrowserUserAnnotation,
  buildAnnotatedVisualEvidenceBlockedDiagnostic,
  formatBrowserUserAnnotationEvidence,
  reconcileBrowserUserAnnotationStaleReasons,
} from "./browserUserAnnotation";
import type { BrowserObservation } from "../types";

function makeObservation(overrides: Partial<BrowserObservation> = {}): BrowserObservation {
  return {
    schemaVersion: 1,
    observationId: "observation-1",
    browserSessionId: "session-1",
    workspaceId: "workspace-1",
    capturedAt: 1000,
    state: "available",
    staleReasons: [],
    transport: "webview_dom",
    rendererBinding: "matched",
    source: {
      url: "https://example.com/page",
      normalizedUrl: "https://example.com/page",
      origin: "https://example.com",
      title: "Example Page",
      tabLabel: "Example Page",
      workspaceLocalAllowed: false,
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
    privacy: {
      redactionApplied: false,
      redactedKinds: [],
      omittedKinds: ["raw_dom", "cookies", "headers", "scripts", "styles", "hidden_nodes"],
    },
    diagnostics: [],
    omittedCapabilities: [],
    ...overrides,
  };
}

describe("BrowserUserAnnotation", () => {
  it("builds structured text evidence bound to a browser observation", () => {
    const annotation = buildBrowserUserAnnotation({
      annotationId: "annotation-1",
      observation: makeObservation(),
      createdAt: 1200,
      anchor: "region",
      userNote: "这里按钮文案不对",
      viewport: {
        width: 1280,
        height: 720,
        scrollX: 0,
        scrollY: 200,
        devicePixelRatio: 2,
      },
      region: {
        x: 420,
        y: 180,
        width: 160,
        height: 48,
      },
      nearbyText: "Start your first task",
      nearestElement: {
        role: "button",
        label: "Start",
        placeholder: null,
        hrefOrigin: null,
        selectorHint: "button[data-testid=start]",
        sensitive: false,
      },
    });

    expect(annotation).toMatchObject({
      observationId: "observation-1",
      browserSessionId: "session-1",
      workspaceId: "workspace-1",
      anchor: "region",
      userNote: "这里按钮文案不对",
      nearbyText: "Start your first task",
      nearestElement: {
        role: "button",
        label: "Start",
      },
    });
    expect(formatBrowserUserAnnotationEvidence(annotation)).toContain("x=420 y=180 w=160 h=48");
  });

  it("sanitizes annotation notes and nearby evidence", () => {
    const annotation = buildBrowserUserAnnotation({
      annotationId: "annotation-1",
      observation: makeObservation(),
      createdAt: 1200,
      anchor: "text_range",
      userNote: "password: hunter2",
      viewport: {
        width: 1280,
        height: 720,
        scrollX: 0,
        scrollY: 0,
        devicePixelRatio: 1,
      },
      nearbyText: "authorization: Bearer secret-token",
    });

    expect(annotation.userNote).toContain("[redacted]");
    expect(annotation.nearbyText).toContain("[redacted]");
    expect(annotation.privacy.redactedKinds).toContain("password");
    expect(annotation.privacy.redactedKinds).toContain("authorization");
  });

  it("reconciles stale reasons when the active page moves", () => {
    const observation = makeObservation({
      staleReasons: ["capture_degraded"],
    });
    const annotation = buildBrowserUserAnnotation({
      annotationId: "annotation-1",
      observation,
      createdAt: 1000,
      anchor: "point",
      userNote: "check this",
      viewport: {
        width: 1280,
        height: 720,
        scrollX: 0,
        scrollY: 0,
        devicePixelRatio: 1,
      },
      region: {
        x: 20,
        y: 30,
        width: 1,
        height: 1,
      },
    });

    const staleReasons = reconcileBrowserUserAnnotationStaleReasons(annotation, {
      observation: makeObservation({ observationId: "observation-2" }),
      activeBrowserSessionId: "session-2",
      activeWorkspaceId: "workspace-2",
      activeUrl: "https://example.com/other",
      activeTitle: "Other Page",
      now: 10_000,
      ttlMs: 1000,
    });

    expect(staleReasons).toEqual(expect.arrayContaining([
      "capture_degraded",
      "dom_fingerprint_changed",
      "active_tab_changed",
      "workspace_mismatch",
      "url_changed",
      "title_changed",
      "ttl_expired",
    ]));
  });

  it("keeps annotated screenshot evidence blocked by default", () => {
    const diagnostic = buildAnnotatedVisualEvidenceBlockedDiagnostic("annotation-1");

    expect(diagnostic.diagnosticId).toBe("annotation-visual-blocked-annotation-1");
    expect(diagnostic.aiMessage).toContain("blocked by default");
    expect(diagnostic.aiMessage).toContain("structured annotation text evidence");
  });

  it("builds annotation evidence from selected page element facts", () => {
    const annotation = buildBrowserUserAnnotationFromSelectedElement({
      annotationId: "selection-1",
      observation: makeObservation(),
      element: {
        tagName: "p",
        role: null,
        label: null,
        text: "This domain is for use in documentation examples.",
        href: null,
        selectorHint: "p",
        sensitive: false,
        bounds: {
          x: 254,
          y: 510,
          width: 742,
          height: 112,
        },
        viewport: {
          width: 1234,
          height: 900,
          scrollX: 0,
          scrollY: 0,
          devicePixelRatio: 2,
        },
        selectedAt: 1500,
      },
    });

    expect(annotation.anchor).toBe("element");
    expect(annotation.userNote).toBe("This domain is for use in documentation examples.");
    expect(annotation.nearestElement).toMatchObject({
      role: "p",
      label: "This domain is for use in documentation examples.",
      selectorHint: "p",
    });
    expect(annotation.locate).toMatchObject({
      documentX: 254,
      documentY: 510,
      viewportX: 254,
      viewportY: 510,
      width: 742,
      height: 112,
    });
    expect(formatBrowserUserAnnotationEvidence(annotation)).toContain("w=742 h=112");
  });

  it("preserves precise selected link evidence for Composer context", () => {
    const annotation = buildBrowserUserAnnotationFromSelectedElement({
      annotationId: "selection-link-1",
      observation: makeObservation(),
      element: {
        tagName: "a",
        role: "link",
        label: "Learn more",
        text: "Learn more",
        href: "https://example.com/details",
        selectorHint: "a",
        sensitive: false,
        bounds: {
          x: 252,
          y: 664,
          width: 133,
          height: 30,
        },
        viewport: {
          width: 1234,
          height: 900,
          scrollX: 0,
          scrollY: 0,
          devicePixelRatio: 2,
        },
        selectedAt: 1600,
      },
    });

    expect(annotation.userNote).toBe("Learn more");
    expect(annotation.nearestElement).toMatchObject({
      role: "link",
      label: "Learn more",
      hrefOrigin: "https://example.com",
      selectorHint: "a",
    });
    expect(formatBrowserUserAnnotationEvidence(annotation)).toContain("w=133 h=30");
  });
});
