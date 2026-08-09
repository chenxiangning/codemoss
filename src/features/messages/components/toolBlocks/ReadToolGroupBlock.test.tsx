// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../../types";
import { ReadToolGroupBlock } from "./ReadToolGroupBlock";

type ToolItem = Extract<ConversationItem, { kind: "tool" }>;

function createReadItem(
  id: string,
  title: string,
  detail: Record<string, unknown>,
): ToolItem {
  return {
    id,
    kind: "tool",
    toolType: title,
    title,
    detail: JSON.stringify(detail),
    status: "completed",
  };
}

describe("ReadToolGroupBlock", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders Grok list_dir with its target directory", () => {
    render(
      <ReadToolGroupBlock
        items={[
          createReadItem("list-1", "list_dir", {
            target_directory: "src/features/messages",
          }),
          createReadItem("read-1", "read_file", {
            target_file: "src/features/messages/index.ts",
          }),
        ]}
      />,
    );

    const kinds = Array.from(document.querySelectorAll(".explore-inline-kind")).map(
      (el) => el.textContent,
    );
    expect(kinds).toContain("tools.kindList");
    expect(kinds).toContain("tools.kindRead");
    expect(screen.getByText("messages")).toBeTruthy();
    expect(screen.getByText("index.ts")).toBeTruthy();
    expect(screen.getByTitle("src/features/messages")).toBeTruthy();
    // 批量读取行应带文件类型图标（与文件树彩色 icon 同源）
    expect(document.querySelectorAll(".explore-inline-file-icon").length).toBe(2);
  });
});
