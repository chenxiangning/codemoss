// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canvasSnapshot: {
    workspaceId: "workspace-old",
    threadId: "shared:old-session",
  },
  subagentSelection: null as unknown,
  subagentDrawerProps: null as null | {
    workspaceId: string | null | undefined;
    workspacePath: string | null | undefined;
  },
  surfaceProps: null as null | {
    workspaceId: string | null | undefined;
    threadId: string | null | undefined;
  },
}));

vi.mock("../../layout/hooks/activeCanvasStore", () => ({
  shallowEqual: (left: unknown, right: unknown) => left === right,
  useActiveCanvasSelector: (
    selector: (snapshot: typeof mocks.canvasSnapshot) => unknown,
  ) => selector(mocks.canvasSnapshot),
}));

vi.mock("../../subagent-ui", () => ({
  closeSubagentInspector: vi.fn(),
  closeSubagentInspectorIfScopeChanged: vi.fn(),
  ConversationInspectorSplit: ({
    conversationSurface,
    inspectorNode,
  }: {
    conversationSurface: React.ReactNode;
    inspectorNode: React.ReactNode;
  }) => (
    <>
      {conversationSurface}
      {inspectorNode}
    </>
  ),
  SubagentInspectorDrawer: (props: typeof mocks.subagentDrawerProps) => {
    mocks.subagentDrawerProps = props;
    return null;
  },
  useSubagentInspectorSelection: () => mocks.subagentSelection,
}));

vi.mock("../store/squadStore", () => ({
  closeSquadInspector: vi.fn(),
  closeSquadInspectorIfScopeChanged: vi.fn(),
  useSquadInspectorSelection: () => null,
}));

vi.mock("./SquadConversationSurface", () => ({
  SquadConversationSurface: (props: typeof mocks.surfaceProps) => {
    mocks.surfaceProps = props;
    return <div data-testid="squad-surface" />;
  },
}));

import { SquadConversationInspectorHost } from "./SquadConversationInspectorHost";

describe("SquadConversationInspectorHost owner scope", () => {
  afterEach(() => {
    cleanup();
    mocks.subagentSelection = null;
    mocks.subagentDrawerProps = null;
    mocks.surfaceProps = null;
  });

  it("keeps the Canvas workspace/thread pair atomic during layout navigation", () => {
    render(
      <SquadConversationInspectorHost
        messagesNode={<div />}
        composerNode={null}
        workspaceId="workspace-new"
      />,
    );

    expect(mocks.surfaceProps).toEqual({
      workspaceId: "workspace-old",
      threadId: "shared:old-session",
    });
  });

  it("preserves the legacy SubAgent layout workspace precedence", () => {
    mocks.subagentSelection = { id: "legacy-subagent" };

    render(
      <SquadConversationInspectorHost
        messagesNode={<div />}
        composerNode={null}
        workspaceId="workspace-new"
      />,
    );

    expect(mocks.subagentDrawerProps).toEqual({
      workspaceId: "workspace-new",
      workspacePath: null,
    });
  });
});
