/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

vi.mock("./KanbanCard", () => ({
  KanbanCard: ({ task }: { task: KanbanTask }) => <div data-testid={`kanban-card-${task.id}`} />,
}));

const column: KanbanColumnDef = {
  id: "testing",
  labelKey: "kanban.column.testing",
  color: "#f59e0b",
};

function createTask(taskId: string): KanbanTask {
  return {
    id: taskId,
    workspaceId: "ws-1",
    panelId: "panel-1",
    title: taskId,
    description: "",
    status: "testing",
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("KanbanColumn bulk complete confirm", () => {
  it("does not bulk complete when confirmation is cancelled", () => {
    const onBulkMoveGroup = vi.fn();
    const head = createTask("head");
    const downstream: KanbanTask = {
      ...createTask("downstream"),
      chain: {
        groupId: "group-1",
        previousTaskId: "head",
        groupCode: "123",
      },
    };

    render(
      <KanbanColumn
        column={column}
        tasks={[head, downstream]}
        allTasks={[head, downstream]}
        selectedTaskId={null}
        taskProcessingMap={{}}
        onAddTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onToggleSchedulePausedTask={vi.fn()}
        onCancelOrBlockTask={vi.fn()}
        onSelectTask={vi.fn()}
        onBulkMoveGroup={onBulkMoveGroup}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "kanban.task.group.bulkComplete" }));
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));

    expect(onBulkMoveGroup).not.toHaveBeenCalled();
  });

  it("bulk completes when confirmation is accepted", () => {
    const onBulkMoveGroup = vi.fn();
    const head = createTask("head");
    const downstream: KanbanTask = {
      ...createTask("downstream"),
      chain: {
        groupId: "group-1",
        previousTaskId: "head",
        groupCode: "123",
      },
    };

    render(
      <KanbanColumn
        column={column}
        tasks={[head, downstream]}
        allTasks={[head, downstream]}
        selectedTaskId={null}
        taskProcessingMap={{}}
        onAddTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onToggleSchedulePausedTask={vi.fn()}
        onCancelOrBlockTask={vi.fn()}
        onSelectTask={vi.fn()}
        onBulkMoveGroup={onBulkMoveGroup}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "kanban.task.group.bulkComplete" }));
    fireEvent.click(screen.getByRole("button", { name: "common.ok" }));

    expect(onBulkMoveGroup).toHaveBeenCalledTimes(1);
    expect(onBulkMoveGroup).toHaveBeenCalledWith(
      expect.arrayContaining(["head", "downstream"]),
      "testing",
      "done",
    );
  });

  it("does not bulk complete when confirmation dialog is dismissed by overlay", () => {
    const onBulkMoveGroup = vi.fn();
    const head = createTask("head");
    const downstream: KanbanTask = {
      ...createTask("downstream"),
      chain: {
        groupId: "group-1",
        previousTaskId: "head",
        groupCode: "123",
      },
    };
    render(
      <KanbanColumn
        column={column}
        tasks={[head, downstream]}
        allTasks={[head, downstream]}
        selectedTaskId={null}
        taskProcessingMap={{}}
        onAddTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onToggleSchedulePausedTask={vi.fn()}
        onCancelOrBlockTask={vi.fn()}
        onSelectTask={vi.fn()}
        onBulkMoveGroup={onBulkMoveGroup}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "kanban.task.group.bulkComplete" }));
    fireEvent.click(screen.getByTestId("kanban-group-bulk-confirm-overlay"));

    expect(onBulkMoveGroup).not.toHaveBeenCalled();
  });
});
