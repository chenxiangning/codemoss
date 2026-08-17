// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publishPluginRackSnapshot } from "../../../services/pluginPresence";
import { DECLARED_PLUGIN_RACK_SNAPSHOT } from "../../../services/tauri/pluginRack";
import { QuickSwitcher } from "./QuickSwitcher";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../../utils/time", () => ({
  formatRelativeTimeShort: () => "now",
}));

vi.mock("../hooks/useQuickSwitcherRecentFiles", () => ({
  useQuickSwitcherRecentFiles: () => [
    {
      workspaceId: "workspace-a",
      workspaceName: "MossX",
      latestAt: 10,
      files: [
        {
          workspaceId: "workspace-a",
          path: "src/components/App.tsx",
          touchedAt: 10,
          source: "ai-modified",
          aiModifiedAt: 10,
        },
      ],
    },
  ],
}));

const sessionGroups = [
  {
    workspaceId: "workspace-a",
    workspaceName: "MossX",
    latestAt: 20,
    sessions: [
      {
        workspaceId: "workspace-a",
        id: "current-thread",
        title: "Current session",
        updatedAt: 20,
        engine: "codex" as const,
        isShared: false,
      },
      {
        workspaceId: "workspace-a",
        id: "next-thread",
        title: "Next session",
        updatedAt: 19,
        engine: "claude" as const,
        isShared: false,
      },
    ],
  },
];

const runningSessions = [
  {
    workspaceId: "workspace-a",
    workspaceName: "MossX",
    threadId: "running-thread",
    threadName: "Running session",
    engine: "codex",
    startedAt: 30,
  },
];

const baseProps = {
  workspaces: [{ id: "workspace-a", name: "MossX" }],
  activeWorkspaceId: "workspace-a",
  activeThreadId: "current-thread",
  activeFilePath: null,
  sessionGroups,
  runningSessions: [],
  onNavigate: vi.fn(),
  onSelectSession: vi.fn(),
  onSelectFile: vi.fn(),
  onClose: vi.fn(),
};

describe("QuickSwitcher", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders parallel workspace-grouped panes without a search input", () => {
    const { container } = render(<QuickSwitcher {...baseProps} />);

    expect(container.querySelectorAll(".quick-switcher-recent-pane")).toHaveLength(2);
    expect(screen.getByText("quickSwitcher.recentSessions")).toBeTruthy();
    expect(screen.getByText("quickSwitcher.recentFiles")).toBeTruthy();
    expect(screen.getAllByText("MossX")).toHaveLength(2);
    expect(screen.getByText("App.tsx")).toBeTruthy();
    expect(
      screen.getByText("App.tsx").closest(".quick-switcher-file-label"),
    ).toBeTruthy();
    expect(screen.getByText("quickSwitcher.nav.intentCanvas")).toBeTruthy();
    expect(screen.getByText("quickSwitcher.nav.projectMap")).toBeTruthy();
    expect(document.querySelector("input")).toBeNull();
    expect(screen.getByText("Ctrl+E")).toBeTruthy();
  });

  it("defaults to the session after the current one and activates with Enter", () => {
    const onSelectSession = vi.fn();
    render(<QuickSwitcher {...baseProps} onSelectSession={onSelectSession} />);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });
    expect(onSelectSession).toHaveBeenCalledWith("workspace-a", "next-thread");
  });

  it("moves across all three panes with horizontal arrows", () => {
    const onSelectFile = vi.fn();
    render(<QuickSwitcher {...baseProps} onSelectFile={onSelectFile} />);

    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    fireEvent.keyDown(dialog, { key: "Enter" });
    expect(onSelectFile).toHaveBeenCalledWith(
      "workspace-a",
      "src/components/App.tsx",
    );
  });

  it("switches to navigation and closes with Escape", () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    render(
      <QuickSwitcher
        {...baseProps}
        onNavigate={onNavigate}
        onClose={onClose}
      />,
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    fireEvent.keyDown(dialog, { key: "ArrowDown" });
    fireEvent.keyDown(dialog, { key: "Enter" });
    expect(onNavigate).toHaveBeenCalledWith("chat");

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("activates every navigation row, including the visual tools, without dead items", () => {
    const onNavigate = vi.fn();
    render(<QuickSwitcher {...baseProps} onNavigate={onNavigate} />);

    const navigation = screen.getByRole("navigation", {
      name: "quickSwitcher.navigation",
    });
    const expectedTargets = [
      "globalSearch",
      "chat",
      "files",
      "git",
      "history",
      "kanban",
      "spec",
      "intentCanvas",
      "projectMap",
      "notes",
      "memory",
      "terminal",
      "settings",
    ];

    for (const target of expectedTargets) {
      fireEvent.click(
        within(navigation).getByText(`quickSwitcher.nav.${target}`),
      );
      expect(onNavigate).toHaveBeenLastCalledWith(target);
    }
    expect(onNavigate).toHaveBeenCalledTimes(expectedTargets.length);
  });

  it("places globalSearch first and notes/memory before settings", () => {
    render(<QuickSwitcher {...baseProps} />);

    const navigation = screen.getByRole("navigation", {
      name: "quickSwitcher.navigation",
    });
    const labels = within(navigation)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(labels[0]).toBe("quickSwitcher.nav.globalSearch");
    const settingsIndex = labels.indexOf("quickSwitcher.nav.settings");
    expect(labels[settingsIndex - 2]).toBe("quickSwitcher.nav.notes");
    expect(labels[settingsIndex - 1]).toBe("quickSwitcher.nav.memory");
  });

  it("marks active navigation rows with is-active and clears it when the module closes", () => {
    const { container, rerender } = render(
      <QuickSwitcher {...baseProps} activeNavigationIds={["files", "settings"]} />,
    );

    const navigation = screen.getByRole("navigation", {
      name: "quickSwitcher.navigation",
    });
    const rowOf = (target: string) =>
      within(navigation)
        .getByText(`quickSwitcher.nav.${target}`)
        .closest("button")!;
    expect(rowOf("files").className).toContain("is-active");
    expect(rowOf("settings").className).toContain("is-active");
    expect(rowOf("chat").className).not.toContain("is-active");
    expect(rowOf("notes").className).not.toContain("is-active");
    expect(container.querySelectorAll(".quick-switcher-row.is-active")).toHaveLength(2);

    // 模块关闭后（active ids 为空）高亮 MUST 消失。
    rerender(<QuickSwitcher {...baseProps} activeNavigationIds={[]} />);
    expect(container.querySelector(".quick-switcher-row.is-active")).toBeNull();
  });

  it("renders no is-active rows when activeNavigationIds is omitted (backward compatible)", () => {
    const { container } = render(<QuickSwitcher {...baseProps} />);

    expect(container.querySelector(".quick-switcher-row.is-active")).toBeNull();
  });

  it("renders the running sessions section above recent groups and hides it when empty", () => {
    const { container, rerender } = render(
      <QuickSwitcher {...baseProps} runningSessions={runningSessions} />,
    );

    expect(screen.getByText("quickSwitcher.runningSessions")).toBeTruthy();
    expect(screen.getByText("Running session")).toBeTruthy();
    expect(
      container.querySelectorAll(".quick-switcher-live-dot").length,
    ).toBeGreaterThan(0);
    const headings = container.querySelectorAll(
      ".quick-switcher-workspace-heading",
    );
    expect(headings[0]?.textContent).toContain("quickSwitcher.runningSessions");

    rerender(<QuickSwitcher {...baseProps} runningSessions={[]} />);
    expect(screen.queryByText("quickSwitcher.runningSessions")).toBeNull();
    expect(container.querySelector(".quick-switcher-live-dot")).toBeNull();
  });

  it("dedupes running sessions out of the recent session groups", () => {
    const groupsWithRunningDuplicate = [
      {
        ...sessionGroups[0]!,
        sessions: [
          {
            workspaceId: "workspace-a",
            id: "running-thread",
            title: "Duplicated running session",
            updatedAt: 21,
            engine: "codex" as const,
            isShared: false,
          },
          ...sessionGroups[0]!.sessions,
        ],
      },
    ];
    render(
      <QuickSwitcher
        {...baseProps}
        sessionGroups={groupsWithRunningDuplicate}
        runningSessions={runningSessions}
      />,
    );

    expect(screen.queryByText("Duplicated running session")).toBeNull();
    expect(screen.getByText("Running session")).toBeTruthy();
  });

  it("activates a running session row via onSelectSession on click", () => {
    const onSelectSession = vi.fn();
    render(
      <QuickSwitcher
        {...baseProps}
        runningSessions={runningSessions}
        onSelectSession={onSelectSession}
      />,
    );

    fireEvent.click(screen.getByText("Running session"));
    expect(onSelectSession).toHaveBeenCalledWith("workspace-a", "running-thread");
  });

  it("includes running rows in the sessions pane keyboard cycle", () => {
    const onSelectSession = vi.fn();
    render(
      <QuickSwitcher
        {...baseProps}
        activeWorkspaceId={null}
        activeThreadId={null}
        runningSessions={runningSessions}
        onSelectSession={onSelectSession}
      />,
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Enter" });
    expect(onSelectSession).toHaveBeenCalledWith("workspace-a", "running-thread");

    fireEvent.keyDown(dialog, { key: "ArrowDown" });
    fireEvent.keyDown(dialog, { key: "Enter" });
    expect(onSelectSession).toHaveBeenLastCalledWith("workspace-a", "current-thread");
  });

  it("wraps keyboard navigation around the first and last session rows", () => {
    const onSelectSession = vi.fn();
    render(
      <QuickSwitcher
        {...baseProps}
        activeWorkspaceId={null}
        activeThreadId={null}
        onSelectSession={onSelectSession}
      />,
    );

    const dialog = screen.getByRole("dialog");
    // First row + ArrowUp wraps to the last row.
    fireEvent.keyDown(dialog, { key: "ArrowUp" });
    fireEvent.keyDown(dialog, { key: "Enter" });
    expect(onSelectSession).toHaveBeenLastCalledWith("workspace-a", "next-thread");

    // Last row + ArrowDown wraps back to the first row.
    fireEvent.keyDown(dialog, { key: "ArrowDown" });
    fireEvent.keyDown(dialog, { key: "Enter" });
    expect(onSelectSession).toHaveBeenLastCalledWith("workspace-a", "current-thread");
  });

  it("drops a workspace group entirely when its only recent session is running", () => {
    const groupsWithOnlyRunningSession = [
      {
        ...sessionGroups[0]!,
        sessions: [
          {
            workspaceId: "workspace-a",
            id: "running-thread",
            title: "Duplicated running session",
            updatedAt: 21,
            engine: "codex" as const,
            isShared: false,
          },
        ],
      },
    ];
    const { container } = render(
      <QuickSwitcher
        {...baseProps}
        sessionGroups={groupsWithOnlyRunningSession}
        runningSessions={runningSessions}
      />,
    );

    const sessionsPane = container.querySelector(
      '.quick-switcher-recent-pane[aria-label="quickSwitcher.recentSessions"]',
    );
    expect(sessionsPane).toBeTruthy();
    const headings = sessionsPane!.querySelectorAll(
      ".quick-switcher-workspace-heading",
    );
    // Only the running-section heading remains: the emptied workspace group
    // (including its heading) must not render at all.
    expect(headings).toHaveLength(1);
    expect(headings[0]?.textContent).toContain("quickSwitcher.runningSessions");
    expect(screen.queryByText("Duplicated running session")).toBeNull();
    // The pane is not empty thanks to the running section, so no empty hint.
    expect(screen.queryByText("quickSwitcher.emptySessions")).toBeNull();
  });

  it("omits the relative time for running sessions without a start timestamp", () => {
    const pendingRunningSession = {
      ...runningSessions[0]!,
      threadId: "pending-thread",
      threadName: "Pending start session",
      startedAt: null,
    };
    render(
      <QuickSwitcher
        {...baseProps}
        runningSessions={[...runningSessions, pendingRunningSession]}
      />,
    );

    const startedRow = screen.getByText("Running session").closest("button");
    expect(startedRow?.querySelector("time")).toBeTruthy();
    const pendingRow = screen
      .getByText("Pending start session")
      .closest("button");
    expect(pendingRow).toBeTruthy();
    expect(pendingRow!.querySelector("time")).toBeNull();
  });

  it("hides notes, project map and memory after those plugs are uninstalled", () => {
    publishPluginRackSnapshot({
      ...DECLARED_PLUGIN_RACK_SNAPSHOT,
      plugs: DECLARED_PLUGIN_RACK_SNAPSHOT.plugs.map((plug) =>
        plug.pluginId === "com.mossx.notes" ||
        plug.pluginId === "com.mossx.project-map"
          ? { ...plug, desiredState: "uninstalled" }
          : plug,
      ),
    });

    render(<QuickSwitcher {...baseProps} />);

    expect(screen.queryByText("quickSwitcher.nav.notes")).toBeNull();
    expect(screen.queryByText("quickSwitcher.nav.projectMap")).toBeNull();
    expect(screen.queryByText("quickSwitcher.nav.memory")).toBeNull();
    expect(screen.getByText("quickSwitcher.nav.chat")).toBeTruthy();
    expect(screen.getByText("quickSwitcher.nav.settings")).toBeTruthy();
  });
});
