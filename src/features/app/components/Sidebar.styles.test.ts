import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Extract the body of a single CSS rule by its exact selector text.
 * Returns the text between the selector's `{` and its matching `}`.
 */
function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) {
    throw new Error(`selector not found: ${selector}`);
  }
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

describe("Sidebar styles", () => {
  // Regression guard for the P0 where clicking "更多" (expand) hid every
  // session: the virtualized thread list uses only `max-height` for its scroll
  // viewport, so `size` containment (via `contain: strict`) collapsed it to 0px
  // and the virtualizer rendered nothing. Must stay `contain: content`.
  it("does not size-contain the virtualized thread list into a 0px viewport", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/styles/sidebar.css"),
      "utf8",
    );
    const body = ruleBody(css, '.thread-list[data-virtualized="true"]');

    // `strict` == `size layout paint`; the `size` part is what collapses a
    // max-height-only scroll container. `content` == `layout paint`, safe.
    expect(body).not.toMatch(/contain:\s*strict/);
    expect(body).not.toMatch(/contain:[^;]*\bsize\b/);
    expect(body).toMatch(/contain:\s*content/);
    // The scroll viewport still relies on max-height + overflow to work.
    expect(body).toMatch(/max-height:\s*360px/);
    expect(body).toMatch(/overflow-y:\s*auto/);
  });

  // Regression: virtualized rows used min-height:36 while flex rows pitch at
  // 30+2=32, so expanding "更多" past the virtualization threshold looked gappy.
  it("keeps virtualized thread row pitch aligned with non-virtualized rows", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/styles/sidebar.css"),
      "utf8",
    );
    const body = ruleBody(css, ".thread-list-virtual-row");

    expect(body).not.toMatch(/min-height:\s*36px/);
    expect(body).toMatch(
      /min-height:\s*calc\(\s*var\(--sidebar-row-height-thread\)\s*\+\s*2px\s*\)/,
    );
  });

  it("does not bold the active quick-new-thread sidebar item", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/styles/sidebar.css"),
      "utf8",
    );
    expect(css).toMatch(
      /\.sidebar-primary-nav-mode-item\.is-active\s*\{[\s\S]*?font-weight:\s*400;/,
    );
  });

  it("keeps pinned thread rows aligned with workspace rows", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/styles/sidebar.css"),
      "utf8",
    );

    expect(ruleBody(css, ".pinned-thread-list")).toMatch(/padding:\s*0;/);
    expect(ruleBody(css, ".sidebar-pinned-section")).toMatch(
      /padding:\s*0\s+4px;/,
    );
  });

  it("aligns thread active selection with workspace soft fill", () => {
    const sidebarCss = readFileSync(
      resolve(process.cwd(), "src/styles/sidebar.css"),
      "utf8",
    );
    const shellCss = readFileSync(
      resolve(process.cwd(), "src/styles/sidebar-shell.css"),
      "utf8",
    );

    // Primary active token must be the soft surface-hover mix (not full hover).
    expect(shellCss).toMatch(
      /--sidebar-color-active-primary:\s*color-mix\(\s*in srgb,\s*var\(--surface-hover\)\s+72%,\s*transparent\s*\)/,
    );
    expect(ruleBody(sidebarCss, ".thread-row.active")).toMatch(
      /background:\s*var\(--sidebar-color-active-primary\);/,
    );
    // Session pills are intentionally more inset than workspace rows (4px) so
    // nested selection backgrounds stay narrower and do not flush-align with
    // the project pill above. Anchor on base `.thread-list` (not worktree).
    expect(sidebarCss).toMatch(
      /\.thread-list\s*\{[\s\S]*?padding:\s*1px\s+8px\s+2px\s+12px;/,
    );
    expect(shellCss).toMatch(/--sidebar-row-radius:\s*6px;/);
  });

  it("hides the workspace menu scrollbar without disabling vertical scrolling", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/styles/sidebar.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.sidebar-workspace-menu,\s*\.renderer-context-menu\s*\{[\s\S]*?overflow-y:\s*auto;/,
    );
    expect(ruleBody(css, ".sidebar-workspace-menu {")).toMatch(
      /scrollbar-width:\s*none;/,
    );
    expect(ruleBody(css, ".sidebar-workspace-menu::-webkit-scrollbar")).toMatch(
      /display:\s*none;/,
    );
  });
});
