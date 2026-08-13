// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { SidebarWorkspaceSortableList } from "./SidebarWorkspaceSortableList";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function makeWorkspace(id: string, name: string): WorkspaceInfo {
  return {
    id,
    name,
    path: `/tmp/${id}`,
    connected: true,
    kind: "main",
    settings: { sidebarCollapsed: true, groupId: "g1", sortOrder: 0 },
  };
}

describe("SidebarWorkspaceSortableList long-press reorder", () => {
  it("reorders after long-press and pointer move", () => {
    vi.useFakeTimers();
    const onReorder = vi.fn();
    const workspaces = [
      makeWorkspace("a", "alpha"),
      makeWorkspace("b", "beta"),
      makeWorkspace("c", "gamma"),
    ];

    const { container } = render(
      <SidebarWorkspaceSortableList
        groupId="g1"
        workspaces={workspaces}
        isDragDisabled={false}
        onReorder={onReorder}
        renderWorkspace={(workspace, drag) => (
          <div
            data-testid={`row-${workspace.id}`}
            {...(drag?.collapsePointerHandlers ?? {})}
            className={drag?.isDragging ? "dragging" : undefined}
          >
            {workspace.name}
          </div>
        )}
      />,
    );

    const items = Array.from(
      container.querySelectorAll<HTMLElement>(".workspace-sortable-item"),
    );
    // Stub geometry so hit-testing can map Y to indices.
    items.forEach((el, index) => {
      el.getBoundingClientRect = () =>
        ({
          top: index * 40,
          bottom: index * 40 + 40,
          height: 40,
          left: 0,
          right: 200,
          width: 200,
          x: 0,
          y: index * 40,
          toJSON: () => ({}),
        }) as DOMRect;
    });

    const rowA = screen.getByTestId("row-a");
    fireEvent.pointerDown(rowA, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 10,
    });

    act(() => {
      vi.advanceTimersByTime(400);
    });

    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId: 1,
          clientX: 10,
          clientY: 90, // third row mid
        }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointerup", {
          pointerId: 1,
          clientX: 10,
          clientY: 90,
        }),
      );
    });

    expect(onReorder).toHaveBeenCalledWith(["b", "c", "a"]);
  });

  it("does not reorder when the press is released before long-press arms", () => {
    vi.useFakeTimers();
    const onReorder = vi.fn();
    const workspaces = [makeWorkspace("a", "alpha"), makeWorkspace("b", "beta")];

    render(
      <SidebarWorkspaceSortableList
        groupId={null}
        workspaces={workspaces}
        isDragDisabled={false}
        onReorder={onReorder}
        renderWorkspace={(workspace, drag) => (
          <div
            data-testid={`row-${workspace.id}`}
            {...(drag?.collapsePointerHandlers ?? {})}
          >
            {workspace.name}
          </div>
        )}
      />,
    );

    fireEvent.pointerDown(screen.getByTestId("row-a"), {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 10,
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.pointerUp(screen.getByTestId("row-a"), {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 10,
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onReorder).not.toHaveBeenCalled();
  });
});
