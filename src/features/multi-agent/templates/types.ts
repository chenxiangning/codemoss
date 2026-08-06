import type { EngineType } from "../../../types";
import type { AgentExecutionTarget, AgentStageBinding } from "../types";

export type ReasoningEffortLevel = string;

/** 模板内单个环节：完整 ExecutionTarget + 提示词 + 批准点。 */
export type CollaborationTemplateStage = {
  id: string;
  title: string;
  rolePrompt: string;
  target: AgentExecutionTarget;
  accessMode: "read-only" | "current";
  requiresApproval: boolean;
};

export type CollaborationTemplate = {
  id: string;
  name: string;
  description: string;
  builtin: boolean;
  stages: CollaborationTemplateStage[];
  version: number;
  updatedAt: number;
};

export type TemplateCatalog = {
  selectedId: string;
  defaultId: string;
  custom: CollaborationTemplate[];
};

export function templateFlowLabel(template: CollaborationTemplate): string {
  return template.stages.map((stage) => stage.title).join(" → ");
}

export function templateApprovalCount(template: CollaborationTemplate): number {
  return template.stages.filter((stage) => stage.requiresApproval).length;
}

/** 前端 picker 用 disk；后端 validate 认 local。发送前统一。 */
export function normalizeAgentTargetSource(
  target: AgentExecutionTarget,
): AgentExecutionTarget {
  const source = target.providerProfileSource?.trim();
  if (source === "disk") {
    return { ...target, providerProfileSource: "local" };
  }
  return target;
}

function isCompleteAgentTarget(target: AgentExecutionTarget): boolean {
  const model = target.model?.trim() || "";
  const catalog = target.modelCatalogEntryId?.trim() || "";
  const name = target.providerProfileNameSnapshot?.trim() || "";
  const source = target.providerProfileSource?.trim() || "";
  if (!model || !catalog || !name || !source) return false;
  // managed 必须有 profileId；local/disk 可无 profileId
  if (source === "managed" && !target.providerProfileId?.trim()) return false;
  return true;
}

/**
 * 合并阶段 target 与会话入口 target。
 * - 完整阶段 target（用户在 picker 选完）→ 原样用
 * - 同引擎未完成 → 用会话 target 补全，仅保留阶段 reasoningEffort 偏好
 * - 跨引擎未完成 → 回退会话 target（避免 claude 引擎 + codex model 非法组合）
 */
export function mergeTarget(
  stageTarget: AgentExecutionTarget,
  fallback: AgentExecutionTarget,
): AgentExecutionTarget {
  if (isCompleteAgentTarget(stageTarget)) {
    return { ...stageTarget };
  }
  if (stageTarget.engine === fallback.engine) {
    return {
      ...fallback,
      engine: stageTarget.engine || fallback.engine,
      reasoningEffort:
        stageTarget.reasoningEffort ?? fallback.reasoningEffort ?? null,
      model: stageTarget.model ?? fallback.model ?? null,
      modelCatalogEntryId:
        stageTarget.modelCatalogEntryId ?? fallback.modelCatalogEntryId ?? null,
      providerProfileId:
        stageTarget.providerProfileId ?? fallback.providerProfileId ?? null,
      providerProfileNameSnapshot:
        stageTarget.providerProfileNameSnapshot ??
        fallback.providerProfileNameSnapshot ??
        null,
      providerProfileSource:
        stageTarget.providerProfileSource ??
        fallback.providerProfileSource ??
        null,
    };
  }
  // 跨引擎且未配齐：安全回退入口 target，避免 validate_resolved 炸
  return {
    ...fallback,
    reasoningEffort:
      stageTarget.reasoningEffort ?? fallback.reasoningEffort ?? null,
  };
}

/** 模板 → 后端 stageBindings（完整 N 段，不压成 3 段）。 */
export function templateToStageBindings(
  template: CollaborationTemplate,
  fallback: AgentExecutionTarget,
): AgentStageBinding[] {
  const base = normalizeAgentTargetSource(fallback);
  return template.stages.map((stage) => ({
    id: stage.id,
    title: stage.title,
    rolePrompt: stage.rolePrompt || null,
    accessMode: stage.accessMode,
    requiresApproval: stage.requiresApproval,
    target: normalizeAgentTargetSource(mergeTarget(stage.target, base)),
  }));
}

export function emptyTarget(engine: EngineType = "claude"): AgentExecutionTarget {
  return {
    engine,
    providerProfileId: null,
    modelCatalogEntryId: null,
    model: null,
    reasoningEffort: null,
    providerProfileNameSnapshot: null,
    providerProfileSource: null,
    runtimeCapabilityFingerprint: null,
  };
}

export function stageTargetLabel(target: AgentExecutionTarget): string {
  const engine = target.engine ?? "—";
  const model =
    target.model?.trim() ||
    target.providerProfileNameSnapshot?.trim() ||
    "";
  const effort = target.reasoningEffort?.trim();
  const parts = [String(engine)];
  if (model) parts.push(model);
  if (effort) parts.push(effort);
  return parts.join(" · ");
}
