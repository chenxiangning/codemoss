// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAppShellClaudeThinkingSection } from "./useAppShellClaudeThinkingSection";

describe("useAppShellClaudeThinkingSection", () => {
  it("keeps Claude thinking visible even after downstream reports false", () => {
    const view = renderHook(() => useAppShellClaudeThinkingSection());

    expect(view.result.current.claudeThinkingVisible).toBe(true);

    act(() => {
      view.result.current.handleResolvedClaudeThinkingVisibleChange(false);
    });

    expect(view.result.current.claudeThinkingVisible).toBe(true);
  });

  it("returns a stable visibility callback", () => {
    const view = renderHook(() => useAppShellClaudeThinkingSection());
    const previous = view.result.current.handleResolvedClaudeThinkingVisibleChange;

    view.rerender();

    expect(view.result.current.handleResolvedClaudeThinkingVisibleChange).toBe(
      previous,
    );
  });
});
