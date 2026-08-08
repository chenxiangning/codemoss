// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import type { WorkspaceInfo } from "../../../types";
import { MainHeader } from "./MainHeader";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../../services/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/tauri")>();
  return {
    ...actual,
    revealInFileManager: vi.fn(),
    openWorkspaceIn: vi.fn(),
  };
});

const workspaceA: WorkspaceInfo = {
  id: "workspace-1",
  name: "Workspace 1",
  path: "/tmp/workspace-1",
  connected: true,
  settings: {
    sidebarCollapsed: false,
  },
};

const workspaceB: WorkspaceInfo = {
  id: "workspace-2",
  name: "Workspace 2",
  path: "/tmp/workspace-2",
  connected: true,
  settings: {
    sidebarCollapsed: false,
  },
};

const groupedWorkspaces = [
  {
    id: "group-1",
    name: "Main",
    workspaces: [workspaceA, workspaceB],
  },
];

const filesByWorkspace: Record<string, string[]> = {
  [workspaceA.id]: ["src/app.tsx", "src/sidebar.css"],
  [workspaceB.id]: ["src/feature.ts", "src/panel.css"],
};

function WorkspaceSwitchHarness() {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(workspaceA.id);
  const activeWorkspace = activeWorkspaceId === workspaceA.id ? workspaceA : workspaceB;
  const activeFiles = filesByWorkspace[activeWorkspaceId] ?? [];

  return (
    <div>
      <MainHeader
        workspace={activeWorkspace}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        groupedWorkspaces={groupedWorkspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSelectWorkspace={setActiveWorkspaceId}
      />
      <section aria-label="right-file-panel">
        {activeFiles.length === 0 ? (
          <span>blank-file-panel</span>
        ) : (
          <ul>
            {activeFiles.map((file) => (
              <li key={file}>{file}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

describe("MainHeader workspace switch regression", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps the right file panel populated after switching projects from the header dropdown", () => {
    render(<WorkspaceSwitchHarness />);

    expect(screen.getByText("src/app.tsx")).toBeTruthy();
    expect(screen.queryByText("blank-file-panel")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Workspace 1" }));
    expect(screen.getByRole("menu").classList.contains("workspace-project-dropdown")).toBe(true);
    expect(screen.getByRole("menu").classList.contains("popover-surface")).toBe(false);
    fireEvent.click(screen.getByRole("menuitem", { name: "Workspace 2" }));

    expect(screen.getByText("src/feature.ts")).toBeTruthy();
    expect(screen.getByText("src/panel.css")).toBeTruthy();
    expect(screen.queryByText("src/app.tsx")).toBeNull();
    expect(screen.queryByText("blank-file-panel")).toBeNull();
  });
});
