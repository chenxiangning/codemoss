import type { AgentProjectionV1, AgentStageProjection, AgentStageStatus } from "../types";
import { maT } from "./i18n";

export function formatDurationMs(
  startedAt?: number | null,
  settledAt?: number | null,
  now = Date.now(),
): string | null {
  if (!startedAt) return null;
  const end = settledAt ?? now;
  const ms = Math.max(0, end - startedAt);
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s === 0 ? `${m}m` : `${m}m${String(s).padStart(2, "0")}s`;
}

export function stageTargetLabel(stage: AgentStageProjection): string {
  const engine = stage.target?.engine ?? "—";
  const model =
    stage.target?.model?.trim() ||
    stage.target?.providerProfileNameSnapshot?.trim() ||
    "";
  const effort = stage.target?.reasoningEffort?.trim();
  const parts: string[] = [String(engine)];
  if (model) parts.push(model);
  if (effort) parts.push(effort);
  return parts.join(" · ");
}

/** Inspector 副标题：引擎/模型/强度 · 智能体名（若有） */
export function stageInspectorTypeLine(stage: AgentStageProjection): string {
  const target = stageTargetLabel(stage);
  const agent = stage.personaAgentName?.trim() || "";
  if (!agent) return target;
  const persona = maT("multiAgent.inspector.personaAgent", {
    name: agent,
    defaultValue: `智能体 ${agent}`,
  });
  return `${target} · ${persona}`;
}

export function runProgressRatio(projection: AgentProjectionV1): number {
  const stages = projection.stages ?? [];
  if (stages.length === 0) return 0;
  if (projection.status === "succeeded") return 1;
  const weight = (status: AgentStageStatus) => {
    if (status === "succeeded") return 1;
    if (status === "running") return 0.55;
    if (status === "failed") return 0.55;
    return 0;
  };
  const sum = stages.reduce((acc, stage) => acc + weight(stage.status), 0);
  return Math.min(1, sum / stages.length);
}

export function runStatusHeadline(projection: AgentProjectionV1): {
  kind: "active" | "done" | "failed" | "idle";
  stageTitle?: string;
} {
  if (projection.status === "succeeded") return { kind: "done" };
  if (projection.status === "failed" || projection.status === "cancelled") {
    return { kind: "failed" };
  }
  const running = (projection.stages ?? []).find(
    (stage) => stage.status === "running",
  );
  if (running) return { kind: "active", stageTitle: running.title || running.id };
  if (projection.status === "awaiting-approval") {
    return {
      kind: "active",
      stageTitle: maT("multiAgent.status.awaitingApprovalShort", {
        defaultValue: "待批准",
      }),
    };
  }
  return { kind: "idle" };
}

export function stageStatusText(
  stage: AgentStageProjection,
  options?: { approved?: boolean; live?: boolean },
): string {
  if (stage.status === "running" || options?.live) {
    return maT("multiAgent.stageStatus.runningLive", {
      defaultValue: "● 流式中…",
    });
  }
  if (stage.status === "succeeded") {
    const dur = formatDurationMs(stage.startedAt, stage.settledAt);
    if (options?.approved) {
      return dur
        ? maT("multiAgent.stageStatus.approvedWithDur", {
            dur,
            defaultValue: `✓ 已批准 ${dur}`,
          })
        : maT("multiAgent.stageStatus.approved", {
            defaultValue: "✓ 已批准",
          });
    }
    return dur
      ? maT("multiAgent.stageStatus.doneWithDur", {
          dur,
          defaultValue: `✓ ${dur}`,
        })
      : maT("multiAgent.stageStatus.done", { defaultValue: "✓ 完成" });
  }
  if (stage.status === "failed") {
    return maT("multiAgent.stageStatus.failed", { defaultValue: "失败" });
  }
  if (stage.status === "skipped") {
    return maT("multiAgent.stageStatus.skipped", { defaultValue: "已跳过" });
  }
  return maT("multiAgent.stageStatus.pending", { defaultValue: "排队" });
}
