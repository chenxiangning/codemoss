// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MainHeader } from "./MainHeader";
import { TopbarSessionTabs } from "./TopbarSessionTabs";

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

const workspace = {
  id: "w1",
  name: "Workspace 1",
  path: "/tmp/w1",
  connected: true,
  settings: {
    sidebarCollapsed: false,
  },
};

function renderHeaderWithWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
  const onExtraAction = vi.fn();
  const onSelectThread = vi.fn();

  render(
    <MainHeader
      workspace={workspace}
      openTargets={[]}
      openAppIconById={{}}
      selectedOpenAppId=""
      onSelectOpenAppId={() => {}}
      sessionTabsNode={
        <TopbarSessionTabs
          ariaLabel="topbar tabs"
          onSelectThread={onSelectThread}
          onCloseThread={vi.fn()}
          onShowTabMenu={vi.fn()}
          tabs={[
            {
              workspaceId: "w2",
              threadId: "t1",
              label: "Session A",
              displayLabel: "Sess...",
              engineType: "codex",
              engineLabel: "Codex",
              isActive: false,
            },
            {
              workspaceId: "w1",
              threadId: "t2",
              label: "Session B",
              displayLabel: "Sess...",
              engineType: "claude",
              engineLabel: "Claude",
              isActive: true,
            },
            {
              workspaceId: "w1",
              threadId: "t3",
              label: "Session C",
              displayLabel: "Sess...",
              engineType: "kimi",
              engineLabel: "Kimi",
              isActive: false,
            },
          ]}
        />
      }
      extraActionsNode={
        <button type="button" onClick={onExtraAction} data-testid="extra-action">
          extra action
        </button>
      }
    />,
  );

  return { onExtraAction, onSelectThread };
}

describe("MainHeader topbar session tabs integration", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each([1280, 1024, 800])(
    "keeps active tab visible and actions clickable at width %d",
    (width) => {
      const { onExtraAction, onSelectThread } = renderHeaderWithWidth(width);
      expect(screen.getByRole("tab", { name: "Claude · Session B" })).toBeTruthy();
      fireEvent.click(screen.getByTestId("extra-action"));
      expect(onExtraAction).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("tab", { name: "Codex · Session A" }));
      expect(onSelectThread).toHaveBeenCalledWith("w2", "t1");
    },
  );

  it("stamps each tab with its engine for the branded underline", () => {
    renderHeaderWithWidth(1280);

    expect(
      screen.getByRole("tab", { name: "Codex · Session A" }).getAttribute("data-engine"),
    ).toBe("codex");
    expect(
      screen.getByRole("tab", { name: "Claude · Session B" }).getAttribute("data-engine"),
    ).toBe("claude");
    expect(
      screen.getByRole("tab", { name: "Kimi · Session C" }).getAttribute("data-engine"),
    ).toBe("kimi");
  });

  it("keeps draggable blank lanes around the topbar session tabs", () => {
    renderHeaderWithWidth(1280);

    const slot = document.querySelector(".main-header-session-tabs-slot");
    expect(slot?.getAttribute("data-tauri-drag-region")).toBe("false");

    const interactive = document.querySelector(".main-header-session-tabs-interactive");
    expect(interactive?.getAttribute("data-tauri-drag-region")).toBe("false");

    const dragLane = document.querySelector(".main-header-session-tabs-drag-lane");
    expect(dragLane?.hasAttribute("data-tauri-drag-region")).toBe(true);
  });

  it("adds Copy path to the open app menu", () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    renderHeaderWithWidth(1280);

    fireEvent.click(screen.getByRole("button", { name: "common.moreActions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /files\.copyPath/ }));

    expect(writeText).toHaveBeenCalledWith("/tmp/w1");
  });

  it("removes hidden launch and open-app controls from the header", () => {
    render(
      <MainHeader
        workspace={workspace}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => {}}
        launchScript="npm test"
        launchScriptEditorOpen={false}
        launchScriptDraft="npm test"
        launchScriptSaving={false}
        launchScriptError={null}
        onRunLaunchScript={vi.fn()}
        onOpenLaunchScriptEditor={vi.fn()}
        onCloseLaunchScriptEditor={vi.fn()}
        onLaunchScriptDraftChange={vi.fn()}
        onSaveLaunchScript={vi.fn()}
        showLaunchScriptControls={false}
        showOpenAppMenu={false}
      />,
    );

    expect(document.querySelector(".launch-script-cluster")).toBeNull();
    expect(document.querySelector(".open-app-menu")).toBeNull();
  });
});
