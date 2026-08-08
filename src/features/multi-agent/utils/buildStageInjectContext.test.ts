import { describe, expect, it } from "vitest";
import type { AgentProjectionV1, AgentStageProjection } from "../types";
import { buildStageInjectContext } from "./buildStageInjectContext";

function stage(
  partial: Partial<AgentStageProjection> & Pick<AgentStageProjection, "id">,
): AgentStageProjection {
  return {
    id: partial.id,
    title: partial.title ?? partial.id,
    role: partial.role ?? partial.id,
    target: partial.target ?? { engine: "claude" },
    status: partial.status ?? "pending",
    accessMode: partial.accessMode ?? "read-only",
    rolePrompt: partial.rolePrompt,
    shortOutcome: partial.shortOutcome,
    fullOutcome: partial.fullOutcome,
    upstreamFeedMode: partial.upstreamFeedMode,
    personaPrompt: partial.personaPrompt,
    personaAgentName: partial.personaAgentName,
  };
}

function projection(
  partial: Partial<AgentProjectionV1> &
    Pick<AgentProjectionV1, "requestText" | "stages">,
): AgentProjectionV1 {
  return {
    schemaVersion: 1,
    runId: "run-1",
    workspaceId: "ws",
    workspaceRoot: "/tmp",
    sessionId: "shared:1",
    requestText: partial.requestText,
    userVisibleText: partial.userVisibleText,
    target: { engine: "claude" },
    status: partial.status ?? "implementing",
    planRevision: 1,
    plan: partial.plan ?? null,
    stages: partial.stages,
    requestedAt: 1,
    updatedAt: 2,
    approvalNote: partial.approvalNote,
    approvedAt: partial.approvedAt,
  };
}

describe("buildStageInjectContext", () => {
  it("returns empty when no injectable fields", () => {
    const ctx = buildStageInjectContext(
      projection({
        requestText: "   ",
        stages: [stage({ id: "plan" })],
      }),
      0,
    );
    expect(ctx.itemCount).toBe(0);
    expect(ctx.sections).toEqual([]);
  });

  it("first stage: user + role, no upstream", () => {
    const ctx = buildStageInjectContext(
      projection({
        requestText: "1+1",
        stages: [
          stage({
            id: "plan",
            title: "规划",
            rolePrompt: "请产出计划",
            status: "running",
          }),
        ],
      }),
      0,
    );
    expect(ctx.sections.map((s) => s.id)).toEqual(["user", "role"]);
    expect(ctx.sections.find((s) => s.id === "user")?.body).toBe("1+1");
    expect(ctx.pipe.some((p) => p.status === "current")).toBe(true);
    expect(ctx.pipe.filter((p) => p.sectionId === "upstream")).toHaveLength(0);
  });

  it("prefers userVisibleText over requestText", () => {
    const ctx = buildStageInjectContext(
      projection({
        requestText: "raw",
        userVisibleText: "visible",
        stages: [stage({ id: "plan", rolePrompt: "r" })],
      }),
      0,
    );
    expect(ctx.sections.find((s) => s.id === "user")?.body).toBe("visible");
  });

  it("middle stage includes upstream plan and approval note; hides persona body", () => {
    const ctx = buildStageInjectContext(
      projection({
        requestText: "1+1",
        approvalNote: "不要动鉴权",
        plan: {
          schemaVersion: 1,
          summary: "实现 add 与单测",
          markdown: "# plan\n很长",
        },
        stages: [
          stage({
            id: "plan",
            title: "规划",
            status: "succeeded",
            shortOutcome: "已规划",
          }),
          stage({
            id: "implement",
            title: "实现",
            status: "running",
            rolePrompt: "按规划实现",
            personaPrompt: "秘密人设不应展示",
          }),
        ],
      }),
      1,
    );
    const ids = ctx.sections.map((s) => s.id);
    expect(ids).toContain("user");
    expect(ids).toContain("upstream");
    expect(ids).toContain("approvalNote");
    expect(ids).toContain("role");
    expect(ctx.sections.find((s) => s.id === "approvalNote")?.body).toBe(
      "不要动鉴权",
    );
    expect(ctx.sections.find((s) => s.id === "upstream")?.body).toContain(
      "实现 add",
    );
    expect(
      ctx.sections.some((s) => s.body.includes("秘密人设不应展示")),
    ).toBe(false);
    expect(ctx.itemCount).toBe(4);
  });

  it("full feed mode prefers prior fullOutcome over short", () => {
    const longFull = "全文润色稿".repeat(20);
    const ctx = buildStageInjectContext(
      projection({
        requestText: "赞美这张图",
        stages: [
          stage({
            id: "draft",
            title: "起草",
            status: "succeeded",
            shortOutcome: "短摘要",
            fullOutcome: longFull,
          }),
          stage({
            id: "polish",
            title: "润色",
            status: "running",
            rolePrompt: "润色",
            upstreamFeedMode: "full",
          }),
        ],
      }),
      1,
    );
    const up = ctx.sections.find((s) => s.id === "upstream")?.body ?? "";
    expect(up).toContain("全文润色稿");
    expect(up).not.toContain("短摘要");
  });
});
