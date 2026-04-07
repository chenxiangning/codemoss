/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KanbanColumnDef, KanbanTask } from "../types";
import { KanbanColumn } from "./KanbanColumn";

vi.mock("@hello-pangea/dnd", () => ({
  Droppable: ({
    children,
  }: {
    children: (
      provided: {
        innerRef: (element: HTMLElement | null) => void;
        droppableProps: Record<string, never>;
        placeholder: null;
      },
      snapshot: { isDraggingOver: boolean },
    ) => unknown;
  }) =>
    children(
      {
        innerRef: vi.fn(),
        droppableProps: {},
        placeholder: null,
      },
      { isDraggingOver: false },
    ),
}));

afterEach(() => {
  cleanup();
});

vi.mock("./KanbanCard", () => ({
  KanbanCard: ({
    task,
    chainGroupCode,
    chainGroupCodePrefix,
  }: {
    task: KanbanTask;
    chainGroupCode?: string | null;
    chainGroupCodePrefix?: "#" | "$";
  }) => (
    <div
      data-testid={`kanban-card-${task.id}`}
      data-group-code={chainGroupCode ?? ""}
      data-group-prefix={chainGroupCodePrefix ?? "#"}
    />
  ),
}));

const column: KanbanColumnDef = {
  id: "done",
  labelKey: "kanban.column.done",
  color: "#10b981",
};

function createBaseTask(taskId: string): KanbanTask {
  return {
    id: taskId,
    workspaceId: "ws-1",
    panelId: "panel-1",
    title: taskId,
    description: "",
    status: "todo",
    engineType: "codex",
    modelId: null,
    branchName: "main",
    images: [],
    autoStart: false,
    sortOrder: 1,
    threadId: null,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("KanbanColumn recurring upstream badge", () => {
  it("uses recurring scheduler badge ($) when chain upstream is recurring", () => {
    const upstream: KanbanTask = {
      ...createBaseTask("upstream"),
      schedule: {
        mode: "recurring",
        interval: 1,
        unit: "minutes",
        recurringExecutionMode: "new_thread",
        newThreadResultMode: "pass",
        seriesId: "series-1",
      },
    };
    const downstream: KanbanTask = {
      ...createBaseTask("downstream"),
      status: "done",
      chain: {
        groupId: "group-1",
        previousTaskId: "upstream",
        groupCode: "951",
      },
    };

    render(
      <KanbanColumn
        column={column}
        tasks={[downstream]}
        allTasks={[upstream, downstream]}
        selectedTaskId={null}
        taskProcessingMap={{}}
        onAddTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onToggleSchedulePausedTask={vi.fn()}
        onCancelOrBlockTask={vi.fn()}
        onSelectTask={vi.fn()}
      />,
    );

    const card = screen.getByTestId("kanban-card-downstream");
    expect(card.getAttribute("data-group-prefix")).toBe("$");
    expect(card.getAttribute("data-group-code")).not.toBe("951");
    expect(card.getAttribute("data-group-code")).not.toBe("");
  });

  it("keeps chain badge (#) when chain upstream is not recurring", () => {
    const upstream: KanbanTask = {
      ...createBaseTask("upstream"),
    };
    const downstream: KanbanTask = {
      ...createBaseTask("downstream"),
      status: "done",
      chain: {
        groupId: "group-1",
        previousTaskId: "upstream",
        groupCode: "951",
      },
    };

    render(
      <KanbanColumn
        column={column}
        tasks={[downstream]}
        allTasks={[upstream, downstream]}
        selectedTaskId={null}
        taskProcessingMap={{}}
        onAddTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onToggleSchedulePausedTask={vi.fn()}
        onCancelOrBlockTask={vi.fn()}
        onSelectTask={vi.fn()}
      />,
    );

    const card = screen.getByTestId("kanban-card-downstream");
    expect(card.getAttribute("data-group-prefix")).toBe("#");
    expect(card.getAttribute("data-group-code")).toBe("951");
  });
});
