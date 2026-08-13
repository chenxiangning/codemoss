import { describe, expect, it } from "vitest";
import {
  applyWorkspaceReorder,
  parseSidebarWorkspaceDroppableId,
  toSidebarWorkspaceDroppableId,
} from "./sidebarWorkspaceReorder";

describe("sidebarWorkspaceReorder", () => {
  it("builds and parses droppable ids for named and ungrouped lists", () => {
    expect(toSidebarWorkspaceDroppableId(null)).toBe(
      "sidebar-workspace-group:ungrouped",
    );
    expect(toSidebarWorkspaceDroppableId("group-a")).toBe(
      "sidebar-workspace-group:group-a",
    );
    expect(parseSidebarWorkspaceDroppableId("sidebar-workspace-group:ungrouped")).toBe(
      null,
    );
    expect(parseSidebarWorkspaceDroppableId("sidebar-workspace-group:group-a")).toBe(
      "group-a",
    );
    expect(parseSidebarWorkspaceDroppableId("settings-group-list")).toBeUndefined();
  });

  it("reorders ids within a group list", () => {
    expect(
      applyWorkspaceReorder({
        orderedIds: ["a", "b", "c"],
        sourceIndex: 0,
        destinationIndex: 2,
      }),
    ).toEqual(["b", "c", "a"]);
    expect(
      applyWorkspaceReorder({
        orderedIds: ["a", "b", "c"],
        sourceIndex: 2,
        destinationIndex: 0,
      }),
    ).toEqual(["c", "a", "b"]);
  });

  it("returns null for no-ops and out-of-range indices", () => {
    expect(
      applyWorkspaceReorder({
        orderedIds: ["a", "b"],
        sourceIndex: 0,
        destinationIndex: 0,
      }),
    ).toBeNull();
    expect(
      applyWorkspaceReorder({
        orderedIds: ["a", "b"],
        sourceIndex: -1,
        destinationIndex: 0,
      }),
    ).toBeNull();
    expect(
      applyWorkspaceReorder({
        orderedIds: ["a", "b"],
        sourceIndex: 0,
        destinationIndex: 5,
      }),
    ).toBeNull();
  });
});
