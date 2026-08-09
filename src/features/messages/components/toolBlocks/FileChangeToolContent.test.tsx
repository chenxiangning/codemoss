// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FileChangeToolContent } from "./FileChangeToolContent";
import type { GenericToolDisplayChange } from "./genericToolPresentation";

function change(path: string, additions = 1, deletions = 0): GenericToolDisplayChange {
  return {
    path,
    normalizedKind: "modified",
    kindCode: "M",
    diffText: `@@\n-old\n+new\n`,
    diffStats: { additions, deletions },
  };
}

describe("FileChangeToolContent", () => {
  afterEach(() => {
    cleanup();
  });

  it("defaults to collapsed scene and expands to list all files", () => {
    render(
      <FileChangeToolContent
        status="completed"
        changes={[change("docs/a.md"), change("src/b.ts", 2, 1)]}
      />,
    );

    expect(screen.queryByText("a.md")).toBeNull();
    expect(screen.queryByText("b.ts")).toBeNull();

    const header = screen.getByRole("button", {
      name: /tools\.fileEditSceneToggle|Batch edit|File changes|批量修改|文件修改/i,
    });
    expect(header.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("a.md")).toBeTruthy();
    expect(screen.getByText("b.ts")).toBeTruthy();
  });

  it("returns null for empty changes", () => {
    const { container } = render(
      <FileChangeToolContent status="completed" changes={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a single file as a flat row without the group header", () => {
    render(
      <FileChangeToolContent status="completed" changes={[change("docs/only.md", 2, 1)]} />,
    );

    expect(
      screen.queryByRole("button", {
        name: /tools\.fileEditSceneToggle|Batch edit|File changes|批量修改|文件修改/i,
      }),
    ).toBeNull();
    expect(screen.queryByTestId("file-edit-scene-list")).toBeNull();
    expect(screen.getByText("only.md")).toBeTruthy();
    expect(screen.getByText("+2")).toBeTruthy();
    expect(screen.getByText("-1")).toBeTruthy();
  });
});
