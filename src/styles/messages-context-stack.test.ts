import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const messagesPart1Css = readFileSync(
  fileURLToPath(new URL("./messages.part1.css", import.meta.url)),
  "utf8",
).replace(/\r\n/g, "\n");

function getCssRuleBlock(css: string, selector: string): string {
  const escapedSelector = selector
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("messages context stack layout", () => {
  it("slightly enlarges the history action without changing sibling icons", () => {
    const historyIconRule = getCssRuleBlock(
      messagesPart1Css,
      ".message-action-bar-row .message-history-icon",
    );

    expect(historyIconRule).toContain("font-size: 13px;");
  });

  it("keeps user context cards and the user bubble on the same right-aligned column", () => {
    const userBubbleRule = getCssRuleBlock(messagesPart1Css, ".message.user .bubble");
    const userStackRule = getCssRuleBlock(messagesPart1Css, ".message-context-stack.is-user");
    const stackedBubbleRule = getCssRuleBlock(
      messagesPart1Css,
      ".message-context-stack.is-user > .bubble",
    );

    expect(userBubbleRule).toContain(
      "max-width: var(--message-user-bubble-max-width, 85%);",
    );
    // 复制入口用叠层衬底，不再固定预留 padding-right（避免短气泡右侧空一块）
    expect(userBubbleRule).not.toMatch(/padding-right\s*:/);
    expect(userStackRule).toContain(
      "width: var(--message-user-bubble-max-width, 85%);",
    );
    expect(userStackRule).toContain("max-width: none;");
    expect(userStackRule).toContain("margin-left: auto;");
    expect(userStackRule).toContain("justify-items: end;");
    expect(stackedBubbleRule).toContain("max-width: 100%;");
  });

  it("overlays user bubble copy actions with a matching scrim instead of reserved width", () => {
    const actionsRule = getCssRuleBlock(messagesPart1Css, ".message-user-bubble-actions");

    expect(actionsRule).toContain("position: absolute;");
    expect(actionsRule).toContain("pointer-events: none;");
    expect(actionsRule).toMatch(/background:\s*color-mix\(/);
    expect(actionsRule).toMatch(/box-shadow:\s*0 0 10px 6px/);
  });

  it("bounds appended user context cards inside the shared user column", () => {
    const contextCardRule = getCssRuleBlock(
      messagesPart1Css,
      [
        ".message-context-stack.is-user > .memory-context-summary-card,",
        ".message-context-stack.is-user > .browser-context-summary-card,",
        ".message-context-stack.is-user > .intent-canvas-context-summary-card,",
        ".message-context-stack.is-user > .note-card-context-summary-card,",
        ".message-context-stack.is-user > .message-code-annotation-context",
      ].join("\n"),
    );

    expect(contextCardRule).toContain("max-width: 100%;");
    expect(contextCardRule).toContain("min-width: 0;");
    expect(contextCardRule).toContain("box-sizing: border-box;");
  });

  it("does not use content-visibility on message rows (jetbrains scroll stability)", () => {
    // 2026-08：对齐 jetbrains-cc-gui——content-visibility 占位→真高跳变是
    // 「视口上跳卡中部」根因，messages 行全面禁用，不再需要 image 行例外规则。
    expect(messagesPart1Css).not.toMatch(
      /^\s*content-visibility\s*:/m,
    );
    expect(messagesPart1Css).not.toContain(
      ".message:has(.message-image-grid, .message-deferred-image-list, .message-generated-image-card)",
    );
  });
});
