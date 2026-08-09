// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchToolBlock } from "./SearchToolBlock";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

describe("SearchToolBlock", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows raw detail when output is empty", () => {
    render(
      <SearchToolBlock
        item={{
          id: "search-single-1",
          kind: "tool",
          toolType: "webSearch",
          title: "Web search",
          detail: "openclaw github",
          status: "completed",
          output: "",
        }}
        isExpanded={false}
        onToggle={() => {}}
      />,
    );

    expect(screen.getByText("openclaw github")).toBeTruthy();
  });

  it("renders url summary as clickable link", () => {
    render(
      <SearchToolBlock
        item={{
          id: "search-single-2",
          kind: "tool",
          toolType: "webSearch",
          title: "Web search",
          detail: "search openclaw",
          status: "completed",
          output: "https://openclaw.ai/",
        }}
        isExpanded={false}
        onToggle={() => {}}
      />,
    );

    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("https://openclaw.ai/");
  });

  it("normalizes json query detail to plain readable text", () => {
    render(
      <SearchToolBlock
        item={{
          id: "search-single-3",
          kind: "tool",
          toolType: "webSearch",
          title: "Web search",
          detail: JSON.stringify({ query: "https://openclaw.ai/" }),
          status: "completed",
          output: "",
        }}
        isExpanded={false}
        onToggle={() => {}}
      />,
    );

    expect(screen.queryByText(/\{"query"/)).toBeNull();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("https://openclaw.ai/");
  });

  it("does not toggle expansion when clicking inline links", () => {
    const onToggle = vi.fn();
    render(
      <SearchToolBlock
        item={{
          id: "search-single-link-1",
          kind: "tool",
          toolType: "mcpToolCall",
          title: "Tool: codex / search_query",
          detail: JSON.stringify({ query: "openclaw docs" }),
          status: "completed",
          output: "https://developers.openai.com/codex/guides/agents-md",
        }}
        isExpanded={false}
        onToggle={onToggle}
      />,
    );

    fireEvent.click(screen.getByRole("link"));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("toggles expansion and shows formatted output summary", () => {
    const onToggle = vi.fn();
    render(
      <SearchToolBlock
        item={{
          id: "search-single-4",
          kind: "tool",
          toolType: "mcpToolCall",
          title: "Tool: codex / search_query",
          detail: JSON.stringify({ query: "site:developers.openai.com Codex AGENTS.md" }),
          status: "completed",
          output: JSON.stringify({
            type: "search",
            query: "site:developers.openai.com Codex AGENTS.md",
            queries: ["site:developers.openai.com Codex AGENTS.md"],
          }),
        }}
        isExpanded={false}
        onToggle={onToggle}
      />,
    );

    fireEvent.click(screen.getByLabelText(/tools\.search/i));
    expect(onToggle).toHaveBeenCalledWith("search-single-4");

    expect(screen.queryByText(/tools\.summaryLabel|^summary$|摘要/)).toBeNull();

    cleanup();

    render(
      <SearchToolBlock
        item={{
          id: "search-single-4",
          kind: "tool",
          toolType: "mcpToolCall",
          title: "Tool: codex / search_query",
          detail: JSON.stringify({ query: "site:developers.openai.com Codex AGENTS.md" }),
          status: "completed",
          output: JSON.stringify({
            type: "search",
            query: "site:developers.openai.com Codex AGENTS.md",
            queries: ["site:developers.openai.com Codex AGENTS.md"],
          }),
        }}
        isExpanded
        onToggle={onToggle}
      />,
    );

    expect(screen.getByText(/tools\.summaryLabel|^summary$|摘要/)).toBeTruthy();
    expect(screen.getByText(/"type": "search"/)).toBeTruthy();
  });

  it("shows detail block when output is empty and expanded", () => {
    render(
      <SearchToolBlock
        item={{
          id: "search-single-5",
          kind: "tool",
          toolType: "mcpToolCall",
          title: "Tool: codex / find",
          detail: JSON.stringify({
            type: "find_in_page",
            url: "https://developers.openai.com/codex/guides/agents-md",
            pattern: "searches for AGENTS.md",
          }),
          status: "completed",
          output: "",
        }}
        isExpanded
        onToggle={() => {}}
      />,
    );

    expect(screen.getByText(/tools\.detailLabel|^detail$|详情/)).toBeTruthy();
    expect(screen.getByText(/find_in_page/)).toBeTruthy();
  });

  it("renders compact explore-inline row with pattern and match count separated", () => {
    const pattern = "scroll|Scroll|stick|bottom|pin|jump|anchor";
    const output = `<workspace_result workspace_path="/Users/zhukunpeng/Desktop/CC GUI 项目/desktop-cc-gui">
Found at least 65 matching lines
/Users/zhukunpeng/Desktop/CC GUI 项目/desktop-cc-gui/src/features/messages/presentation/messagesUserPresentation.ts
25: stickyCandidateText: string;
</workspace_result>`;

    const { container } = render(
      <SearchToolBlock
        item={{
          id: "search-grep-1",
          kind: "tool",
          toolType: "mcpToolCall",
          title: "Tool: Grep",
          detail: JSON.stringify({
            pattern,
            path: "/Users/zhukunpeng/Desktop/CC GUI 项目/desktop-cc-gui/src/features/messages",
          }),
          status: "completed",
          output,
        }}
        isExpanded={false}
        onToggle={() => {}}
      />,
    );

    expect(container.querySelector(".explore-inline")).toBeTruthy();
    const kinds = Array.from(container.querySelectorAll(".explore-inline-kind")).map(
      (el) => el.textContent,
    );
    expect(kinds).toContain("tools.kindSearch");
    expect(screen.getByText(pattern)).toBeTruthy();
    // 无 i18n 资源时 formatSearchMatchLabel 回退英文；有资源时用本地化
    expect(screen.getByText(/≥65 matches|≥65 处匹配/)).toBeTruthy();
    // 不再把整段 header 糊成一长串
    expect(
      screen.queryByText("scroll|Scroll|stick|bottom|pin|jump|anchor · ≥65 matches"),
    ).toBeNull();
    expect(screen.queryByText(/workspace_result/)).toBeNull();
    expect(screen.queryByText(/workspace_path=/)).toBeNull();
  });
});
