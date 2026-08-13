// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Markdown } from "./Markdown";

describe("Markdown fenced block rendering", () => {
  it("renders fenced markdown blocks as rich markdown cards", async () => {
    const value = [
      "```markdown",
      "> [!TIP]",
      "> **Spring Boot Demo**",
      ">",
      "> - `mvn test` 已通过",
      "```",
    ].join("\n");

    const { container } = render(
      <Markdown value={value} className="markdown" codeBlockStyle="message" />,
    );

    await waitFor(() => {
      expect(container.querySelector(".markdown-codeblock-markdown")).toBeTruthy();
    });
    expect(
      container.querySelector(".markdown-codeblock-language-text")?.textContent,
    ).toBe("MARKDOWN");
    expect(
      container.querySelector(".markdown-codeblock-language-icon"),
    ).toBeTruthy();
    expect(container.querySelector("blockquote.markdown-alert-tip")).toBeTruthy();
    expect(container.querySelector(".markdown-alert-label-tip")?.textContent).toBe("TIP");
    expect(
      container.querySelector(".markdown-codeblock-markdown-content strong")?.textContent,
    ).toBe("Spring Boot Demo");
    expect(
      container.querySelector(".markdown-codeblock-markdown-content code")?.textContent,
    ).toBe("mvn test");
    expect(container.textContent).not.toContain("[!TIP]");
  });

  it("preserves file link actions inside rendered markdown code blocks", async () => {
    const onOpenFileLink = vi.fn();
    const value = [
      "```markdown",
      "[spec.md](/Users/test/project/openspec/spec.md#L12)",
      "```",
    ].join("\n");

    render(
      <Markdown
        value={value}
        className="markdown"
        codeBlockStyle="message"
        onOpenFileLink={onOpenFileLink}
      />,
    );

    fireEvent.click(await screen.findByRole("link", { name: "spec.md" }));

    expect(onOpenFileLink).toHaveBeenCalledWith(
      "/Users/test/project/openspec/spec.md#L12",
    );
  });

  it("preserves html browser actions inside rendered markdown code blocks", async () => {
    const onOpenHtmlInBrowser = vi.fn();
    const value = [
      "```markdown",
      "`_temp/demo.html`",
      "```",
    ].join("\n");

    render(
      <Markdown
        value={value}
        className="markdown"
        codeBlockStyle="message"
        onOpenFileLink={vi.fn()}
        onOpenHtmlInBrowser={onOpenHtmlInBrowser}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "files.openInBrowser" }));
    expect(onOpenHtmlInBrowser).toHaveBeenCalledWith("_temp/demo.html");
  });

  it("keeps nested markdown fences as literal code examples", async () => {
    const value = [
      "示例：",
      "",
      "1. 以下内容应该保留为源码：",
      "",
      "   ```markdown",
      "   # Demo Title",
      "   - item",
      "   ```",
    ].join("\n");

    const { container } = render(
      <Markdown value={value} className="markdown" codeBlockStyle="message" />,
    );

    await waitFor(() => {
      expect(container.querySelector(".markdown-codeblock")).toBeTruthy();
    });
    expect(container.querySelector(".markdown-codeblock-markdown")).toBeNull();
    expect(container.querySelector("h1")).toBeNull();
    expect(container.textContent).toContain("# Demo Title");
  });

  it("renders multiline code blocks with per-line selection wrappers", async () => {
    const value = [
      "```text",
      "first line",
      "second line",
      "```",
    ].join("\n");

    const { container } = render(
      <Markdown value={value} className="markdown" codeBlockStyle="message" />,
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".markdown-codeblock-line")).toHaveLength(2);
    });
    const lines = container.querySelectorAll(".markdown-codeblock-line");
    expect(lines).toHaveLength(2);
    expect(lines[0]?.textContent).toBe("first line");
    expect(lines[1]?.textContent).toBe("second line");
    // Line numbers are driven by a CSS counter, gated on data-line-numbers.
    expect(container.querySelector(".markdown-codeblock pre[data-line-numbers]")).toBeTruthy();
    // Header shows a language icon badge next to the label.
    expect(container.querySelector(".markdown-codeblock-language-icon")).toBeTruthy();
    expect(
      container.querySelector(".markdown-codeblock-language-text")?.textContent,
    ).toBe("text");
  });

  it("renders single-line fenced code blocks with a copy button", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const value = ["```bash", "sudo apt-get install -y libncurses5", "```"].join("\n");

    const { container } = render(
      <Markdown value={value} className="markdown message" codeBlockStyle="message" />,
    );

    await waitFor(() => {
      expect(container.querySelector(".markdown-codeblock-single")).toBeTruthy();
    });
    expect(container.querySelector(".markdown-codeblock-single-wrap")).toBeTruthy();
    expect(container.querySelector(".markdown-codeblock-header")).toBeNull();
    expect(container.textContent).toContain("sudo apt-get install -y libncurses5");

    // Test i18n setup returns the key for this label.
    const copyButton = screen.getByRole("button", { name: "messages.copyCodeBlock" });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("sudo apt-get install -y libncurses5");
    });
  });

  it("renders heavy code blocks immediately while defer kill-switch is off", async () => {
    const onRenderedValueChange = vi.fn();
    const value = [
      "```ts",
      ...Array.from({ length: 44 }, (_, index) => `const heavyValue${index} = ${index};`),
      "```",
    ].join("\n");

    const { container } = render(
      <Markdown
        value={value}
        className="markdown message"
        codeBlockStyle="message"
        onRenderedValueChange={onRenderedValueChange}
      />,
    );

    await waitFor(() => {
      expect(container.textContent).toContain("heavyValue43");
    });
    expect(screen.queryByText("Heavy Markdown detail deferred")).toBeNull();
    expect(onRenderedValueChange).toHaveBeenCalledWith(value);
  });

  it("renders large markdown tables immediately while defer kill-switch is off", async () => {
    const value = [
      "| A | B | C |",
      "| - | - | - |",
      ...Array.from({ length: 14 }, (_, index) => `| row-${index} | value | value |`),
    ].join("\n");

    const { container } = render(
      <Markdown
        value={value}
        className="markdown message"
        codeBlockStyle="message"
      />,
    );

    await waitFor(() => {
      expect(container.textContent).toContain("row-13");
    });
    expect(screen.queryByText("Heavy Markdown detail deferred")).toBeNull();
  });
});
