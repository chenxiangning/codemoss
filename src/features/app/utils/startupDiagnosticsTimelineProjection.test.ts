import { describe, expect, it } from "vitest";
import type { StartupTraceEvent } from "../../startup-orchestration/utils/startupTrace";
import type { GlobalRuntimeNotice } from "../../../services/globalRuntimeNotices";
import {
  projectStartupDiagnosticsTimeline,
  resolveStartupTimelineProject,
} from "./startupDiagnosticsTimelineProjection";

function taskEvent(
  sequence: number,
  lifecycleState: Extract<StartupTraceEvent, { type: "task" }>["lifecycleState"],
  overrides: Partial<Extract<StartupTraceEvent, { type: "task" }>> = {},
): Extract<StartupTraceEvent, { type: "task" }> {
  return {
    type: "task",
    sequence,
    timestamp: sequence,
    taskId: "workspace-list:critical",
    phase: "critical",
    traceLabel: "workspace/list",
    workspaceScope: "global",
    lifecycleState,
    durationMs: lifecycleState === "completed" ? 48 : null,
    fallbackReason: null,
    cancellationMode: null,
    commandLabel: "list_workspaces",
    ...overrides,
  };
}

function commandEvent(
  sequence: number,
  commandLabel: string,
  workspaceId: string,
  durationMs: number,
  status: "completed" | "failed" = "completed",
): Extract<StartupTraceEvent, { type: "command" }> {
  return {
    type: "command",
    sequence,
    timestamp: sequence,
    commandLabel,
    workspaceScope: { workspaceId },
    durationMs,
    status,
  };
}

function runtimeNotice(
  id: string,
  timestampMs: number,
  messageKey: string,
  overrides: Partial<GlobalRuntimeNotice> = {},
): GlobalRuntimeNotice {
  return {
    id,
    severity: "info",
    category: "runtime",
    messageKey,
    messageParams: { workspace: "Alpha", engine: "Codex" },
    timestampMs,
    repeatCount: 1,
    dedupeKey: id,
    ...overrides,
  };
}

const WORKSPACES = [
  { id: "ws-a", name: "Alpha", path: "/repo/alpha" },
  { id: "ws-b", name: "Beta", path: "C:\\repo\\beta" },
];

describe("projectStartupDiagnosticsTimeline", () => {
  it("folds task lifecycle and its command into one execution", () => {
    const projection = projectStartupDiagnosticsTimeline({
      events: [
        taskEvent(1, "queued"),
        taskEvent(2, "started"),
        {
          type: "command",
          sequence: 3,
          timestamp: 3,
          commandLabel: "list_workspaces",
          workspaceScope: "global",
          durationMs: 31,
          status: "completed",
        },
        taskEvent(4, "completed"),
      ],
      notices: [],
      workspaces: WORKSPACES,
    });

    const node = projection.sections[0].nodes.find(
      (candidate) => candidate.operationKey === "workspace-catalog",
    );
    expect(node).toMatchObject({
      count: 1,
      phase: "critical",
      status: "completed",
      sourceKinds: ["task", "command"],
    });
    expect(node?.timing).toEqual({
      durationCount: 1,
      firstDurationMs: 31,
      latestDurationMs: 31,
      maxDurationMs: 31,
      totalDurationMs: 31,
    });
    expect(node?.technicalLabels).toContain("task:workspace-list:critical");
    expect(node?.technicalLabels).toContain("cmd:list_workspaces");
  });

  it("counts repeated executions once per lifecycle, not once per transition", () => {
    const projection = projectStartupDiagnosticsTimeline({
      events: [
        taskEvent(1, "queued", { commandLabel: null }),
        taskEvent(2, "started", { commandLabel: null }),
        taskEvent(3, "completed", { commandLabel: null, durationMs: 20 }),
        taskEvent(4, "started", { commandLabel: null }),
        taskEvent(5, "completed", { commandLabel: null, durationMs: 30 }),
      ],
      notices: [],
      workspaces: WORKSPACES,
    });

    const node = projection.sections[0].nodes.find(
      (candidate) => candidate.operationKey === "workspace-catalog",
    );
    expect(node?.count).toBe(2);
    expect(node?.timing).toMatchObject({
      firstDurationMs: 20,
      latestDurationMs: 30,
      maxDurationMs: 30,
      totalDurationMs: 50,
    });
  });

  it("merges repeats only within the same project and result status", () => {
    const projection = projectStartupDiagnosticsTimeline({
      events: [
        commandEvent(1, "list_threads", "ws-a", 10),
        commandEvent(2, "list_threads", "ws-a", 20),
        commandEvent(3, "list_threads", "ws-b", 30),
        commandEvent(4, "list_threads", "ws-a", 5, "failed"),
      ],
      notices: [],
      workspaces: WORKSPACES,
    });
    const sessionNodes = projection.sections[0].nodes.filter(
      (node) => node.operationKey === "session-catalog",
    );

    expect(sessionNodes).toHaveLength(3);
    expect(
      sessionNodes.find(
        (node) => node.project.label === "Alpha" && node.status === "completed",
      ),
    ).toMatchObject({
      count: 2,
      timing: {
        durationCount: 2,
        firstDurationMs: 10,
        latestDurationMs: 20,
        maxDurationMs: 20,
        totalDurationMs: 30,
      },
    });
    expect(
      sessionNodes.find(
        (node) => node.project.label === "Beta" && node.status === "completed",
      )?.count,
    ).toBe(1);
    expect(
      sessionNodes.find(
        (node) => node.project.label === "Alpha" && node.status === "failed",
      )?.count,
    ).toBe(1);
  });

  it("keeps startup sequence and runtime wall-clock ordering separate", () => {
    const projection = projectStartupDiagnosticsTimeline({
      events: [
        commandEvent(8, "prompts_list", "ws-a", 12),
        commandEvent(3, "skills_list", "ws-a", 9),
      ],
      notices: [
        runtimeNotice("ready", 200, "runtimeNotice.runtime.ready"),
        runtimeNotice("pending", 100, "runtimeNotice.runtime.startupPending"),
        runtimeNotice("mirror", 50, "runtimeNotice.startup.commandCompleted", {
          category: "diagnostic",
          messageParams: {
            workspace: "Alpha",
            command: "skills_list",
            durationMs: 9,
          },
        }),
      ],
      workspaces: WORKSPACES,
    });

    expect(projection.sections[0].nodes.map((node) => node.operationKey)).toEqual([
      "skills",
      "prompts",
    ]);
    expect(projection.sections[1].nodes.map((node) => node.titleKey)).toEqual([
      "runtimeNotice.runtime.startupPending",
      "runtimeNotice.runtime.ready",
    ]);
    expect(projection.rawCount).toBe(5);
    expect(projection.nodeCount).toBe(4);
  });

  it("uses an honest fallback for unknown operations", () => {
    const projection = projectStartupDiagnosticsTimeline({
      events: [commandEvent(1, "mystery_backend_probe", "ws-a", 7)],
      notices: [],
      workspaces: WORKSPACES,
    });
    const node = projection.sections[0].nodes[0];

    expect(node).toMatchObject({
      operationKey: "unknown-command",
      fallbackTitle: "mystery_backend_probe",
      titleKey: null,
      descriptionKey: "runtimeNotice.startupTimeline.fallback.command",
    });
  });

  it("ignores non-numeric notice durations at the boundary", () => {
    const projection = projectStartupDiagnosticsTimeline({
      events: [],
      notices: [
        runtimeNotice("ready", 200, "runtimeNotice.runtime.ready", {
          messageParams: { workspace: "Alpha", durationMs: "42ms" },
        }),
      ],
      workspaces: WORKSPACES,
    });

    expect(projection.sections[1].nodes[0]?.timing).toEqual({
      durationCount: 0,
      firstDurationMs: null,
      latestDurationMs: null,
      maxDurationMs: null,
      totalDurationMs: null,
    });
  });
});

describe("resolveStartupTimelineProject", () => {
  it("uses name, path basename, then workspace id without issuing IO", () => {
    expect(
      resolveStartupTimelineProject({ workspaceId: "ws-a" }, WORKSPACES),
    ).toMatchObject({ label: "Alpha", path: "/repo/alpha" });
    expect(
      resolveStartupTimelineProject(
        { workspaceId: "ws-b" },
        [{ id: "ws-b", name: "  ", path: "C:\\repo\\beta" }],
      ),
    ).toMatchObject({ label: "beta", path: "C:\\repo\\beta" });
    expect(
      resolveStartupTimelineProject(
        { workspaceId: "workspace-1234567890" },
        WORKSPACES,
      ),
    ).toMatchObject({ label: "workspace-12…", path: null });
  });
});
