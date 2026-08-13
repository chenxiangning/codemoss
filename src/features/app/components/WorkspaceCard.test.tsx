// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { WorkspaceCard } from "./WorkspaceCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "Content Analysis",
  path: "/repo/content-analysis",
  connected: true,
  settings: { sidebarCollapsed: false },
};

afterEach(() => {
  cleanup();
});

describe("WorkspaceCard", () => {
  it("selects the workspace from the row without toggling collapse", () => {
    const onSelectWorkspace = vi.fn();
    const onOpenWorkspaceHome = vi.fn();
    const onToggleWorkspaceCollapse = vi.fn();

    render(
      <WorkspaceCard
        workspace={workspace}
        isActive={false}
        hasPrimaryActiveThread={false}
        isCollapsed
        onShowWorkspaceMenu={vi.fn()}
        onOpenWorkspaceHome={onOpenWorkspaceHome}
        onSelectWorkspace={onSelectWorkspace}
        onToggleWorkspaceCollapse={onToggleWorkspaceCollapse}
      />,
    );

    fireEvent.click(screen.getByText("Content Analysis"));

    expect(onOpenWorkspaceHome).toHaveBeenCalledWith("ws-1");
    expect(onSelectWorkspace).not.toHaveBeenCalled();
    expect(onToggleWorkspaceCollapse).not.toHaveBeenCalled();
  });

  it("toggles collapse only from the dedicated workspace collapse button", () => {
    const onSelectWorkspace = vi.fn();
    const onToggleWorkspaceCollapse = vi.fn();

    render(
      <WorkspaceCard
        workspace={workspace}
        isActive
        hasPrimaryActiveThread={false}
        isCollapsed={false}
        onShowWorkspaceMenu={vi.fn()}
        onSelectWorkspace={onSelectWorkspace}
        onToggleWorkspaceCollapse={onToggleWorkspaceCollapse}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "sidebar.collapseWorkspace" }));

    expect(onToggleWorkspaceCollapse).toHaveBeenCalledWith("ws-1", true);
    expect(onSelectWorkspace).not.toHaveBeenCalled();
  });

  it("does not let the second click in a double-click undo the collapse button toggle", () => {
    const onSelectWorkspace = vi.fn();
    const onToggleWorkspaceCollapse = vi.fn();

    render(
      <WorkspaceCard
        workspace={workspace}
        isActive
        hasPrimaryActiveThread={false}
        isCollapsed={false}
        onShowWorkspaceMenu={vi.fn()}
        onSelectWorkspace={onSelectWorkspace}
        onToggleWorkspaceCollapse={onToggleWorkspaceCollapse}
      />,
    );

    const collapseButton = screen.getByRole("button", { name: "sidebar.collapseWorkspace" });

    fireEvent.click(collapseButton, { detail: 1 });
    fireEvent.click(collapseButton, { detail: 2 });

    expect(onToggleWorkspaceCollapse).toHaveBeenCalledTimes(1);
    expect(onToggleWorkspaceCollapse).toHaveBeenCalledWith("ws-1", true);
    expect(onSelectWorkspace).not.toHaveBeenCalled();
  });

  it("toggles collapse from workspace row double-click without opening workspace home", () => {
    const onOpenWorkspaceHome = vi.fn();
    const onToggleWorkspaceCollapse = vi.fn();

    render(
      <WorkspaceCard
        workspace={workspace}
        isActive
        hasPrimaryActiveThread={false}
        isCollapsed={false}
        onShowWorkspaceMenu={vi.fn()}
        onOpenWorkspaceHome={onOpenWorkspaceHome}
        onSelectWorkspace={vi.fn()}
        onToggleWorkspaceCollapse={onToggleWorkspaceCollapse}
      />,
    );

    fireEvent.doubleClick(screen.getByText("Content Analysis"));

    expect(onToggleWorkspaceCollapse).toHaveBeenCalledWith("ws-1", true);
    expect(onOpenWorkspaceHome).not.toHaveBeenCalled();
  });

  it("renders folder and hover affordance icons for workspace collapse", () => {
    const { container } = render(
      <WorkspaceCard
        workspace={workspace}
        isActive
        hasPrimaryActiveThread={false}
        isCollapsed={false}
        onShowWorkspaceMenu={vi.fn()}
        onSelectWorkspace={vi.fn()}
        onToggleWorkspaceCollapse={vi.fn()}
      />,
    );

    const collapseButton = container.querySelector(".workspace-collapse-toggle");

    expect(collapseButton?.classList.contains("workspace-folder-btn")).toBe(true);
    expect(collapseButton?.querySelector(".workspace-collapse-toggle-folder-icon")).toBeTruthy();
    expect(collapseButton?.querySelector(".workspace-collapse-toggle-affordance-icon")).toBeTruthy();
  });

  it("puts long-press reorder entry on the collapse button", () => {
    const onPointerDown = vi.fn();
    const { container } = render(
      <WorkspaceCard
        workspace={workspace}
        isActive={false}
        hasPrimaryActiveThread={false}
        isCollapsed={false}
        onShowWorkspaceMenu={vi.fn()}
        onSelectWorkspace={vi.fn()}
        onToggleWorkspaceCollapse={vi.fn()}
        collapsePointerHandlers={{ onPointerDown }}
      />,
    );

    const card = container.querySelector(".workspace-card");
    const collapse = container.querySelector(".workspace-collapse-toggle");
    expect(card?.classList.contains("is-reorderable")).toBe(true);
    expect(collapse?.classList.contains("is-reorder-entry")).toBe(true);
    expect(collapse?.getAttribute("title")).toContain("sidebar.longPressToReorder");
    expect(container.querySelector(".workspace-drag-handle")).toBeNull();
  });

  it("switches the collapse control to a grip while dragging", () => {
    const { container } = render(
      <WorkspaceCard
        workspace={workspace}
        isActive={false}
        hasPrimaryActiveThread={false}
        isCollapsed={false}
        onShowWorkspaceMenu={vi.fn()}
        onSelectWorkspace={vi.fn()}
        onToggleWorkspaceCollapse={vi.fn()}
        isDragging
        collapsePointerHandlers={{ onPointerDown: vi.fn() }}
      />,
    );

    const collapse = container.querySelector(".workspace-collapse-toggle");
    expect(collapse?.classList.contains("is-drag-handle")).toBe(true);
    expect(container.querySelector(".workspace-collapse-toggle-drag-icon")).not.toBeNull();
    expect(container.querySelector(".workspace-collapse-toggle-folder-icon")).toBeNull();
  });

  it("does not enable collapse reorder entry by default", () => {
    const { container } = render(
      <WorkspaceCard
        workspace={workspace}
        isActive={false}
        hasPrimaryActiveThread={false}
        isCollapsed={false}
        onShowWorkspaceMenu={vi.fn()}
        onSelectWorkspace={vi.fn()}
        onToggleWorkspaceCollapse={vi.fn()}
      />,
    );

    expect(container.querySelector(".workspace-collapse-toggle.is-reorder-entry")).toBeNull();
    expect(container.querySelector(".workspace-card")?.classList.contains("is-reorderable")).toBe(
      false,
    );
  });

  it("does not render workspace quick actions in the row action area", () => {
    const { container } = render(
      <WorkspaceCard
        workspace={workspace}
        isActive
        hasPrimaryActiveThread={false}
        isCollapsed={false}
        onShowWorkspaceMenu={vi.fn()}
        onSelectWorkspace={vi.fn()}
        onToggleWorkspaceCollapse={vi.fn()}
      />,
    );

    const actions = container.querySelector(".workspace-actions");
    const exitedToggle = container.querySelector(".workspace-exited-toggle");
    const refreshButton = container.querySelector(".workspace-degraded-badge");
    const actionButtons = actions?.querySelectorAll(".workspace-action-btn");

    expect(exitedToggle).toBeNull();
    expect(refreshButton).toBeNull();
    expect(actionButtons).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "sidebar.sessionActionsGroup" }),
    ).toBeTruthy();
  });
});
