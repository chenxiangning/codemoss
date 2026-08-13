/**
 * 协作 Inspector「注入上下文」view-model（纯函数）。
 * 只读 projection 字段，不拼完整 worker prompt。
 */
import type { AgentProjectionV1, AgentStageProjection } from "../types";
import {
  extractMainCanvasContextBody,
  stripMainCanvasContextBlock,
} from "../runtime/mainCanvasContextInjection";

export type InjectSectionId =
  | "mainCanvas"
  | "user"
  | "approvalNote"
  | "upstream"
  | "role";

export type InjectSection = {
  id: InjectSectionId;
  body: string;
  /** 上游分区：可跳转的 stage id */
  jumpStageId?: string | null;
  /** 上游标题旁的 stage 名 */
  upstreamTitle?: string | null;
};

export type InjectPipeNode = {
  id: string;
  sectionId: InjectSectionId;
  /** 展示用短标签（已是最终文案或 stage title） */
  label: string;
  status: "done" | "current" | "pending";
  jumpStageId?: string | null;
};

export type StageInjectContext = {
  sections: InjectSection[];
  pipe: InjectPipeNode[];
  /** 折叠态一行摘要（不含 i18n 前缀） */
  summaryParts: string[];
  itemCount: number;
};

const UPSTREAM_PREVIEW_CHARS = 480;
/** full 模式展示 cap（仍可 UI clamp；完整阅读用打开节点） */
const UPSTREAM_FULL_PREVIEW_CHARS = 4000;
const MAIN_CANVAS_PREVIEW_CHARS = 4000;

function trimText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function capPreview(text: string, max = UPSTREAM_PREVIEW_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function stageFeedMode(
  stage: AgentStageProjection | null,
): "summary" | "full" {
  return stage?.upstreamFeedMode === "full" ? "full" : "summary";
}

/** 用户任务：优先可见原文；fallback 时剥离主幕 digest 等注入块 */
function userTaskText(projection: AgentProjectionV1): string {
  const visible = trimText(projection.userVisibleText);
  if (visible) return visible;
  return stripMainCanvasContextBlock(projection.requestText);
}

function planPreview(projection: AgentProjectionV1): string {
  const plan = projection.plan;
  if (!plan) return "";
  const summary = trimText(plan.summary);
  if (summary) return capPreview(summary);
  const md = trimText(plan.markdown);
  if (md) return capPreview(md);
  const steps = (plan.steps ?? []).map((s) => trimText(s)).filter(Boolean);
  if (steps.length > 0) return capPreview(steps.join(" · "));
  return "";
}

function priorSucceededStages(
  stages: AgentStageProjection[],
  stageIndex: number,
): AgentStageProjection[] {
  return stages
    .slice(0, Math.max(0, stageIndex))
    .filter((s) => s.status === "succeeded" || Boolean(trimText(s.shortOutcome)));
}

/**
 * 组装当前节点注入上下文。无任何可展示项时 itemCount=0。
 */
export function buildStageInjectContext(
  projection: AgentProjectionV1,
  stageIndex: number,
  labels?: {
    user?: string;
    approvalNote?: string;
    role?: string;
    mainCanvas?: string;
  },
): StageInjectContext {
  const stages = projection.stages ?? [];
  const stage = stages[stageIndex] ?? null;
  const sections: InjectSection[] = [];
  const pipe: InjectPipeNode[] = [];
  const summaryParts: string[] = [];

  // 生产路径传入 i18n labels；fallback 用 English 避免漏传时污染非中文 UI
  const userLabel = labels?.user ?? "User";
  const noteLabel = labels?.approvalNote ?? "Approval note";
  const roleLabel = labels?.role ?? "This stage";
  const mainCanvasLabel = labels?.mainCanvas ?? "Main canvas";

  // 首段：主幕对话 digest（从 requestText 抽出）→ 人眼只在右栏看，不进主幕卡标题
  if (stageIndex === 0) {
    const mainBody = extractMainCanvasContextBody(projection.requestText);
    if (mainBody) {
      const body = capPreview(mainBody, MAIN_CANVAS_PREVIEW_CHARS);
      sections.push({ id: "mainCanvas", body });
      pipe.push({
        id: "pipe-main-canvas",
        sectionId: "mainCanvas",
        label: mainCanvasLabel,
        status: "done",
      });
      summaryParts.push(
        mainCanvasLabel.length > 12
          ? `${mainCanvasLabel.slice(0, 12)}…`
          : mainCanvasLabel,
      );
    }
  }

  const user = userTaskText(projection);
  if (user) {
    sections.push({ id: "user", body: user });
    pipe.push({
      id: "pipe-user",
      sectionId: "user",
      label: userLabel,
      status: "done",
    });
    summaryParts.push(user.length > 24 ? `${user.slice(0, 24)}…` : user);
  }

  const priors = stage ? priorSucceededStages(stages, stageIndex) : [];
  const planText = planPreview(projection);
  const feedMode = stageFeedMode(stage);
  const directPrior =
    stageIndex > 0 ? stages[stageIndex - 1] ?? null : null;
  const priorRaw =
    directPrior == null
      ? ""
      : feedMode === "full"
        ? trimText(directPrior.fullOutcome) ||
          trimText(directPrior.shortOutcome)
        : trimText(directPrior.shortOutcome);
  const priorCap =
    feedMode === "full" ? UPSTREAM_FULL_PREVIEW_CHARS : 200;
  const priorOutcome = priorRaw
    ? capPreview(priorRaw, priorCap)
    : "";

  if (stageIndex > 0) {
    const upstreamChunks: string[] = [];
    // full 模式以节点产出为主；summary 仍可附 plan 摘要帮助解释
    if (feedMode === "summary" && planText) {
      upstreamChunks.push(planText);
    }
    if (priorOutcome && priorOutcome !== planText) {
      const title = trimText(directPrior?.title) || directPrior?.id || "";
      upstreamChunks.push(
        title ? `${title}: ${priorOutcome}` : priorOutcome,
      );
    } else if (feedMode === "full" && planText && !priorOutcome) {
      upstreamChunks.push(planText);
    }
    const body = upstreamChunks.join("\n\n").trim();
    if (body) {
      const jumpId = directPrior?.id ?? priors[priors.length - 1]?.id ?? null;
      const upstreamTitle =
        trimText(directPrior?.title) ||
        trimText(priors[priors.length - 1]?.title) ||
        null;
      sections.push({
        id: "upstream",
        body,
        jumpStageId: jumpId,
        upstreamTitle,
      });
      // 流水线：列出已成功前序（最多展示 2 个，避免过宽）
      const pipePriors = priors.slice(-2);
      if (pipePriors.length === 0 && jumpId) {
        pipe.push({
          id: `pipe-up-${jumpId}`,
          sectionId: "upstream",
          label: upstreamTitle || "Upstream",
          status: "done",
          jumpStageId: jumpId,
        });
      } else {
        for (const p of pipePriors) {
          pipe.push({
            id: `pipe-up-${p.id}`,
            sectionId: "upstream",
            label: trimText(p.title) || p.id,
            status: "done",
            jumpStageId: p.id,
          });
        }
      }
      summaryParts.push(upstreamTitle || "Upstream");
    }
  }

  const note = trimText(projection.approvalNote);
  if (note) {
    sections.push({ id: "approvalNote", body: note });
    pipe.push({
      id: "pipe-note",
      sectionId: "approvalNote",
      label: noteLabel,
      status: "done",
    });
    summaryParts.push(noteLabel);
  }

  const role = stage ? trimText(stage.rolePrompt) : "";
  if (role) {
    sections.push({ id: "role", body: role });
    summaryParts.push(roleLabel);
  }

  if (sections.length === 0 || !stage) {
    return { sections: [], pipe: [], summaryParts: [], itemCount: 0 };
  }

  // 当前节点在流水线末尾
  const currentLabel = trimText(stage.title) || stage.id;
  pipe.push({
    id: `pipe-cur-${stage.id}`,
    sectionId: role ? "role" : sections[0]!.id,
    label: currentLabel,
    status: "current",
  });

  return {
    sections,
    pipe,
    summaryParts,
    itemCount: sections.length,
  };
}
