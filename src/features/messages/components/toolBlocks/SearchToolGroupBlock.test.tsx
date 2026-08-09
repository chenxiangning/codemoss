// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../../types";
import { SearchToolGroupBlock } from "./SearchToolGroupBlock";

const makeSearchToolItem = (
  id: string,
  query: string,
  output: string,
): Extract<ConversationItem, { kind: "tool" }> => ({
  id,
  kind: "tool",
  toolType: "webSearch",
  title: "Web search",
  detail: JSON.stringify({ query }),
  status: "completed",
  output,
});

describe("SearchToolGroupBlock", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows batch title and explore-inline rows like batch read", () => {
    const { container } = render(
      <SearchToolGroupBlock
        items={[
          makeSearchToolItem("search-1", "openclaw", "first search output"),
          makeSearchToolItem("search-2", "openclaw security", "second search output"),
        ]}
      />,
    );

    expect(container.querySelector(".explore-inline")).toBeTruthy();
    expect(screen.getByText(/tools\.batchSearch \(2\)/i)).toBeTruthy();
    expect(screen.getByText("openclaw")).toBeTruthy();
    expect(screen.getByText("first search output")).toBeTruthy();
    expect(screen.getByText("second search output")).toBeTruthy();
    // kind 标签与批量读取的 Read/List 同构（webSearch → Web/网页）
    const webKinds = Array.from(document.querySelectorAll(".explore-inline-kind")).map(
      (el) => el.textContent,
    );
    expect(webKinds.some((k) => k === "tools.kindWeb" || k === "Web" || k === "网页")).toBe(
      true,
    );
  });

  it("renders grouped url summary as clickable link", () => {
    render(
      <SearchToolGroupBlock
        items={[
          makeSearchToolItem("search-url", "openclaw", "https://github.com/openclaw/openclaw"),
        ]}
      />,
    );

    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("https://github.com/openclaw/openclaw");
  });

  it("normalizes grouped json query detail to plain readable text", () => {
    render(
      <SearchToolGroupBlock
        items={[
          {
            id: "search-json",
            kind: "tool",
            toolType: "webSearch",
            title: "Web search",
            detail: JSON.stringify({ query: "https://openclaw.ai/" }),
            status: "completed",
            output: "",
          },
        ]}
      />,
    );

    expect(screen.queryByText(/\{"query"/)).toBeNull();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("https://openclaw.ai/");
  });

  it("renders compact match count in explore-inline detail", () => {
    const pattern = "scroll|stick";
    const output = `<workspace_result workspace_path="/tmp/repo">
Found at least 21 matching lines
/tmp/repo/a.ts
1: scroll
</workspace_result>`;

    render(
      <SearchToolGroupBlock
        items={[
          {
            id: "grep-1",
            kind: "tool",
            toolType: "mcpToolCall",
            title: "Tool: Grep",
            detail: JSON.stringify({ pattern }),
            status: "completed",
            output,
          },
        ]}
      />,
    );

    const kinds = Array.from(document.querySelectorAll(".explore-inline-kind")).map(
      (el) => el.textContent,
    );
    expect(kinds).toContain("tools.kindSearch");
    expect(screen.getByText(pattern)).toBeTruthy();
    expect(screen.getByText(/≥21 matches|≥21 处匹配/)).toBeTruthy();
    expect(screen.queryByText(/workspace_result/)).toBeNull();
  });
});
