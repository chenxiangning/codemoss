import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const vendorPanelsCss = readFileSync(
  fileURLToPath(new URL("./settings.part1.vendor-panels.css", import.meta.url)),
  "utf8",
);

function getCssRuleBlock(css: string, selector: string): string {
  const escapedSelector = selector
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const match = css.match(
    new RegExp(`(?:^|\\n)\\s*${escapedSelector}\\s*\\{([^}]*)\\}`),
  );
  return match?.[1] ?? "";
}

describe("vendor settings panel compact layout", () => {
  it("keeps the engine list and icons compact but readable", () => {
    const navRule = getCssRuleBlock(vendorPanelsCss, ".vendor-engine-nav");
    const searchRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-engine-search",
    );
    const tabRule = getCssRuleBlock(vendorPanelsCss, ".vendor-engine-tab");
    const iconRule = getCssRuleBlock(vendorPanelsCss, ".vendor-engine-icon");
    const panelRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-settings-panel",
    );
    const contentRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-settings-content",
    );
    const mobileContentRule =
      vendorPanelsCss.match(
        /@media \(max-width: 900px\)[\s\S]*?^\s*\.vendor-settings-content\s*\{([^}]*)\}/m,
      )?.[1] ?? "";
    const mobileMasterDetailListHide =
      vendorPanelsCss.includes(
        '.vendor-settings-panel[data-mobile-pane="list"] .vendor-settings-content',
      ) &&
      vendorPanelsCss.includes(
        '.vendor-settings-panel[data-mobile-pane="detail"] .vendor-engine-nav',
      );
    const headingRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-section-heading",
    );
    const tabContentRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-tab-content",
    );
    const providerListRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-provider-list",
    );
    const thirdPartyTableRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-provider-list > .vendor-list-header + .vendor-provider-table-stack",
    );
    const listHeaderRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-list-header",
    );
    const frameRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-provider-table-frame",
    );
    const stackRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-provider-table-stack",
    );
    const emptyFrameRule = getCssRuleBlock(
      vendorPanelsCss,
      '.vendor-provider-table-frame[data-empty="true"]',
    );
    const emptyAdjacentRule = getCssRuleBlock(
      vendorPanelsCss,
      '.vendor-provider-table-frame[data-empty="true"] + .vendor-empty',
    );
    const emptyRule = getCssRuleBlock(vendorPanelsCss, ".vendor-empty");
    const buttonRule = getCssRuleBlock(
      vendorPanelsCss,
      '.vendor-settings-panel [data-slot="button"]',
    );
    const listActionsButtonRule = getCssRuleBlock(
      vendorPanelsCss,
      '.vendor-settings-panel .vendor-list-actions [data-slot="button"],\n.vendor-settings-panel .vendor-list-actions [data-slot="dropdown-menu-trigger"]',
    );
    const badgeRule = getCssRuleBlock(
      vendorPanelsCss,
      '.vendor-settings-panel [data-slot="badge"]',
    );
    const logoRule = getCssRuleBlock(vendorPanelsCss, ".vendor-cli-logo-img");
    const brandTitleRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-brand-title",
    );
    const brandHeaderRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-brand-header",
    );
    const brandMainRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-brand-main",
    );
    const brandActionsRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-brand-actions",
    );
    const cliVersionRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-cli-version",
    );
    const monoLogoRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-cli-logo-img-mono",
    );
    const iflowLogoRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-cli-logo-iflow",
    );

    expect(navRule).toContain("width: 200px;");
    expect(navRule).toContain("height: 100%;");
    expect(navRule).toContain("min-height: 0;");
    expect(navRule).toContain("padding: 16px 10px 0 0;");
    expect(navRule).toContain("overflow: hidden;");
    expect(vendorPanelsCss).not.toContain("scrollbar-gutter: stable;");
    const navScrollRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-engine-nav-scroll",
    );
    // 展开「暂未开放」后列表会 overflow：必须彻底隐藏滚动条占位，
    // 并用 phantom 右侧垫宽隔离 WebKit 残余 1–2px gutter。
    expect(navScrollRule).toContain("scrollbar-width: none;");
    expect(navScrollRule).toContain("-ms-overflow-style: none;");
    expect(navScrollRule).toContain("width: calc(100% + 24px);");
    expect(navScrollRule).toContain("padding-right: 24px;");
    expect(navScrollRule).toContain("padding-bottom: 28px;");
    expect(vendorPanelsCss).toMatch(
      /\.vendor-engine-nav-scroll::-webkit-scrollbar\s*\{[^}]*display:\s*none/s,
    );
    expect(searchRule).toContain("min-height: 32px;");
    expect(searchRule).toContain("margin-bottom: 10px;");
    expect(searchRule).toContain("border-radius: 8px;");
    expect(tabRule).toContain("min-height: 40px;");
    expect(tabRule).toContain("font-size: 13px;");
    expect(tabRule).toContain("gap: 7px;");
    expect(panelRule).toContain("height: 100%;");
    expect(panelRule).toContain("min-height: 0;");
    expect(contentRule).toContain("height: 100%;");
    expect(contentRule).toContain("min-height: 0;");
    expect(contentRule).toContain("padding-left: 24px;");
    expect(contentRule).toContain("padding-right: 24px;");
    expect(mobileContentRule).toContain("padding-left: 0;");
    expect(mobileContentRule).toContain("padding-right: 0;");
    expect(mobileMasterDetailListHide).toBe(true);
    expect(vendorPanelsCss).toContain(".vendor-settings-mobile-back");
    expect(contentRule).toContain(
      "border-left: 1px solid var(--settings-basic-border);",
    );
    expect(headingRule).toContain("gap: 24px;");
    expect(headingRule).toContain("margin-bottom: 28px;");
    expect(tabContentRule).toContain("min-height: 100%;");
    expect(tabContentRule).toContain("gap: 22px;");
    expect(providerListRule).toContain("gap: 0;");
    expect(thirdPartyTableRule).toContain("margin-top: 10px;");
    expect(listHeaderRule).toContain("gap: 20px;");
    expect(stackRule).toContain("flex-direction: column;");
    expect(frameRule).toContain("border-radius: 14px;");
    expect(emptyFrameRule).toContain("border-bottom: 0;");
    expect(emptyFrameRule).toContain("border-bottom-right-radius: 0;");
    expect(emptyRule).toContain("border: 1px solid var(--border-muted);");
    expect(emptyAdjacentRule).toContain("border-top: 0;");
    expect(emptyAdjacentRule).toContain("border-top-left-radius: 0;");
    expect(buttonRule).toContain("border-radius: 8px;");
    expect(listActionsButtonRule).toContain("border-radius: 4px;");
    expect(badgeRule).toContain("border-radius: 8px;");
    expect(iconRule).toContain("width: 28px;");
    expect(iconRule).toContain("height: 28px;");
    expect(iconRule).toContain("border-radius: 5px;");
    expect(logoRule).toContain("width: 15px;");
    expect(logoRule).toContain("height: 15px;");
    expect(brandTitleRule).toContain("font-weight: 400;");
    expect(brandHeaderRule).toContain("flex-wrap: wrap;");
    expect(brandMainRule).toContain("flex: 1 1 240px;");
    expect(brandActionsRule).toContain("flex: 1 1 auto;");
    expect(brandActionsRule).toContain("flex-wrap: wrap;");
    expect(brandActionsRule).toContain("max-width: 100%;");
    expect(cliVersionRule).toContain("flex-wrap: wrap;");
    expect(monoLogoRule).toContain("filter: grayscale(1) brightness(0);");
    expect(iflowLogoRule).not.toContain("linear-gradient");
  });

  it("keeps provider card list styles aligned with the reference card design", () => {
    const cardListRule = getCssRuleBlock(vendorPanelsCss, ".vendor-card-list");
    const groupRule = getCssRuleBlock(vendorPanelsCss, ".vendor-provider-group");
    const cardRule = getCssRuleBlock(vendorPanelsCss, ".vendor-card");
    const activeCardRule = getCssRuleBlock(vendorPanelsCss, ".vendor-card.active");
    const cardIconRule = getCssRuleBlock(vendorPanelsCss, ".vendor-card-icon");
    const cardIconImgRule = getCssRuleBlock(vendorPanelsCss, ".vendor-card-icon img");
    const brandIconTileRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-brand-icon-tile",
    );
    const enableBtnRule = getCssRuleBlock(vendorPanelsCss, ".vendor-btn-enable");
    const revokeBtnRule = getCssRuleBlock(vendorPanelsCss, ".vendor-btn-revoke");

    expect(cardListRule).toContain("flex-direction: column;");
    expect(groupRule).toContain("gap: 0;");
    expect(groupRule).toContain(
      "border: 1px solid var(--settings-basic-border);",
    );
    expect(groupRule).toContain("border-radius: 6px;");
    expect(groupRule).toContain("background: var(--settings-basic-surface);");
    expect(cardRule).toContain("background: transparent;");
    expect(activeCardRule).toContain(
      "background: var(--vendor-button-primary-soft);",
    );
    expect(cardIconRule).toContain("width: 28px;");
    expect(cardIconRule).toContain("height: 28px;");
    expect(cardIconImgRule).toContain("width: 18px;");
    // 白色主体字形的品牌图标(如 kimi)需深色底衬瓦片,避免浅色底不可见
    expect(brandIconTileRule).toContain("background: #0d0d0d;");
    expect(brandIconTileRule).toContain("padding: 2px;");
    expect(enableBtnRule).toContain("background: var(--vendor-button-primary);");
    expect(revokeBtnRule).toContain("border: 1px solid #f39c12;");
  });
});
