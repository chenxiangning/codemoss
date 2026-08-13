import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

import type { AgentProjectionV1, AgentStageProjection } from "../types";
import {
  buildStageInjectContext,
  type InjectSectionId,
} from "../utils/buildStageInjectContext";

type Props = {
  projection: AgentProjectionV1;
  stage: AgentStageProjection;
  stageIndex: number;
  onJumpStage?: (stageId: string) => void;
};

type Pane = "list" | "trace";

const FLASH_MS = 900;

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6.2l2.2 2.3L9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 协作节点「注入上下文」Header（B+C，默认折叠）。
 * 迷你流水线 / 溯源：只高亮分区；「打开节点」才跳 stage。
 */
export function StageInjectContextHeader({
  projection,
  stage,
  stageIndex,
  onJumpStage,
}: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [pane, setPane] = useState<Pane>("list");
  const [flashId, setFlashId] = useState<InjectSectionId | null>(null);
  const [bodyScrolling, setBodyScrolling] = useState(false);
  const [expandedBodies, setExpandedBodies] = useState<
    Partial<Record<InjectSectionId, boolean>>
  >({});
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const injectBodyRef = useRef<HTMLDivElement | null>(null);

  const labels = useMemo(
    () => ({
      mainCanvas: t("multiAgent.inspector.inject.pipeMainCanvas"),
      user: t("multiAgent.inspector.inject.pipeUser"),
      approvalNote: t("multiAgent.inspector.inject.pipeNote"),
      role: t("multiAgent.inspector.inject.pipeRole"),
    }),
    [t],
  );

  const ctx = useMemo(
    () => buildStageInjectContext(projection, stageIndex, labels),
    [projection, stageIndex, labels],
  );

  const clearFlashTimer = () => {
    if (flashTimerRef.current != null) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
  };

  useEffect(() => () => clearFlashTimer(), []);

  // 滚动时短暂显示滚动条（默认隐藏）
  useEffect(() => {
    if (!expanded) {
      setBodyScrolling(false);
      return;
    }
    const el = injectBodyRef.current;
    if (!el) return;
    const onScroll = () => {
      setBodyScrolling(true);
      if (scrollHideTimerRef.current != null) {
        clearTimeout(scrollHideTimerRef.current);
      }
      scrollHideTimerRef.current = setTimeout(() => {
        setBodyScrolling(false);
        scrollHideTimerRef.current = null;
      }, 800);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (scrollHideTimerRef.current != null) {
        clearTimeout(scrollHideTimerRef.current);
        scrollHideTimerRef.current = null;
      }
    };
  }, [expanded, pane, projection.runId, stage.id]);

  // 切 stage 时回到清单，保留折叠偏好
  useEffect(() => {
    setPane("list");
    setFlashId(null);
    setExpandedBodies({});
    clearFlashTimer();
  }, [projection.runId, stage.id]);

  /** 仅高亮分区；不跳 stage */
  const highlightSection = (sectionId: InjectSectionId) => {
    setPane("list");
    setFlashId(sectionId);
    clearFlashTimer();
    flashTimerRef.current = setTimeout(() => {
      setFlashId((cur) => (cur === sectionId ? null : cur));
      flashTimerRef.current = null;
    }, FLASH_MS);
    // 滚到分区（若已展开）
    requestAnimationFrame(() => {
      document
        .getElementById(`ma-inject-sec-${sectionId}`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  };

  const jumpToStage = (stageId: string) => {
    if (stageId && stageId !== stage.id) {
      onJumpStage?.(stageId);
    }
  };

  if (ctx.itemCount === 0) return null;

  const summaryLine =
    ctx.summaryParts.length > 0
      ? ctx.summaryParts.join(" · ")
      : t("multiAgent.inspector.inject.summaryFallback");

  const sectionTitle = (id: InjectSectionId, upstreamTitle?: string | null) => {
    switch (id) {
      case "mainCanvas":
        return t("multiAgent.inspector.inject.sectionMainCanvas");
      case "user":
        return t("multiAgent.inspector.inject.sectionUser");
      case "approvalNote":
        return t("multiAgent.inspector.inject.sectionNote");
      case "upstream":
        return upstreamTitle
          ? t("multiAgent.inspector.inject.sectionUpstreamNamed", {
              name: upstreamTitle,
            })
          : t("multiAgent.inspector.inject.sectionUpstream");
      case "role":
        return t("multiAgent.inspector.inject.sectionRole");
      default:
        return id;
    }
  };

  const pipeNodes = ctx.pipe;
  const listBody = (
    <div className="ma-inject-list" role="tabpanel">
      {ctx.sections.map((sec) => {
        const long = sec.body.length > 160 || sec.body.split("\n").length > 3;
        const open = Boolean(expandedBodies[sec.id]);
        const canJump =
          Boolean(sec.jumpStageId) && sec.jumpStageId !== stage.id;
        return (
          <section
            key={sec.id}
            id={`ma-inject-sec-${sec.id}`}
            className={cn("ma-inject-sec", flashId === sec.id && "is-flash")}
            data-section={sec.id}
          >
            <div className="ma-inject-sec-h">
              <span className={cn("ma-inject-tag", `is-${sec.id}`)}>
                {sectionTitle(sec.id, sec.upstreamTitle)}
              </span>
              {canJump ? (
                <button
                  type="button"
                  className="ma-inject-jump"
                  onClick={() => jumpToStage(sec.jumpStageId!)}
                >
                  {t("multiAgent.inspector.inject.jumpStage")}
                </button>
              ) : null}
            </div>
            <div
              className={cn(
                "ma-inject-sec-body",
                long && !open && "is-clamp",
              )}
            >
              {sec.body}
            </div>
            {long ? (
              <button
                type="button"
                className="ma-inject-more"
                onClick={() =>
                  setExpandedBodies((prev) => ({
                    ...prev,
                    [sec.id]: !prev[sec.id],
                  }))
                }
              >
                {open
                  ? t("multiAgent.inspector.inject.collapseBody")
                  : t("multiAgent.inspector.inject.expandBody")}
              </button>
            ) : null}
            {sec.id === "mainCanvas" ? (
              <div className="ma-inject-sec-meta">
                {t("multiAgent.inspector.inject.mainCanvasMeta")}
              </div>
            ) : null}
            {sec.id === "approvalNote" ? (
              <div className="ma-inject-sec-meta">
                {t("multiAgent.inspector.inject.noteMeta")}
              </div>
            ) : null}
            {sec.id === "upstream" ? (
              <div className="ma-inject-sec-meta">
                {t("multiAgent.inspector.inject.upstreamMeta")}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );

  const traceBody = (
    <div className="ma-inject-trace" role="tabpanel">
      <p className="ma-inject-trace-hint">
        {t("multiAgent.inspector.inject.traceHint")}
      </p>
      <div className="ma-inject-trace-pipe">
        {pipeNodes.map((node, index) => {
          const canJump =
            Boolean(node.jumpStageId) && node.jumpStageId !== stage.id;
          return (
            <div
              key={node.id}
              className={cn(
                "ma-inject-trace-node",
                node.status === "done" && "is-done",
                node.status === "current" && "is-cur",
              )}
            >
              <div className="ma-inject-trace-rail" aria-hidden>
                <i className="ma-inject-trace-dot" />
                {index < pipeNodes.length - 1 ? (
                  <i className="ma-inject-trace-line" />
                ) : null}
              </div>
              <div className="ma-inject-trace-card-wrap">
                <button
                  type="button"
                  className="ma-inject-trace-card"
                  onClick={() => highlightSection(node.sectionId)}
                >
                  <div className="ma-inject-trace-card-h">
                    <span>{node.label}</span>
                    {node.status === "current" ? (
                      <span className="ma-inject-trace-badge">
                        {t("multiAgent.inspector.inject.currentBadge")}
                      </span>
                    ) : null}
                  </div>
                  <div className="ma-inject-trace-card-b">
                    {ctx.sections.find((s) => s.id === node.sectionId)?.body ??
                      node.label}
                  </div>
                </button>
                {canJump ? (
                  <button
                    type="button"
                    className="ma-inject-jump ma-inject-trace-jump"
                    onClick={() => jumpToStage(node.jumpStageId!)}
                  >
                    {t("multiAgent.inspector.inject.jumpStage")}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      className={cn("ma-inject", expanded && "is-open")}
      data-ma-inject="1"
    >
      <button
        type="button"
        className="ma-inject-summary"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="ma-inject-chev" aria-hidden>
          ▶
        </span>
        <span className="ma-inject-label">
          {t("multiAgent.inspector.inject.title")}
        </span>
        <span className="ma-inject-one-line" title={summaryLine}>
          {summaryLine}
        </span>
        <span className="ma-inject-count">
          {t("multiAgent.inspector.inject.itemCount", {
            n: ctx.itemCount,
          })}
        </span>
      </button>

      {expanded ? (
        <div
          ref={injectBodyRef}
          className={cn("ma-inject-body", bodyScrolling && "is-scrolling")}
        >
          <div
            className="ma-inject-mini"
            aria-label={t("multiAgent.inspector.inject.pipeAria")}
          >
            {pipeNodes.map((node, index) => (
              <div key={node.id} className="ma-inject-mini-wrap">
                {index > 0 ? (
                  <div
                    className={cn(
                      "ma-inject-conn",
                      pipeNodes[index - 1]?.status === "done" && "from-done",
                      node.status === "current" && "to-cur",
                    )}
                    aria-hidden
                  />
                ) : null}
                <div
                  className={cn(
                    "ma-inject-step",
                    node.status === "done" && "is-done",
                    node.status === "current" && "is-cur",
                    flashId === node.sectionId && "is-active",
                  )}
                >
                  <button
                    type="button"
                    title={t("multiAgent.inspector.inject.pipeFocusHint", {
                      label: node.label,
                    })}
                    aria-label={t("multiAgent.inspector.inject.pipeFocusHint", {
                      label: node.label,
                    })}
                    onClick={() => highlightSection(node.sectionId)}
                  >
                    <span className="ma-inject-node" aria-hidden>
                      {node.status === "done" ? (
                        <CheckIcon />
                      ) : node.status === "current" ? (
                        String(stageIndex + 1)
                      ) : (
                        "·"
                      )}
                    </span>
                    <span className="ma-inject-step-label">{node.label}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="ma-inject-switch" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={pane === "list"}
              className={cn(pane === "list" && "is-on")}
              onClick={() => setPane("list")}
            >
              {t("multiAgent.inspector.inject.paneList")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pane === "trace"}
              className={cn(pane === "trace" && "is-on")}
              onClick={() => setPane("trace")}
            >
              {t("multiAgent.inspector.inject.paneTrace")}
            </button>
          </div>

          {pane === "list" ? listBody : traceBody}
        </div>
      ) : null}
    </div>
  );
}
