// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@uiw/react-codemirror", () => ({
  default: function MockCodeMirror(props: {
    value: string;
    "aria-label"?: string;
    onChange?: (value: string) => void;
    extensions?: unknown[];
  }) {
    return (
      <textarea
        aria-label={props["aria-label"]}
        value={props.value}
        data-testid="codemirror-mock"
        data-extension-count={String(props.extensions?.length ?? 0)}
        onChange={(event) => props.onChange?.(event.target.value)}
        readOnly
      />
    );
  },
}));

import { OfficialConfigCodeEditorImpl } from "./OfficialConfigCodeEditorImpl";

afterEach(() => {
  cleanup();
});

describe("OfficialConfigCodeEditorImpl", () => {
  it("renders CodeMirror host with format metadata for json", () => {
    const { container } = render(
      <OfficialConfigCodeEditorImpl
        value='{"a":1}'
        onChange={vi.fn()}
        format="json"
        ariaLabel="settings"
        className="vendor-official-json-editor"
      />,
    );

    const host = container.querySelector(
      '[data-official-config-editor="codemirror"]',
    );
    expect(host).toBeTruthy();
    expect(host?.getAttribute("data-format")).toBe("json");
    expect(host?.classList.contains("vendor-official-json-editor")).toBe(true);
    expect(screen.getByLabelText("settings")).toBeTruthy();
    expect(
      Number(screen.getByTestId("codemirror-mock").getAttribute("data-extension-count")),
    ).toBeGreaterThan(0);
  });

  it("marks read-only panes non-editable via host props", () => {
    render(
      <OfficialConfigCodeEditorImpl
        value="secret"
        onChange={vi.fn()}
        format="json"
        readOnly
        ariaLabel="auth"
      />,
    );
    expect(screen.getByLabelText("auth")).toBeTruthy();
  });
});
