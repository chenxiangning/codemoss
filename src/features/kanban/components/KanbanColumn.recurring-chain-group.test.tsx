/** @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react";
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
  KanbanCard: ({ task }: { task: KanbanTask }) => (
    <div data-testid={`kanban-card-${task.id}`} />
  ),
}));

afterEach(() => {
  cleanup();
});

const column: KanbanColumnDef = {
  id: "done",
  labelKey: "kanban.columns.done",
  color: "#22c55e",
};

function createBaseTask(taskId: string): KanbanTask {
  return {
    id: taskId,
    workspaceId: "ws-1",
    panelId: "panel-1",
    title: "Chain Tail Task",
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

describe("KanbanColumn recurring-triggered chain grouping", () => {
  it("groups recurring-triggered chain tails into a dedicated chain group", () => {
    const recurringHeadA: KanbanTask = {
      ...createBaseTask("recurring-head-a"),
      title: "Recurring Head",
      status: "testing",
      schedule: {
        mode: "recurring",
        interval: 1,
        unit: "minutes",
        recurringExecutionMode: "new_thread",
        newThreadResultMode: "pass",
        seriesId: "series-263",
      },
    };
    const recurringHeadB: KanbanTask = {
      ...createBaseTask("recurring-head-b"),
      title: "Recurring Head",
      status: "testing",
      schedule: {
        mode: "recurring",
        interval: 1,
        unit: "minutes",
        recurringExecutionMode: "new_thread",
        newThreadResultMode: "pass",
        seriesId: "series-263",
      },
    };
    const chainTailA: KanbanTask = {
      ...createBaseTask("tail-a"),
      title: "66+66",
      status: "done",
      chain: {
        groupId: "run-group-a",
        previousTaskId: "recurring-head-a",
        groupCode: "501",
      },
    };
    const chainTailB: KanbanTask = {
      ...createBaseTask("tail-b"),
      title: "222+1",
      status: "done",
      chain: {
        groupId: "run-group-b",
        previousTaskId: "recurring-head-b",
        groupCode: "502",
      },
    };

    const { container } = render(
      <KanbanColumn
        column={column}
        tasks={[chainTailA, chainTailB]}
        allTasks={[recurringHeadA, recurringHeadB, chainTailA, chainTailB]}
        selectedTaskId={null}
        taskProcessingMap={{}}
        onAddTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onToggleSchedulePausedTask={vi.fn()}
        onCancelOrBlockTask={vi.fn()}
        onSelectTask={vi.fn()}
      />,
    );

    expect(container.querySelectorAll(".kanban-task-group-panel.is-chain")).toHaveLength(1);
    expect(container.querySelectorAll(".kanban-task-group-panel.is-recurring")).toHaveLength(0);
  });

  it("does not group when direct upstream is not recurring scheduler", () => {
    const chainHeadA: KanbanTask = {
      ...createBaseTask("chain-head-a"),
      title: "Chain Head A",
      status: "done",
      chain: {
        groupId: "head-group-a",
        previousTaskId: null,
        groupCode: "301",
      },
    };
    const chainHeadB: KanbanTask = {
      ...createBaseTask("chain-head-b"),
      title: "Chain Head B",
      status: "done",
      chain: {
        groupId: "head-group-b",
        previousTaskId: null,
        groupCode: "302",
      },
    };
    const chainTailA: KanbanTask = {
      ...createBaseTask("tail-a"),
      title: "66+66",
      status: "done",
      chain: {
        groupId: "run-group-a",
        previousTaskId: "chain-head-a",
        groupCode: "501",
      },
    };
    const chainTailB: KanbanTask = {
      ...createBaseTask("tail-b"),
      title: "222+1",
      status: "done",
      chain: {
        groupId: "run-group-b",
        previousTaskId: "chain-head-b",
        groupCode: "502",
      },
    };

    const { container } = render(
      <KanbanColumn
        column={column}
        tasks={[chainTailA, chainTailB]}
        allTasks={[chainHeadA, chainHeadB, chainTailA, chainTailB]}
        selectedTaskId={null}
        taskProcessingMap={{}}
        onAddTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onToggleSchedulePausedTask={vi.fn()}
        onCancelOrBlockTask={vi.fn()}
        onSelectTask={vi.fn()}
      />,
    );

    expect(container.querySelectorAll(".kanban-task-group-panel.is-chain")).toHaveLength(0);
  });
});
