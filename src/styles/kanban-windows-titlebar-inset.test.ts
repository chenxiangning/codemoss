import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const kanbanCss = readFileSync(
  fileURLToPath(new URL("./kanban.css", import.meta.url)),
  "utf8",
).replace(/\r\n/g, "\n");

describe("kanban Windows titlebar inset", () => {
  it("reserves window-control space and matches titlebar vertical center on Windows", () => {
    const hasInset =
      kanbanCss.includes(
        ".app.windows-desktop.kanban-active .kanban-board-header",
      ) &&
      kanbanCss.includes(
        ".app.windows-desktop.kanban-active .kanban-projects-topbar",
      ) &&
      kanbanCss.includes("var(--titlebar-window-controls-width") &&
      kanbanCss.includes("var(--titlebar-toggle-side-gap");

    expect(hasInset).toBe(true);
    expect(kanbanCss).toMatch(
      /padding-right:\s*calc\([\s\S]*titlebar-window-controls-width/,
    );
    // Same vertical band as .titlebar-controls / window controls.
    expect(kanbanCss).toMatch(
      /height:\s*var\(--main-topbar-height,\s*44px\)/,
    );
    expect(kanbanCss).toMatch(/padding-top:\s*0;/);
    expect(kanbanCss).toMatch(/padding-bottom:\s*0;/);
  });
});
