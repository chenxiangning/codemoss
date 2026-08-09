// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../../types";
import * as diffUtils from "../../../../utils/diff";
import { EditToolGroupBlock } from "./EditToolGroupBlock";
import {
  mergeEditSceneStatus,
  normalizeEditScenePath,
} from "./fileEditSceneUtils";

function createEditToolItem(
  id: string,
  detail: Record<string, unknown>,
): Extract<ConversationItem, { kind: "tool" }> {
  return {
    id,
    kind: "tool",
    toolType: "edit",
    title: "Tool: edit",
    detail: JSON.stringify(detail),
    status: "completed",
  };
}

function sceneHeader() {
  return screen.getByRole("button", {
    name: /tools\.fileEditSceneToggle|Batch edit|File changes|批量修改|文件修改/i,
  });
}

describe("EditToolGroupBlock", () => {
  afterEach(() => {
    cleanup();
  });

  it("defaults to collapsed scene summary without file paths", () => {
    render(
      <EditToolGroupBlock
        items={[
          createEditToolItem("tool-1", {
            file_path: "src/release.yml",
            old_string: "line1\nline2",
            new_string: "line1\nline2\nline3",
          }),
          createEditToolItem("tool-2", {
            file_path: "src/app.ts",
            old_string: "a\nb\nc",
            new_string: "a\nc",
          }),
        ]}
      />,
    );

    // i18n in tests returns key or interpolated fallback depending on setup
    expect(
      screen.getByText(/tools\.fileEditSceneCount|Batch edit 2 files|批量修改2个文件/),
    ).toBeTruthy();
    expect(screen.queryByText("release.yml")).toBeNull();
    expect(screen.queryByText("app.ts")).toBeNull();
    expect(screen.queryByTestId("file-edit-scene-list")).toBeNull();

    const header = sceneHeader();
    expect(header.getAttribute("aria-expanded")).toBe("false");
  });

  it("expands on header click and shows full file list", () => {
    render(
      <EditToolGroupBlock
        items={[
          createEditToolItem("tool-1", {
            file_path: "src/release.yml",
            old_string: "line1\nline2",
            new_string: "line1\nline2\nline3",
          }),
          createEditToolItem("tool-2", {
            file_path: "src/app.ts",
            old_string: "a\nb\nc",
            new_string: "a\nc",
          }),
        ]}
      />,
    );

    fireEvent.click(sceneHeader());

    expect(sceneHeader().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("file-edit-scene-list")).toBeTruthy();
    expect(screen.getByText("release.yml")).toBeTruthy();
    expect(screen.getByText("app.ts")).toBeTruthy();
    expect(screen.getAllByText("+1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("-1").length).toBeGreaterThan(0);
  });

  it("toggles with Enter and Space on the scene header", () => {
    render(
      <EditToolGroupBlock
        items={[
          createEditToolItem("tool-1", {
            file_path: "src/a.ts",
            old_string: "a",
            new_string: "b",
          }),
          createEditToolItem("tool-2", {
            file_path: "src/b.ts",
            old_string: "c",
            new_string: "d",
          }),
        ]}
      />,
    );

    const header = sceneHeader();
    fireEvent.keyDown(header, { key: "Enter" });
    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("a.ts")).toBeTruthy();

    fireEvent.keyDown(header, { key: " " });
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("a.ts")).toBeNull();
  });

  it("keeps scenes independent when two groups are mounted", () => {
    render(
      <>
        <EditToolGroupBlock
          items={[
            createEditToolItem("a1", {
              file_path: "src/a1.ts",
              old_string: "x",
              new_string: "y",
            }),
            createEditToolItem("a2", {
              file_path: "src/a2.ts",
              old_string: "x",
              new_string: "y",
            }),
          ]}
        />
        <EditToolGroupBlock
          items={[
            createEditToolItem("b1", {
              file_path: "src/b1.ts",
              old_string: "x",
              new_string: "y",
            }),
            createEditToolItem("b2", {
              file_path: "src/b2.ts",
              old_string: "x",
              new_string: "y",
            }),
          ]}
        />
      </>,
    );

    const headers = screen.getAllByRole("button", {
      name: /tools\.fileEditSceneToggle|Batch edit|File changes|批量修改|文件修改/i,
    });
    expect(headers).toHaveLength(2);

    fireEvent.click(headers[0]!);
    expect(screen.getByText("a1.ts")).toBeTruthy();
    expect(screen.queryByText("b1.ts")).toBeNull();
    expect(headers[1]!.getAttribute("aria-expanded")).toBe("false");
  });

  it("supports nested input and camelCase edit fields after expand", () => {
    render(
      <EditToolGroupBlock
        items={[
          createEditToolItem("tool-5", {
            input: {
              filePath: "src/release.yml",
              oldString: "foo",
              newString: "bar",
            },
          }),
          createEditToolItem("tool-6", {
            arguments: {
              targetFile: "src/app.ts",
              oldString: "line-1",
              newString: "line-2",
            },
          }),
        ]}
      />,
    );

    fireEvent.click(sceneHeader());
    expect(screen.getByText("release.yml")).toBeTruthy();
    expect(screen.getByText("app.ts")).toBeTruthy();
    expect(screen.getAllByText("+1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("-1").length).toBeGreaterThan(0);
  });

  it("renders a single file as a flat FileChangeRow without the group header", () => {
    const view = render(
      <EditToolGroupBlock
        items={[
          createEditToolItem("tool-expand", {
            file_path: "src/App.tsx",
            old_string: "line-a\nline-b",
            new_string: "line-a\nline-c",
          }),
        ]}
      />,
    );

    // 单文件不套「文件修改（1 个）」组头，直接露出文件名
    expect(
      screen.queryByRole("button", {
        name: /tools\.fileEditSceneToggle|Batch edit|File changes|批量修改|文件修改/i,
      }),
    ).toBeNull();
    expect(screen.queryByTestId("file-edit-scene-list")).toBeNull();
    expect(screen.getByText("App.tsx")).toBeTruthy();
    expect(view.container.querySelector(".tool-change-inline-diff")).toBeNull();

    const markers = view.container.querySelectorAll('[data-slot="marker"]');
    expect(markers.length).toBe(1);
    fireEvent.click(markers[0]!);

    expect(view.container.querySelector(".tool-change-inline-diff")).toBeTruthy();
    expect(screen.getByText("line-b")).toBeTruthy();
    expect(screen.getByText("line-c")).toBeTruthy();
  });

  it("returns null when all entries miss file path", () => {
    const { container } = render(
      <EditToolGroupBlock
        items={[
          createEditToolItem("tool-4", {
            old_string: "a",
            new_string: "b",
          }),
        ]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("respects defaultCollapsed=false for multi-file expanded initial state", () => {
    render(
      <EditToolGroupBlock
        defaultCollapsed={false}
        items={[
          createEditToolItem("tool-1", {
            file_path: "src/open.ts",
            old_string: "a",
            new_string: "b",
          }),
          createEditToolItem("tool-2", {
            file_path: "src/other.ts",
            old_string: "c",
            new_string: "d",
          }),
        ]}
      />,
    );

    expect(screen.getByText("open.ts")).toBeTruthy();
    expect(screen.getByText("other.ts")).toBeTruthy();
    expect(sceneHeader().getAttribute("aria-expanded")).toBe("true");
  });

  it("respects defaultCollapsed=false for single-file flat row expanded initial state", () => {
    const view = render(
      <EditToolGroupBlock
        defaultCollapsed={false}
        items={[
          createEditToolItem("tool-1", {
            file_path: "src/open.ts",
            old_string: "a",
            new_string: "b",
          }),
        ]}
      />,
    );

    expect(screen.getByText("open.ts")).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: /tools\.fileEditSceneToggle|Batch edit|File changes|批量修改|文件修改/i,
      }),
    ).toBeNull();
    expect(view.container.querySelector(".tool-change-inline-diff")).toBeTruthy();
  });

  it("expands multi-file fileChange tools and merges unique paths into one scene count", () => {
    const fileChange = (
      id: string,
      changes: Array<{ path: string; kind?: string; diff?: string }>,
    ): Extract<ConversationItem, { kind: "tool" }> => ({
      id,
      kind: "tool",
      toolType: "fileChange",
      title: "File changes",
      detail: "",
      status: "completed",
      changes: changes.map((change) => ({
        path: change.path,
        kind: change.kind ?? "modified",
        diff: change.diff ?? "@@ -1 +1 @@\n-old\n+new",
      })),
    });

    render(
      <EditToolGroupBlock
        items={[
          fileChange("fc-1", [{ path: "docs/design.md" }]),
          fileChange("fc-2", [
            { path: "docs/spec.md" },
            { path: "docs/tasks.md" },
          ]),
          // 同路径再次出现：count 去重，保留最后一次
          fileChange("fc-3", [{ path: "docs/design.md", diff: "@@ -1 +1 @@\n-a\n+b\n+c" }]),
          // ./ 前缀归一到同一 path
          fileChange("fc-4", [{ path: "./docs/spec.md" }]),
        ]}
      />,
    );

    // 3 个唯一路径
    expect(
      screen.getByText(/tools\.fileEditSceneCount|Batch edit 3 files|批量修改3个文件/),
    ).toBeTruthy();

    fireEvent.click(sceneHeader());
    expect(screen.getByText("design.md")).toBeTruthy();
    expect(screen.getByText("spec.md")).toBeTruthy();
    expect(screen.getByText("tasks.md")).toBeTruthy();
  });

  it("does not parse diffs while the scene is collapsed", () => {
    const computeDiffSpy = vi.spyOn(diffUtils, "computeDiff");
    const computePatchSpy = vi.spyOn(diffUtils, "computeDiffFromUnifiedPatch");
    const parseDiffSpy = vi.spyOn(diffUtils, "parseDiff");

    render(
      <EditToolGroupBlock
        items={[
          createEditToolItem("tool-1", {
            file_path: "src/a.ts",
            old_string: "a",
            new_string: "b",
          }),
          {
            id: "fc-1",
            kind: "tool",
            toolType: "fileChange",
            title: "File changes",
            detail: "",
            status: "completed",
            changes: [
              {
                path: "src/b.ts",
                kind: "modified",
                diff: "@@ -1 +1 @@\n-old\n+new",
              },
            ],
          },
        ]}
      />,
    );

    expect(computeDiffSpy).not.toHaveBeenCalled();
    expect(computePatchSpy).not.toHaveBeenCalled();
    expect(parseDiffSpy).not.toHaveBeenCalled();

    fireEvent.click(sceneHeader());
    // 场景展开后才算 stats；行内 preview 仍等 FileChangeRow 再展开
    expect(computeDiffSpy).toHaveBeenCalled();
    expect(computePatchSpy).toHaveBeenCalled();

    computeDiffSpy.mockRestore();
    computePatchSpy.mockRestore();
    parseDiffSpy.mockRestore();
  });

  it("surfaces failed status on the collapsed scene header", () => {
    const { container } = render(
      <EditToolGroupBlock
        items={[
          {
            ...createEditToolItem("ok", {
              file_path: "src/ok.ts",
              old_string: "a",
              new_string: "b",
            }),
            status: "completed",
          },
          {
            ...createEditToolItem("bad", {
              file_path: "src/bad.ts",
              old_string: "a",
              new_string: "b",
            }),
            status: "failed",
          },
        ]}
      />,
    );

    // collapsed：列表不可见，但 header trailing 有失败图标
    expect(screen.queryByText("ok.ts")).toBeNull();
    expect(container.querySelector(".text-destructive")).toBeTruthy();
  });
});

describe("edit scene helpers", () => {
  it("normalizes relative path prefixes", () => {
    expect(normalizeEditScenePath("  ./src/a.ts ")).toBe("src/a.ts");
    expect(normalizeEditScenePath("src/a.ts")).toBe("src/a.ts");
  });

  it("merges scene status with failed > processing > completed", () => {
    expect(mergeEditSceneStatus(["completed", "processing"])).toBe("processing");
    expect(mergeEditSceneStatus(["processing", "failed"])).toBe("failed");
    expect(mergeEditSceneStatus(["completed", "completed"])).toBe("completed");
  });
});
