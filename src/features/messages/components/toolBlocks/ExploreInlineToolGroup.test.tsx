// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ExploreInlineItemRow, ExploreInlineToolGroup } from "./ExploreInlineToolGroup";

describe("ExploreInlineToolGroup", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders title and items with shared explore-inline structure", () => {
    const { container } = render(
      <ExploreInlineToolGroup icon={<span data-testid="icon" />} title="批量读取2个文件">
        <ExploreInlineItemRow kind="Read" label="a.ts" />
        <ExploreInlineItemRow
          kind="Read"
          icon={<span data-testid="file-type-icon" />}
          label="b.ts"
          detail="L1-10"
        />
      </ExploreInlineToolGroup>,
    );

    expect(container.querySelector(".explore-inline")).toBeTruthy();
    expect(screen.getByText("批量读取2个文件")).toBeTruthy();
    expect(screen.getByText("a.ts")).toBeTruthy();
    expect(screen.getByText("b.ts")).toBeTruthy();
    expect(screen.getByText("L1-10")).toBeTruthy();
    expect(screen.getByTestId("file-type-icon")).toBeTruthy();
    expect(container.querySelector(".explore-inline-item.has-file-icon")).toBeTruthy();
  });

  it("collapses the list when header is toggled", () => {
    const { container } = render(
      <ExploreInlineToolGroup icon={<span />} title="批量搜索 (2)">
        <ExploreInlineItemRow kind="Search" label="foo" detail="3 matches" />
      </ExploreInlineToolGroup>,
    );

    expect(container.querySelector(".explore-inline-list")).toBeTruthy();
    expect(container.querySelector(".explore-inline")?.className ?? "").not.toContain(
      "is-collapsed",
    );

    fireEvent.click(screen.getByRole("button"));
    // 折叠时卸载列表 DOM，根节点带 is-collapsed 参与紧凑间距
    expect(container.querySelector(".explore-inline-list")).toBeNull();
    expect(container.querySelector(".explore-inline")?.className ?? "").toContain("is-collapsed");
    expect(screen.queryByText("foo")).toBeNull();
  });
});
