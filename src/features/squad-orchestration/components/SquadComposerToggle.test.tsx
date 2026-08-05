// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SquadComposerToggle,
  isSquadTargetEngineSupported,
} from "./SquadComposerToggle";

describe("SquadComposerToggle capability boundary", () => {
  afterEach(() => cleanup());

  it("supports only adapters with a verified hard read-only mode", () => {
    expect(isSquadTargetEngineSupported("codex")).toBe(true);
    expect(isSquadTargetEngineSupported("claude")).toBe(true);
    expect(isSquadTargetEngineSupported("grok")).toBe(false);
    expect(isSquadTargetEngineSupported("kimi")).toBe(false);
    expect(isSquadTargetEngineSupported("opencode")).toBe(false);
    expect(isSquadTargetEngineSupported("gemini")).toBe(false);
    expect(isSquadTargetEngineSupported(null)).toBe(false);
  });

  it("disables unsupported Shared targets without consuming ordinary send", () => {
    const onToggle = vi.fn();
    const onOrdinarySend = vi.fn();
    render(
      <>
        <SquadComposerToggle
          engine="grok"
          armed={false}
          disabled={false}
          hasActiveSquad={false}
          onToggle={onToggle}
        />
        <button type="button" onClick={onOrdinarySend}>
          Send
        </button>
      </>,
    );

    const squadButton = screen.getByRole("button", {
      name: /Squad/i,
    }) as HTMLButtonElement;
    expect(squadButton.disabled).toBe(true);
    fireEvent.click(squadButton);
    expect(onToggle).not.toHaveBeenCalled();

    const ordinarySend = screen.getByRole("button", { name: "Send" });
    expect((ordinarySend as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(ordinarySend);
    expect(onOrdinarySend).toHaveBeenCalledTimes(1);
  });

  it.each(["codex", "claude"] as const)(
    "keeps %s Squad entry enabled",
    (engine) => {
      const onToggle = vi.fn();
      render(
        <SquadComposerToggle
          engine={engine}
          armed={false}
          disabled={false}
          hasActiveSquad={false}
          onToggle={onToggle}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: /Squad/i }));
      expect(onToggle).toHaveBeenCalledTimes(1);
    },
  );
});
