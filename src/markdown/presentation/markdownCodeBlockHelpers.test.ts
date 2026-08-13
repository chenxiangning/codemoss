import { describe, expect, it } from "vitest";
import {
  extractCodeFromPre,
  extractLanguageTag,
  extractLatexContent,
  extractMarkdownContent,
  extractMermaidContent,
  extractUrlLines,
  shouldRenderMarkdownFenceAsCard,
  type MarkdownPreNode,
} from "./markdownCodeBlockHelpers";

describe("markdownCodeBlockHelpers", () => {
  it("extracts language tags from code class names", () => {
    expect(extractLanguageTag("language-ts")).toBe("ts");
    expect(extractLanguageTag("foo language-python bar")).toBe("python");
    expect(extractLanguageTag("plain")).toBeNull();
  });

  it("extracts markdown, latex, and mermaid fenced content", () => {
    expect(extractMarkdownContent("md", "# Title")).toBe("# Title");
    expect(extractMarkdownContent(null, "```markdown\n# Title\n```")).toBe(
      "# Title",
    );
    expect(extractLatexContent("tex", "x^2")).toBe("x^2");
    expect(extractLatexContent(null, "```latex\nx^2\n```")).toBe("x^2");
    expect(extractMermaidContent("mermaid", "graph TD")).toBe("graph TD");
    expect(extractMermaidContent("flowchart", "flowchart TD\nA-->B")).toBe(
      "flowchart TD\nA-->B",
    );
    expect(extractMermaidContent(null, "```mermaid\ngraph TD\n```")).toBe(
      "graph TD",
    );
    expect(
      extractMermaidContent(null, "```flowchart\nflowchart TD\nA-->B\n```"),
    ).toBe("flowchart TD\nA-->B");
  });

  it("extracts code and normalizes a trailing newline from pre nodes", () => {
    const node: MarkdownPreNode = {
      children: [
        {
          tagName: "code",
          properties: { className: ["language-ts", "highlight"] },
          children: [{ value: "const value = 1;\n" }],
        },
      ],
    };

    expect(extractCodeFromPre(node)).toEqual({
      className: "language-ts highlight",
      value: "const value = 1;",
    });
  });

  it("accepts link-only pre blocks and rejects mixed text", () => {
    expect(
      extractUrlLines(["- https://example.com/a", "1. https://example.com/b"].join("\n")),
    ).toEqual(["https://example.com/a", "https://example.com/b"]);
    expect(extractUrlLines("https://example.com/a\nnot a url")).toBeNull();
  });

  it("only renders top-level markdown fences as cards", () => {
    expect(
      shouldRenderMarkdownFenceAsCard(
        { position: { start: { offset: 0 } } },
        "```markdown\n# Title\n```",
      ),
    ).toBe(true);
    expect(
      shouldRenderMarkdownFenceAsCard(
        { position: { start: { offset: 3 } } },
        "  ```markdown\n# Title\n```",
      ),
    ).toBe(false);
  });
});
