import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const modalCss = readFileSync(
  new URL("./git-diff-modal.css", import.meta.url),
  "utf8",
);
const shellCss = readFileSync(
  new URL("./editable-diff-review-shell.css", import.meta.url),
  "utf8",
);

describe("git diff modal layout contract", () => {
  it("gives the modal viewer a definite height so unified list can scroll", () => {
    expect(modalCss).toMatch(
      /\.git-history-diff-modal-viewer\s*\{[^}]*height:\s*min\(72vh/,
    );
    expect(modalCss).toMatch(
      /\.git-history-diff-modal-viewer\s*\{[^}]*overflow:\s*hidden/,
    );
    expect(modalCss).not.toContain(
      ".git-history-diff-modal:not(.is-maximized) .diff-viewer-frame",
    );
  });

  it("scrolls unified diffs in .diff-viewer and pins the hunk dock", () => {
    expect(modalCss).toMatch(
      /\.git-history-diff-modal-viewer \.diff-viewer\s*\{[^}]*overflow-y:\s*auto/,
    );
    expect(modalCss).toMatch(
      /\.git-history-diff-modal-viewer \.diff-viewer-anchor-dock\s*\{[^}]*flex:\s*0 0 auto/,
    );
  });

  it("scrolls split compare only in the CodeMirror scroller", () => {
    const columnsRule = modalCss.slice(
      modalCss.indexOf(
        ".git-history-diff-modal-viewer .editable-diff-compare-columns",
      ),
    );
    const columnsBlock = columnsRule.slice(0, columnsRule.indexOf("}") + 1);
    expect(columnsBlock).toContain("overflow: hidden");
    expect(columnsBlock).not.toMatch(/overflow:\s*auto/);

    expect(modalCss).toMatch(
      /\.git-history-diff-modal-viewer \.file-compare-column\s*\{[^}]*minmax\(0,\s*1fr\)/,
    );
    expect(modalCss).toMatch(
      /\.git-history-diff-modal-viewer \.file-compare-cm \.cm-scroller\s*\{[^}]*overflow:\s*auto/,
    );
  });

  it("hides the toolbar-only GitDiffViewer host when split compare owns the body", () => {
    expect(shellCss).toMatch(
      /\.editable-diff-review-viewer\.is-toolbar-only\s*\{[^}]*display:\s*none/,
    );
  });
});
