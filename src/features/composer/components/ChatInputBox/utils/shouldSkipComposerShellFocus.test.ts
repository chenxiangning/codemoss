/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";

import { shouldSkipComposerShellFocus } from "./shouldSkipComposerShellFocus";

describe("shouldSkipComposerShellFocus", () => {
  it("returns false for null / non-Element targets", () => {
    expect(shouldSkipComposerShellFocus(null)).toBe(false);
    expect(shouldSkipComposerShellFocus(document.createTextNode("x"))).toBe(
      false,
    );
  });

  it("returns false for ordinary composer-inner targets", () => {
    const shell = document.createElement("div");
    shell.className = "chat-input-box";
    const btn = document.createElement("button");
    shell.appendChild(btn);
    document.body.appendChild(shell);
    expect(shouldSkipComposerShellFocus(btn)).toBe(false);
    shell.remove();
  });

  it("returns true when target is inside template manager overlay", () => {
    const overlay = document.createElement("div");
    overlay.className = "ma-tpl-overlay";
    const input = document.createElement("input");
    overlay.appendChild(input);
    document.body.appendChild(overlay);
    expect(shouldSkipComposerShellFocus(input)).toBe(true);
    overlay.remove();
  });

  it("returns true when target is inside data-composer-portal-focus-guard", () => {
    const guard = document.createElement("div");
    guard.setAttribute("data-composer-portal-focus-guard", "");
    const textarea = document.createElement("textarea");
    guard.appendChild(textarea);
    document.body.appendChild(guard);
    expect(shouldSkipComposerShellFocus(textarea)).toBe(true);
    guard.remove();
  });
});
