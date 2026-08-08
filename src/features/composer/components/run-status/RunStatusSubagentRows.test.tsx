/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const openSubagentInspector = vi.fn();

vi.mock("../../../layout/hooks/activeCanvasStore", () => ({
  useActiveCanvasSelector: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      threadId: "thread-1",
      threadStatusById: {},
      threadItemsByThread: {},
      items: [],
    }),
}));

vi.mock("../../../subagent-ui/hooks/useSubagentSessionProbeStore", () => ({
  useSubagentSessionProbeVersion: () => 0,
  mergeSubagentEnrichmentSources: () => ({}),
}));

vi.mock("../../../subagent-ui/hooks/useSubagentInspectorStore", () => ({
  openSubagentInspector: (...args: unknown[]) => openSubagentInspector(...args),
  syncSubagentInspectorFromCards: vi.fn(),
}));

vi.mock("../../../subagent-ui", async () => {
  const actual = await vi.importActual<typeof import("../../../subagent-ui")>(
    "../../../subagent-ui",
  );
  return {
    ...actual,
    openSubagentInspector: (...args: unknown[]) => openSubagentInspector(...args),
    enrichSubagentCardStatuses: (cards: unknown) => cards,
    enrichSubagentCardsFromTaskNotifications: (cards: unknown) => cards,
    mergeConversationItemSources: () => [],
  };
});

import { RunStatusSubagentRows } from "./RunStatusSubagentRows";

describe("RunStatusSubagentRows", () => {
  beforeEach(() => {
    openSubagentInspector.mockClear();
  });

  it("renders minimal rows with description as title and no progress bar", () => {
    const { container } = render(
      <RunStatusSubagentRows
        subagents={[
          {
            id: "a1",
            type: "explore",
            description: "演示子代理状态栏",
            status: "completed",
          },
          {
            id: "a2",
            type: "explore",
            description: "演示运行态子代理",
            status: "running",
          },
        ]}
      />,
    );

    expect(screen.getByText("演示子代理状态栏")).toBeTruthy();
    expect(screen.getByText("演示运行态子代理")).toBeTruthy();
    expect(container.querySelector(".subagent-progress")).toBeNull();
    expect(container.querySelectorAll(".crs-subagent-row")).toHaveLength(2);
  });

  it("opens inspector on row click", () => {
    const onInspect = vi.fn();
    render(
      <RunStatusSubagentRows
        subagents={[
          {
            id: "a1",
            type: "explore",
            description: "点我",
            status: "completed",
          },
        ]}
        onInspectSubagent={onInspect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /点我/ }));
    expect(openSubagentInspector).toHaveBeenCalled();
    expect(onInspect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a1" }),
    );
  });
});
