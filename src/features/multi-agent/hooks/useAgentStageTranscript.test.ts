import { describe, expect, it } from "vitest";

import type { ConversationItem } from "../../../types";
import type { AgentStageProjection } from "../types";
import {
  alignItemsToStageTarget,
  buildStageOwnedFallback,
  filterProjectionItemsForAttempt,
  isWeakStatusText,
  stageTargetToSnapshot,
} from "./useAgentStageTranscript";

const implementStage: AgentStageProjection = {
  id: "implement",
  title: "实现",
  role: "implementer",
  target: {
    engine: "codex",
    model: "deepseek-v4-flash",
    modelCatalogEntryId: "deepseek-v4-flash",
    providerProfileNameSnapshot: "DeepSeek-codex",
    providerProfileSource: "managed",
    providerProfileId: "89104535-73b9-4620-bb0e-188b0ad41300",
    reasoningEffort: "medium",
  },
  status: "succeeded",
  accessMode: "current",
  attemptId: "attempt-implement",
  fullOutcome: "先看项目结构，确认包名与现有代码。",
  shortOutcome: "实现完成",
};

describe("filterProjectionItemsForAttempt", () => {
  it("only keeps matching attemptId", () => {
    const items = [
      { content: { attemptId: "attempt-implement", text: "impl" } },
      { content: { attemptId: "attempt-plan", text: "plan" } },
      { content: { turnId: "attempt-implement", text: "by-turn" } },
      { content: { text: "no-id" } },
    ];
    const sliced = filterProjectionItemsForAttempt(
      items,
      "attempt-implement",
    );
    expect(sliced).toHaveLength(2);
    expect(
      sliced.every((i) => {
        const c = i.content ?? {};
        return (
          c.attemptId === "attempt-implement" ||
          c.turnId === "attempt-implement"
        );
      }),
    ).toBe(true);
  });

  it("returns empty when attempt missing", () => {
    expect(filterProjectionItemsForAttempt([{ content: {} }], "")).toEqual(
      [],
    );
  });
});

describe("isWeakStatusText", () => {
  it("flags status-only tokens", () => {
    expect(isWeakStatusText("completed")).toBe(true);
    expect(isWeakStatusText("失败")).toBe(true);
  });

  it("keeps real bodies", () => {
    expect(
      isWeakStatusText("## 任务理解\n\n新增电风扇商品入库 CRUD。"),
    ).toBe(false);
  });
});

describe("alignItemsToStageTarget", () => {
  it("rewrites assistant badge to stage target", () => {
    const items: ConversationItem[] = [
      {
        id: "a1",
        kind: "message",
        role: "assistant",
        text: "SUMMARY: plan body leaked",
        executionTargetSnapshot: {
          engine: "claude",
          model: "k3",
          providerProfileNameSnapshot: "本地配置",
          providerProfileSource: "local",
        },
      },
    ];
    const next = alignItemsToStageTarget(items, implementStage);
    expect(next[0]?.kind).toBe("message");
    if (next[0]?.kind === "message") {
      expect(next[0].executionTargetSnapshot?.engine).toBe("codex");
      expect(next[0].executionTargetSnapshot?.model).toBe("deepseek-v4-flash");
      expect(next[0].executionTargetSnapshot?.providerProfileNameSnapshot).toBe(
        "DeepSeek-codex",
      );
    }
  });
});

describe("buildStageOwnedFallback", () => {
  it("contract 2: implement stage must not use plan.markdown", () => {
    const items = buildStageOwnedFallback({
      stage: implementStage,
      projection: {
        schemaVersion: 1,
        runId: "run-1",
        workspaceId: "ws",
        workspaceRoot: "/tmp",
        sessionId: "sess",
        requestText: "hello",
        target: implementStage.target,
        status: "succeeded",
        planRevision: 1,
        plan: {
          schemaVersion: 1,
          summary: "plan summary",
          markdown: "SUMMARY: 这是规划正文，不该出现在实现卡",
        },
        stages: [implementStage],
        activeAttemptIds: [],
        diagnostics: [],
        requestedAt: 1,
        updatedAt: 1,
      },
      liveText: "",
      isLive: false,
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("message");
    if (items[0]?.kind === "message") {
      expect(items[0].text).toContain("先看项目结构");
      expect(items[0].text).not.toContain("这是规划正文");
      expect(items[0].executionTargetSnapshot?.engine).toBe("codex");
    }
  });

  it("contract 2: review stage must not use plan.markdown", () => {
    const reviewStage: AgentStageProjection = {
      ...implementStage,
      id: "review",
      title: "审查",
      role: "reviewer",
      fullOutcome: "审查通过：主链路齐备。",
      shortOutcome: "审查通过",
      target: {
        engine: "grok",
        model: "grok",
        providerProfileNameSnapshot: "xAI",
        providerProfileSource: "managed",
        reasoningEffort: "high",
      },
    };
    const items = buildStageOwnedFallback({
      stage: reviewStage,
      projection: {
        schemaVersion: 1,
        runId: "run-1",
        workspaceId: "ws",
        workspaceRoot: "/tmp",
        sessionId: "sess",
        requestText: "hello",
        target: reviewStage.target,
        status: "reviewing",
        planRevision: 1,
        plan: {
          schemaVersion: 1,
          summary: "plan summary",
          markdown: "SUMMARY: PLAN_MARKDOWN_LEAK_MARKER",
        },
        stages: [implementStage, reviewStage],
        activeAttemptIds: [],
        diagnostics: [],
        requestedAt: 1,
        updatedAt: 1,
      },
      liveText: "",
      isLive: false,
    });
    expect(items).toHaveLength(1);
    if (items[0]?.kind === "message") {
      expect(items[0].text).toContain("审查通过");
      expect(items[0].text).not.toContain("PLAN_MARKDOWN_LEAK_MARKER");
      expect(items[0].executionTargetSnapshot?.engine).toBe("grok");
    }
  });

  it("contract 2: plan stage may use plan.markdown", () => {
    const planStage: AgentStageProjection = {
      ...implementStage,
      id: "plan",
      title: "规划",
      fullOutcome: "",
      shortOutcome: "",
      target: {
        engine: "claude",
        model: "k3",
        providerProfileNameSnapshot: "本地配置",
        providerProfileSource: "local",
        reasoningEffort: "high",
      },
    };
    const items = buildStageOwnedFallback({
      stage: planStage,
      projection: {
        schemaVersion: 1,
        runId: "run-1",
        workspaceId: "ws",
        workspaceRoot: "/tmp",
        sessionId: "sess",
        requestText: "hello",
        target: planStage.target,
        status: "awaiting-approval",
        planRevision: 1,
        plan: {
          schemaVersion: 1,
          summary: "s",
          markdown: "SUMMARY: 规划正文可用",
        },
        stages: [planStage],
        activeAttemptIds: [],
        diagnostics: [],
        requestedAt: 1,
        updatedAt: 1,
      },
      liveText: "",
      isLive: false,
    });
    expect(items[0]?.kind).toBe("message");
    if (items[0]?.kind === "message") {
      expect(items[0].text).toContain("规划正文可用");
      expect(items[0].executionTargetSnapshot?.engine).toBe("claude");
    }
  });
});

describe("stageTargetToSnapshot", () => {
  it("maps managed codex target", () => {
    const snap = stageTargetToSnapshot(implementStage.target);
    expect(snap?.engine).toBe("codex");
    expect(snap?.model).toBe("deepseek-v4-flash");
  });
});
