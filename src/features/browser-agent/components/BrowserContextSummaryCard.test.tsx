// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { BrowserSelectionLocate, BrowserUserAnnotation } from "../types";
import { BrowserContextSummaryCard } from "./BrowserContextSummaryCard";

function makeSelectedElement({
  annotationId,
  userNote,
  nearbyText,
  role = "button",
  selectorHint = "button",
  region,
  url = "https://ai.17nas.com/tools/codex-iq/",
  title = "Codex GPT 模型降智雷达",
  locate,
}: {
  annotationId: string;
  userNote: string;
  nearbyText?: string;
  role?: string;
  selectorHint?: string;
  region?: BrowserUserAnnotation["region"];
  url?: string;
  title?: string;
  locate?: BrowserSelectionLocate | null;
}): BrowserUserAnnotation {
  return {
    annotationId,
    observationId: "browser-observation-1",
    browserSessionId: "browser-session-1",
    workspaceId: "workspace-1",
    createdAt: 120,
    url,
    title,
    anchor: "element",
    userNote,
    viewport: {
      width: 2048,
      height: 920,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 2,
    },
    region: region ?? {
      x: 1557,
      y: 537,
      width: 78,
      height: 36,
    },
    nearbyText: nearbyText ?? userNote,
    locate,
    nearestElement: {
      role,
      label: userNote,
      placeholder: null,
      hrefOrigin: null,
      selectorHint,
      sensitive: false,
    },
    privacy: {
      redactionApplied: false,
      redactedKinds: [],
      omittedKinds: ["raw_dom"],
    },
    staleReasons: [],
    diagnostics: [],
  };
}

describe("BrowserContextSummaryCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps snapshot details collapsed until the title row is opened", () => {
    render(
      <BrowserContextSummaryCard
        attachment={{
          title: "文件改动对比显示不正确 · Issue #642",
          url: "https://github.com/example/repo/issues/642",
          capturedAt: 100,
          stale: false,
          summary: "Issue #642 summary",
          pageType: "issue",
          primaryContent: "Issue body says deleted files should use strikethrough and new files are missing.",
          visibleTextExcerpt: "Issue body says deleted files should use strikethrough.",
          readableBlocks: [
            {
              blockId: "issue-body",
              role: "issue_body",
              text: "图一属于删除文件，是否可参考其他 IDE 的显示划线方式。图二其实是有新增文件，应用没有显示出来。",
              score: 960,
              truncated: false,
            },
          ],
          visualEvidence: [
            {
              evidenceId: "issue-image-1",
              kind: "image",
              label: "issue screenshot",
              altText: "diff display screenshot",
              srcOrigin: "https://github.com",
              nearbyText: "图一：删除文件截图。图二：新增文件截图。",
              visible: true,
              sensitive: false,
            },
          ],
          elementCounts: {
            headings: 15,
            links: 27,
            buttons: 7,
            forms: 0,
            landmarks: 1,
            codeCandidates: 0,
            readableBlocks: 1,
            visualEvidence: 1,
          },
          diagnostics: [],
          privacy: {
            redactionApplied: false,
            redactedKinds: [],
            omittedKinds: ["raw_dom", "cookies", "headers"],
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
        }}
      />,
    );

    expect(screen.getByText("Browser context")).toBeTruthy();
    expect(screen.getAllByText("文件改动对比显示不正确 · Issue #642").length).toBeGreaterThan(0);
    expect(screen.getByText("Snapshot")).toBeTruthy();
    expect(
      screen.queryByText(
        "Issue body says deleted files should use strikethrough and new files are missing.",
      ),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Issue #642/ }));

    expect(screen.getByText(/Primary content|messages\.browserContextPrimaryContent/)).toBeTruthy();
    expect(
      screen.getByText(
        "Issue body says deleted files should use strikethrough and new files are missing.",
      ),
    ).toBeTruthy();
    expect(screen.getByText(/图一属于删除文件/)).toBeTruthy();
    expect(screen.getByText(/issue screenshot/)).toBeTruthy();
    expect(screen.getByText(/diff display screenshot/)).toBeTruthy();
  });

  it("shows selected excerpts as one-line titles and reveals the sentence on row click", () => {
    render(
      <BrowserContextSummaryCard
        attachment={{
          title: "Preview Atlas",
          url: "https://example.com/preview-atlas",
          capturedAt: 100,
          stale: false,
          summary: "LATEST DETECTION · hidden full page summary",
          primaryContent: "LATEST DETECTION · hidden full page summary",
          visibleTextExcerpt: "LATEST DETECTION · hidden full page summary",
          annotations: [
            makeSelectedElement({
              annotationId: "selection-1",
              userNote: "40 节点",
              nearbyText: "40 节点",
              role: "paragraph",
              selectorHint: "p",
            }),
            makeSelectedElement({
              annotationId: "selection-2",
              userNote: "ARCHITECT 文件关系图 · OspOrder",
              nearbyText:
                "ARCHITECT 文件关系图 · OspOrder 以 OspOrderWebController.java 为中心，导入 80 条直接文件关系。",
              role: "paragraph",
              selectorHint: "p",
            }),
            makeSelectedElement({
              annotationId: "selection-3",
              userNote: "SPOTLIGHT 支付回调失败路径",
              nearbyText:
                "SPOTLIGHT 支付回调失败路径 从 notifyPayResult 向下追踪 3 层 callee。",
              role: "paragraph",
              selectorHint: "p",
            }),
          ],
          elementCounts: {
            headings: 5,
            links: 6,
            buttons: 1,
            forms: 0,
            landmarks: 0,
            codeCandidates: 0,
            annotations: 3,
          },
        }}
      />,
    );

    expect(screen.getByText("Web excerpts 3")).toBeTruthy();
    expect(screen.getByText("Preview Atlas")).toBeTruthy();
    expect(screen.getByText("40 节点")).toBeTruthy();
    expect(screen.getByText("ARCHITECT 文件关系图 · OspOrder")).toBeTruthy();
    expect(screen.getByText("SPOTLIGHT 支付回调失败路径")).toBeTruthy();
    expect(screen.getAllByText("Paragraph")).toHaveLength(3);
    expect(screen.queryByText(/LATEST DETECTION/)).toBeNull();
    expect(
      screen.queryByText(/以 OspOrderWebController.java 为中心/),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /ARCHITECT 文件关系图/ }));

    expect(
      screen.getByText(/以 OspOrderWebController.java 为中心，导入 80 条直接文件关系/),
    ).toBeTruthy();
    expect(screen.getByText(/https:\/\//)).toBeTruthy();
    expect(screen.queryByText(/notifyPayResult/)).toBeNull();
    expect(screen.queryByText(/LATEST DETECTION/)).toBeNull();
  });

  it("shows the full sent paragraph instead of repeating a short title", () => {
    render(
      <BrowserContextSummaryCard
        attachment={{
          title: "文件修改折叠区域示例",
          url: "https://example.com/file-fold",
          capturedAt: 100,
          stale: false,
          summary: "page summary",
          visibleTextExcerpt: "page summary",
          readableBlocks: [
            {
              blockId: "user-md",
              role: "other",
              text: "mall/api/user.md 修改\n校验用户资料接口的空指针，并补齐失败回包。",
              score: 800,
              truncated: false,
            },
          ],
          annotations: [
            makeSelectedElement({
              annotationId: "selection-file",
              userNote: "mall/api/user.md 修改",
              nearbyText: "mall/api/user.md 修改",
              role: "listitem",
              selectorHint: "li",
              url: "https://example.com/file-fold",
              title: "文件修改折叠区域示例",
            }),
          ],
        }}
      />,
    );

    expect(screen.getByText("mall/api/user.md 修改")).toBeTruthy();
    expect(screen.queryByText(/补齐失败回包/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /mall\/api\/user\.md/ }));

    expect(screen.getByText(/校验用户资料接口的空指针，并补齐失败回包/)).toBeTruthy();
    expect(screen.getByText(/https:\/\/example.com\/file-fold/)).toBeTruthy();
    expect(screen.getByText("Sent details")).toBeTruthy();
    expect(screen.getByText("Document")).toBeTruthy();
    expect(screen.getByText("Element")).toBeTruthy();
  });

  it("shows pointed-target send details after expanding a selected excerpt", () => {
    render(
      <BrowserContextSummaryCard
        attachment={{
          title: "文件修改折叠区域示例",
          url: "https://example.com/file-fold",
          capturedAt: 100,
          stale: false,
          summary: "page summary",
          annotations: [
            makeSelectedElement({
              annotationId: "selection-locate",
              userNote: "另一段正文：多个场景互不影响，可各自独立控制。",
              nearbyText: "另一段正文：多个场景互不影响，可各自独立控制。",
              role: "paragraph",
              selectorHint: "p",
              url: "https://example.com/file-fold",
              title: "文件修改折叠区域示例",
              region: {
                x: 32,
                y: 180,
                width: 524,
                height: 58,
              },
              locate: {
                documentX: 32,
                documentY: 820,
                viewportX: 32,
                viewportY: 180,
                width: 524,
                height: 58,
                scrollX: 0,
                scrollY: 640,
                listIndex: 3,
                listLength: 4,
                previousText: "docs/changelog.md 新增",
                nextText: "assets/icons.svg 移除",
                ancestorLabel: "文件修改 (4个)",
                cssPath: "section > p:nth-of-type(2)",
              },
            }),
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /另一段正文/ }));

    expect(screen.getByText("Sent details")).toBeTruthy();
    expect(screen.getByText("32, 820")).toBeTruthy();
    expect(screen.getByText("3 / 4")).toBeTruthy();
    expect(screen.getByText("docs/changelog.md 新增")).toBeTruthy();
    expect(screen.getByText("assets/icons.svg 移除")).toBeTruthy();
    expect(screen.getByText("文件修改 (4个)")).toBeTruthy();
    expect(screen.getByText("section > p:nth-of-type(2)")).toBeTruthy();
  });

  it("renders selected element rows in selection order without dumping page snapshot", () => {
    render(
      <BrowserContextSummaryCard
        attachment={{
          title: "Codex GPT 模型降智雷达",
          url: "https://ai.17nas.com/tools/codex-iq/",
          capturedAt: 100,
          stale: false,
          summary: "LATEST DETECTION · hidden full page summary",
          visibleTextExcerpt: "LATEST DETECTION · hidden full page summary",
          annotations: [
            makeSelectedElement({
              annotationId: "selection-1",
              userNote: "刷新数据",
              nearbyText: "刷新数据",
              role: "button",
              selectorHint: "button",
            }),
            makeSelectedElement({
              annotationId: "selection-2",
              userNote: "JSON",
              nearbyText: "JSON",
              role: "button",
              selectorHint: "button.json",
              region: {
                x: 1675,
                y: 537,
                width: 86,
                height: 36,
              },
            }),
          ],
          elementCounts: {
            headings: 5,
            links: 6,
            buttons: 2,
            forms: 0,
            landmarks: 0,
            codeCandidates: 0,
            annotations: 2,
          },
        }}
      />,
    );

    expect(screen.getByText("Web excerpts 2")).toBeTruthy();
    expect(screen.getByText("刷新数据")).toBeTruthy();
    expect(screen.getByText("JSON")).toBeTruthy();
    expect(screen.getAllByText("Button")).toHaveLength(2);
    expect(screen.queryByText(/button · role=button/)).toBeNull();
    expect(screen.queryByText(/LATEST DETECTION/)).toBeNull();
  });

  it("uses the explicit expired observation state when rendering the summary badge", () => {
    render(
      <BrowserContextSummaryCard
        attachment={{
          title: "Example Domain",
          url: "https://example.com/",
          capturedAt: 100,
          stale: true,
          summary: "Example summary",
          observation: {
            schemaVersion: 1,
            observationId: "browser-observation-expired",
            browserSessionId: "browser-session-1",
            workspaceId: "workspace-1",
            capturedAt: 100,
            state: "expired",
            staleReasons: ["ttl_expired"],
            transport: "webview_dom",
            rendererBinding: "matched",
            source: {
              url: "https://example.com/",
              normalizedUrl: "https://example.com/",
              origin: "https://example.com",
              title: "Example Domain",
              tabLabel: "Example",
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
              omittedKinds: ["raw_dom"],
            },
            diagnostics: [],
            omittedCapabilities: [],
          },
        }}
      />,
    );

    const stateBadge = screen.getByText("expired");

    expect(stateBadge.classList.contains("is-expired")).toBe(true);
    expect(
      stateBadge.closest(".browser-context-summary-card")?.classList.contains("is-expired"),
    ).toBe(true);
  });
});
