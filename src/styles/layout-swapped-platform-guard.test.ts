import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const baseCss = readFileSync(
  fileURLToPath(new URL("./base.css", import.meta.url)),
  "utf8",
);
const mainCss = readFileSync(
  fileURLToPath(new URL("./main.css", import.meta.url)),
  "utf8",
);
const sidebarCss = readFileSync(
  fileURLToPath(new URL("./sidebar.css", import.meta.url)),
  "utf8",
);
const messagesCss = readFileSync(
  fileURLToPath(new URL("./messages.css", import.meta.url)),
  "utf8",
);
const diffViewerCss = readFileSync(
  fileURLToPath(new URL("./diff-viewer.css", import.meta.url)),
  "utf8",
);

describe("layout swapped platform guard", () => {
  it("scopes swapped structure selectors to desktop layout", () => {
    expect(baseCss).toContain(".app.layout-desktop.layout-swapped {");
    expect(baseCss).toContain(".app.layout-desktop.layout-swapped .main {");
    expect(baseCss).toContain(".app.layout-desktop.layout-swapped .sidebar {");
    expect(baseCss).toContain(".app.layout-desktop.layout-swapped .sidebar-resizer {");
    expect(baseCss).not.toContain(".app.layout-swapped .sidebar-resizer {");

    expect(mainCss).toContain(
      ".app.layout-desktop.layout-swapped .main:not(.settings-open):not(.spec-focus) {",
    );
    expect(mainCss).not.toContain(
      ".app.layout-swapped .main:not(.settings-open):not(.spec-focus) {",
    );
  });

  it("keeps Win/mac titlebar safety selectors mirrored between default and swapped modes", () => {
    expect(mainCss).toContain(
      ".app.windows-desktop.right-panel-collapsed:not(.layout-swapped) .main-topbar,",
    );
    expect(mainCss).toContain(
      ".app.windows-desktop.layout-swapped.sidebar-collapsed .main-topbar {",
    );
    expect(mainCss).toContain(
      ".app.macos-desktop.sidebar-collapsed:not(.layout-swapped) .main-topbar,",
    );
    expect(mainCss).toContain(
      ".app.macos-desktop.layout-swapped.right-panel-collapsed .main-topbar {",
    );
    expect(mainCss).toContain(
      ".app.windows-desktop.right-panel-collapsed:not(.layout-swapped) .main-header-actions,",
    );
    expect(mainCss).toContain(
      ".app.windows-desktop.layout-swapped.sidebar-collapsed .main-header-actions {",
    );
  });

  it("keeps swapped-only overlay anchoring isolated from default mode", () => {
    expect(mainCss).toContain(
      ".app.layout-desktop.layout-swapped .workspace-branch-dropdown {",
    );
    expect(mainCss).toContain(
      ".app.layout-desktop.layout-swapped .workspace-project-dropdown {",
    );
    expect(messagesCss).toContain(
      ".app.layout-desktop.layout-swapped .messages-live-controls {",
    );
    expect(diffViewerCss).toContain(
      ".app.layout-desktop.layout-swapped .diff-viewer-anchor-floating:not(.is-embedded) {",
    );
  });

  it("keeps swapped sidebar quick nav in normal LTR order", () => {
    expect(sidebarCss).toContain(
      ".app.layout-desktop.layout-swapped .sidebar-primary-nav .sidebar-primary-nav-item {",
    );
    expect(sidebarCss).toContain("justify-content: flex-start;");
    expect(sidebarCss).toContain("text-align: left;");
    expect(sidebarCss).toContain(
      ".app.layout-desktop.layout-swapped .sidebar-primary-nav .sidebar-primary-nav-item > .sidebar-primary-nav-icon {",
    );
    expect(sidebarCss).toContain("order: 0;");
    expect(sidebarCss).toContain(
      ".app.layout-desktop.layout-swapped .sidebar-primary-nav .sidebar-primary-nav-item > .sidebar-primary-nav-text-with-badge {",
    );
    expect(sidebarCss).toContain("justify-content: flex-start;");
    expect(sidebarCss).toContain(
      ".app.layout-desktop.layout-swapped .sidebar-primary-nav .sidebar-primary-nav-item > .sidebar-primary-nav-shortcut {",
    );
    expect(sidebarCss).toContain("order: 2;");
    expect(sidebarCss).toContain("margin-left: auto;");
    expect(sidebarCss).toContain("margin-right: 0;");
    expect(sidebarCss).not.toContain(
      ".app.layout-desktop.layout-swapped .sidebar-primary-nav .sidebar-primary-nav-text,",
    );
  });
});
