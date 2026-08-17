import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./extensions.css", import.meta.url), "utf8");

function getCssRuleBlock(selector: string): string {
  const match = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{[^}]*\\}`, "s"));
  return match?.[0] ?? "";
}

describe("extensions layout", () => {
  it("keeps the extensions tab row pinned to the scroll container top", () => {
    const viewRule = getCssRuleBlock(".extensions-view");
    const filterRowRule = getCssRuleBlock(".extensions-filter-row");

    expect(viewRule).toContain("overflow: auto;");
    // 滚动容器不能有 padding-top，否则容器 padding 区会在 sticky 行上方露出滚动内容。
    expect(viewRule).toContain("padding: 0 var(--extensions-view-padding-inline);");
    expect(viewRule).toContain("--extensions-view-padding-top: 15px;");
    expect(viewRule).toContain("--extensions-filter-row-sticky-height: calc(var(--extensions-view-padding-top) + 56px);");
    expect(filterRowRule).toContain("position: sticky;");
    expect(filterRowRule).toContain("top: 0;");
    expect(filterRowRule).toContain("z-index: 100;");
    expect(filterRowRule).toContain("background: var(--surface-messages);");
    // 顶部间距由 tab 行自身 padding 提供，margin-top 必须保持 0。
    expect(filterRowRule).toContain(
      "margin: 0 calc(var(--extensions-view-padding-inline) * -1) 32px;",
    );
    expect(filterRowRule).toContain(
      "padding: var(--extensions-view-padding-top) var(--extensions-view-padding-inline) 16px;",
    );
    expect(css).not.toContain(".extensions-filter-row::before");
  });

  it("uses one content width across all extension tabs", () => {
    const viewRule = getCssRuleBlock(".extensions-view");

    expect(viewRule).toContain("--extensions-view-padding-inline: clamp(24px, 5vw, 96px);");
    expect(css).not.toContain(".extensions-view-usage {\n  --extensions-view-padding-inline");
    expect(getCssRuleBlock(".main.extensions-main,\n.main.market-main")).toContain(
      "grid-template-columns: minmax(0, 1fr);",
    );
  });

  it("pins Skills bulk actions below the extension tab row", () => {
    const stickyActionsRule = getCssRuleBlock(".extensions-skills-sticky-actions");

    expect(stickyActionsRule).toContain("position: sticky;");
    expect(stickyActionsRule).toContain("top: var(--extensions-filter-row-sticky-height);");
    expect(stickyActionsRule).toContain("z-index: 90;");
    expect(stickyActionsRule).toContain("background: var(--surface-messages);");
  });

  it("styles the visual plugin rack strip and keeps the old cards", () => {
    expect(getCssRuleBlock(".extensions-plugin-rack")).toContain("display: grid;");
    expect(getCssRuleBlock(".extensions-plugin-rack-groups")).toContain("display: grid;");
    expect(getCssRuleBlock(".extensions-plugin-rack-catalog")).toContain("display: grid;");
    expect(getCssRuleBlock(".extensions-plugin-rack-card")).toContain("border-radius: 10px;");
    expect(getCssRuleBlock(".extensions-plugin-rack-stage")).toContain("border-radius: 8px;");
    expect(getCssRuleBlock(".extensions-plugin-rack-strip")).toContain("display: grid;");
    expect(getCssRuleBlock(".extensions-plugin-rack-bank")).toContain("display: grid;");
    expect(getCssRuleBlock(".extensions-plugin-rack-socket")).toContain("border-radius: var(--radius);");
    expect(getCssRuleBlock(".extensions-plugin-rack-well")).toContain("border-radius: 8px;");
    expect(css).not.toContain("Browse Marketplace");
  });
});
