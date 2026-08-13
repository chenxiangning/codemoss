// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../../types";
import { BashToolGroupBlock } from "./BashToolGroupBlock";

const makeToolItem = (
  id: string,
  command: string | string[],
  output: string,
  status: Extract<ConversationItem, { kind: "tool" }>["status"] = "completed",
  description = "",
): Extract<ConversationItem, { kind: "tool" }> => ({
  id,
  kind: "tool",
  toolType: "commandExecution",
  title: typeof command === "string" ? `Command: ${command}` : "Command",
  detail: JSON.stringify({ command, description }),
  status,
  output,
});

const GROUP_TOGGLE_PATTERN = /批量终端|bashGroupBatchRun/;

describe("BashToolGroupBlock", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders batch outputs in stacked lines when one item is expanded", () => {
    render(
      <BashToolGroupBlock
        items={[
          makeToolItem("bash-group-1", "npm run lint", "first line\nsecond line\nError: failed"),
          makeToolItem("bash-group-2", "npm run test", "ok"),
        ]}
      />,
    );

    // 全完成挂载默认折叠，先展开整组
    fireEvent.click(screen.getByRole("button", { name: GROUP_TOGGLE_PATTERN }));
    fireEvent.click(screen.getByText("npm run lint"));

    const outputLines = document.querySelectorAll(".bash-output-line");
    expect(outputLines.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("first line")).toBeTruthy();
    expect(screen.getByText("second line")).toBeTruthy();
    const errorLine = screen.getByText("Error: failed");
    expect(errorLine.className).toContain("bash-output-line-error");
  });

  it("prefers description and renders row status indicators", () => {
    render(
      <BashToolGroupBlock
        items={[
          makeToolItem(
            "bash-group-3",
            ["git", "status", "--short"],
            "ok",
            "completed",
            "Show working tree status",
          ),
          makeToolItem(
            "bash-group-4",
            ["git", "diff", "--cached"],
            "ok",
            "completed",
            "Show staged and unstaged changes",
          ),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: GROUP_TOGGLE_PATTERN }));

    expect(screen.getByText("Show working tree status")).toBeTruthy();
    expect(screen.getByText("Show staged and unstaged changes")).toBeTruthy();
    expect(document.querySelectorAll(".bash-item-status")).toHaveLength(2);

    const allCompletedNode = screen.queryByText("全部完成") ?? screen.queryByText("tools.bashGroupAllCompleted");
    expect(allCompletedNode).toBeTruthy();
  });

  it("stays expanded while a command is processing", () => {
    render(
      <BashToolGroupBlock
        items={[
          makeToolItem("bash-live-1", "npm run build", "ok"),
          makeToolItem("bash-live-2", "npm run test", "", "in_progress"),
        ]}
      />,
    );

    expect(document.querySelectorAll(".bash-timeline-item")).toHaveLength(2);
  });

  it("auto-collapses once all commands finish", () => {
    const { rerender } = render(
      <BashToolGroupBlock
        items={[
          makeToolItem("bash-done-1", "npm run lint", "ok"),
          makeToolItem("bash-done-2", "npm run test", "", "in_progress"),
        ]}
      />,
    );

    // 进行中：整组展开
    expect(document.querySelectorAll(".bash-timeline-item")).toHaveLength(2);

    rerender(
      <BashToolGroupBlock
        items={[
          makeToolItem("bash-done-1", "npm run lint", "ok"),
          makeToolItem("bash-done-2", "npm run test", "ok"),
        ]}
      />,
    );

    // 全部完成：时间线行不再渲染（整组已折叠），header 仍在
    expect(document.querySelectorAll(".bash-timeline-item")).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: GROUP_TOGGLE_PATTERN }),
    ).toBeTruthy();

    // 用户手动展开后仍可见
    fireEvent.click(screen.getByRole("button", { name: GROUP_TOGGLE_PATTERN }));
    expect(document.querySelectorAll(".bash-timeline-item")).toHaveLength(2);
  });
});
