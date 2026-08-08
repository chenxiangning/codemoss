// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";

import {
  clearCollabUiState,
  setCollabUiState,
} from "../store/collabUiStore";
import { CollabTimelineWaiting } from "./CollabTimelineWaiting";

const WS = "ws-1";
const THREAD = "shared:t-1";

afterEach(() => {
  clearCollabUiState(WS, THREAD);
});

describe("CollabTimelineWaiting", () => {
  it("renders nothing without an active collab state", () => {
    const { container } = render(
      <CollabTimelineWaiting workspaceId={WS} threadId={THREAD} />,
    );
    expect(container.querySelector(".ma-collab-waiting")).toBeNull();
  });

  it("shows loading only for starting_stages; summarizing uses sticky only", () => {
    act(() => {
      setCollabUiState({
        workspaceId: WS,
        threadId: THREAD,
        phase: "running_stages",
        headline: "run",
        detail: "detail",
        requestText: "task",
        flowLabel: "规划 → 实现 → 审查",
      });
    });
    const running = render(
      <CollabTimelineWaiting workspaceId={WS} threadId={THREAD} />,
    );
    // 运行中由 sticky OrchCard 承担动画，时间线不重复
    expect(running.container.querySelector(".ma-collab-waiting")).toBeNull();

    act(() => {
      setCollabUiState({
        workspaceId: WS,
        threadId: THREAD,
        phase: "starting_stages",
        headline: "starting",
        detail: "detail",
        requestText: "task",
        flowLabel: "规划 → 实现 → 审查",
      });
    });
    const starting = render(
      <CollabTimelineWaiting workspaceId={WS} threadId={THREAD} />,
    );
    expect(
      starting.container.querySelector(".ma-collab-waiting"),
    ).not.toBeNull();

    act(() => {
      setCollabUiState({
        workspaceId: WS,
        threadId: THREAD,
        phase: "summarizing",
        headline: "sum",
        detail: "detail",
        requestText: "task",
        flowLabel: "规划 → 实现 → 审查",
      });
    });
    const summarizing = render(
      <CollabTimelineWaiting workspaceId={WS} threadId={THREAD} />,
    );
    // 汇总阶段只保留对话框上方 sticky，主幕时间线不再刷 loading
    expect(
      summarizing.container.querySelector(".ma-collab-waiting"),
    ).toBeNull();
  });
});
