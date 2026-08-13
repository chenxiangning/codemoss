import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react-dom";

import { cn } from "../../../lib/utils";
import type { GlobalRuntimeNotice } from "../../../services/globalRuntimeNotices";
import type { WorkspaceInfo } from "../../../types";
import type { StartupTraceEvent } from "../../startup-orchestration/utils/startupTrace";
import {
  projectStartupDiagnosticsTimeline,
  resolveStartupTimelineProject,
  type StartupTimelineNode,
  type StartupTimelineSectionId,
  type StartupTimelineStatus,
} from "../utils/startupDiagnosticsTimelineProjection";

export type StartupDiagnosticsTimelineProps = {
  events: readonly StartupTraceEvent[];
  notices: readonly GlobalRuntimeNotice[];
  workspaces: readonly Pick<WorkspaceInfo, "id" | "name" | "path">[];
};

type StatusPresentation = {
  glyph: string;
  markerClassName: string;
  statusClassName: string;
  translationKey: string;
};

type TimelineWorkspaceCatalog = ReadonlyArray<StartupTimelineNode["project"]>;

const STATUS_PRESENTATION: Record<StartupTimelineStatus, StatusPresentation> = {
  queued: {
    glyph: "○",
    markerClassName: "border-sky-400 bg-background text-sky-400",
    statusClassName: "text-sky-700 dark:text-sky-300",
    translationKey: "runtimeNotice.startupTimeline.status.queued",
  },
  started: {
    glyph: "●",
    markerClassName: "border-sky-400 bg-sky-400 text-sky-950",
    statusClassName: "text-sky-700 dark:text-sky-300",
    translationKey: "runtimeNotice.startupTimeline.status.started",
  },
  completed: {
    glyph: "✓",
    markerClassName: "border-emerald-500 bg-emerald-500 text-white",
    statusClassName: "text-emerald-700 dark:text-emerald-300",
    translationKey: "runtimeNotice.startupTimeline.status.completed",
  },
  failed: {
    glyph: "×",
    markerClassName: "border-rose-500 bg-rose-500 text-white",
    statusClassName: "text-rose-700 dark:text-rose-300",
    translationKey: "runtimeNotice.startupTimeline.status.failed",
  },
  "timed-out": {
    glyph: "!",
    markerClassName: "border-rose-500 bg-background text-rose-500",
    statusClassName: "text-rose-700 dark:text-rose-300",
    translationKey: "runtimeNotice.startupTimeline.status.timedOut",
  },
  cancelled: {
    glyph: "–",
    markerClassName: "border-amber-500 bg-background text-amber-500",
    statusClassName: "text-amber-700 dark:text-amber-300",
    translationKey: "runtimeNotice.startupTimeline.status.cancelled",
  },
  degraded: {
    glyph: "!",
    markerClassName: "border-amber-500 bg-amber-500 text-amber-950",
    statusClassName: "text-amber-700 dark:text-amber-300",
    translationKey: "runtimeNotice.startupTimeline.status.degraded",
  },
  info: {
    glyph: "i",
    markerClassName: "border-slate-400 bg-background text-slate-500",
    statusClassName: "text-muted-foreground",
    translationKey: "runtimeNotice.startupTimeline.status.info",
  },
  warning: {
    glyph: "!",
    markerClassName: "border-amber-500 bg-amber-500 text-amber-950",
    statusClassName: "text-amber-700 dark:text-amber-300",
    translationKey: "runtimeNotice.startupTimeline.status.warning",
  },
};

function formatDurationMs(durationMs: number | null): string {
  if (durationMs === null || !Number.isFinite(durationMs)) {
    return "—";
  }
  if (durationMs < 10) {
    return `${durationMs.toFixed(1)}ms`;
  }
  if (durationMs < 1_000) {
    return `${Math.round(durationMs)}ms`;
  }
  return `${(durationMs / 1_000).toFixed(durationMs < 10_000 ? 1 : 0)}s`;
}

function translateWithFallback(
  t: TFunction,
  key: string | null,
  fallback: string,
  params?: GlobalRuntimeNotice["messageParams"],
): string {
  if (!key) {
    return fallback;
  }
  try {
    const translated = String(t(key, params ?? {}));
    return translated && translated !== key ? translated : fallback;
  } catch {
    return fallback;
  }
}

function resolveNodeCopy(t: TFunction, node: StartupTimelineNode) {
  return {
    title: translateWithFallback(
      t,
      node.titleKey,
      node.fallbackTitle,
      node.titleParams,
    ),
    description: translateWithFallback(
      t,
      node.descriptionKey,
      node.descriptionKey,
    ),
  };
}

function resolvePrimaryDuration(node: StartupTimelineNode): number | null {
  if (node.timing.durationCount > 1) {
    return node.timing.totalDurationMs;
  }
  return node.timing.latestDurationMs ?? node.timing.firstDurationMs;
}

function resolveDurationLabel(t: TFunction, node: StartupTimelineNode): string {
  const durationMs = resolvePrimaryDuration(node);
  if (durationMs === null) {
    return String(t("runtimeNotice.startupTimeline.duration.unavailable"));
  }
  return String(
    t(
      node.timing.durationCount > 1
        ? "runtimeNotice.startupTimeline.duration.total"
        : "runtimeNotice.startupTimeline.duration.single",
      { duration: formatDurationMs(durationMs) },
    ),
  );
}

function resolveVisibleProjectLabel(
  t: TFunction,
  node: StartupTimelineNode,
  workspaceCatalog: TimelineWorkspaceCatalog,
): string {
  if (node.operationKey === "workspace-catalog" && workspaceCatalog.length > 0) {
    if (workspaceCatalog.length === 1) {
      return workspaceCatalog[0].label;
    }
    return String(
      t("runtimeNotice.startupTimeline.projectSummary", {
        name: workspaceCatalog[0].label,
        count: workspaceCatalog.length - 1,
      }),
    );
  }
  return node.project.isGlobal
    ? String(t("runtimeNotice.startupTimeline.globalProject"))
    : node.project.label;
}

function sectionCopy(t: TFunction, sectionId: StartupTimelineSectionId) {
  return sectionId === "startup"
    ? {
        title: String(t("runtimeNotice.startupTimeline.sections.startup")),
        hint: String(t("runtimeNotice.startupTimeline.sections.startupHint")),
      }
    : {
        title: String(t("runtimeNotice.startupTimeline.sections.runtime")),
        hint: String(t("runtimeNotice.startupTimeline.sections.runtimeHint")),
      };
}

function TimingDetail({ node, t }: { node: StartupTimelineNode; t: TFunction }) {
  if (node.timing.durationCount === 0) {
    return null;
  }
  const timingRows = [
    ["runtimeNotice.startupTimeline.detail.first", node.timing.firstDurationMs],
    ["runtimeNotice.startupTimeline.detail.latest", node.timing.latestDurationMs],
    ["runtimeNotice.startupTimeline.detail.max", node.timing.maxDurationMs],
    ["runtimeNotice.startupTimeline.detail.total", node.timing.totalDurationMs],
  ] as const;

  return (
    <div className="mt-2 border-t border-border/50 pt-2">
      <div className="mb-1 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
        <span>{t("runtimeNotice.startupTimeline.detail.timing")}</span>
        <span>
          {t("runtimeNotice.startupTimeline.detail.durationSamples", {
            count: node.timing.durationCount,
          })}
        </span>
      </div>
      <dl className="grid grid-cols-4 gap-1.5">
        {timingRows.map(([labelKey, durationMs]) => (
          <div key={labelKey} className="rounded bg-muted/40 px-2 py-1">
            <dt className="text-[9px] text-muted-foreground">{t(labelKey)}</dt>
            <dd className="mt-0.5 font-mono text-[11px] text-foreground">
              {formatDurationMs(durationMs)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function NodeDetail({
  node,
  t,
  workspaceCatalog,
}: {
  node: StartupTimelineNode;
  t: TFunction;
  workspaceCatalog: TimelineWorkspaceCatalog;
}) {
  const copy = resolveNodeCopy(t, node);
  const status = STATUS_PRESENTATION[node.status];
  const projectLabel = resolveVisibleProjectLabel(t, node, workspaceCatalog);
  const showsWorkspaceCatalog =
    node.operationKey === "workspace-catalog" && workspaceCatalog.length > 0;

  return (
    <div className="w-[min(440px,calc(100vw-24px))] rounded-lg border border-border bg-background/98 p-3 text-left text-xs text-foreground shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold leading-snug">{copy.title}</div>
          <div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
            {copy.description}
          </div>
        </div>
        <span className={cn("shrink-0 text-[10px]", status.statusClassName)}>
          {t(status.translationKey)}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-[auto,minmax(0,1fr)] gap-x-3 gap-y-1 text-[10px]">
        <dt className="text-muted-foreground">
          {t("runtimeNotice.startupTimeline.detail.project")}
        </dt>
        <dd className="min-w-0 break-words text-foreground">{projectLabel}</dd>
        {!showsWorkspaceCatalog ? (
          <>
            <dt className="text-muted-foreground">
              {t("runtimeNotice.startupTimeline.detail.workspacePath")}
            </dt>
            <dd className="min-w-0 break-all font-mono text-foreground/90">
              {node.project.path ?? t("runtimeNotice.startupTimeline.detail.noPath")}
            </dd>
          </>
        ) : null}
        {node.project.workspaceId ? (
          <>
            <dt className="text-muted-foreground">
              {t("runtimeNotice.startupTimeline.detail.workspaceId")}
            </dt>
            <dd className="min-w-0 break-all font-mono text-foreground/90">
              {node.project.workspaceId}
            </dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">
          {t("runtimeNotice.startupTimeline.detail.phase")}
        </dt>
        <dd className="font-mono text-foreground/90">{node.phase}</dd>
        <dt className="text-muted-foreground">
          {t("runtimeNotice.startupTimeline.detail.sources")}
        </dt>
        <dd className="font-mono text-foreground/90">
          {node.sourceKinds.join(" + ")}
        </dd>
        <dt className="text-muted-foreground">
          {t("runtimeNotice.startupTimeline.detail.technical")}
        </dt>
        <dd className="min-w-0 break-all font-mono text-foreground/90">
          {node.technicalLabels.join(" · ")}
        </dd>
      </dl>
      {showsWorkspaceCatalog ? (
        <div className="mt-2 border-t border-border/50 pt-2">
          <div className="mb-1 text-[10px] text-muted-foreground">
            {t("runtimeNotice.startupTimeline.detail.workspaceCatalog")}
          </div>
          <ul className="max-h-28 space-y-1 overflow-y-auto pr-1">
            {workspaceCatalog.map((workspace) => (
              <li
                key={workspace.identity}
                className="grid grid-cols-[auto,minmax(0,1fr)] gap-x-2 rounded bg-muted/35 px-2 py-1 text-[10px]"
              >
                <span className="font-medium text-foreground">{workspace.label}</span>
                <span className="truncate text-right font-mono text-muted-foreground">
                  {workspace.path ?? workspace.workspaceId}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <TimingDetail node={node} t={t} />
    </div>
  );
}

export const StartupDiagnosticsTimeline = memo(function StartupDiagnosticsTimeline({
  events,
  notices,
  workspaces,
}: StartupDiagnosticsTimelineProps) {
  const { t } = useTranslation();
  const tooltipId = useId();
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null);
  const projection = useMemo(
    () => projectStartupDiagnosticsTimeline({ events, notices, workspaces }),
    [events, notices, workspaces],
  );
  const workspaceCatalog = useMemo(
    () =>
      workspaces.map((workspace) =>
        resolveStartupTimelineProject({ workspaceId: workspace.id }, workspaces),
      ),
    [workspaces],
  );
  const activeNode = useMemo(
    () =>
      projection.sections
        .flatMap((section) => section.nodes)
        .find((node) => node.id === activeNodeId) ?? null,
    [activeNodeId, projection.sections],
  );
  const middleware = useMemo(
    () => [
      offset(7),
      flip({ padding: 10 }),
      shift({ padding: 10, crossAxis: true }),
    ],
    [],
  );
  const { refs, floatingStyles } = useFloating({
    elements: { reference: referenceElement },
    placement: "bottom-end",
    strategy: "fixed",
    middleware,
    whileElementsMounted: autoUpdate,
  });

  const closeDetails = useCallback(() => {
    setActiveNodeId(null);
    setReferenceElement(null);
  }, []);
  const openDetails = useCallback(
    (nodeId: string, element: HTMLButtonElement) => {
      setActiveNodeId(nodeId);
      setReferenceElement(element);
    },
    [],
  );

  useEffect(() => {
    if (!activeNode) {
      return;
    }
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (
        referenceElement?.contains(target) ||
        refs.floating.current?.contains(target)
      ) {
        return;
      }
      closeDetails();
    };
    window.addEventListener("pointerdown", closeOnOutsidePointer, true);
    window.addEventListener("blur", closeDetails);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
      window.removeEventListener("blur", closeDetails);
    };
  }, [activeNode, closeDetails, referenceElement, refs.floating]);

  return (
    <section className="flex min-h-0 w-full flex-col overflow-hidden rounded-lg border border-border/60 bg-background/75 shadow-sm">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/50 px-3 py-2">
        <span className="text-xs font-semibold text-foreground">
          {t("runtimeNotice.startupTimeline.title")}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {t("runtimeNotice.startupTimeline.summary", {
            rawCount: projection.rawCount,
            nodeCount: projection.nodeCount,
          })}
        </span>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5 font-mono"
        data-testid="startup-gate-timeline"
        onScroll={closeDetails}
      >
        {projection.sections.map((section) => {
          const sectionLabels = sectionCopy(t, section.id);
          return (
            <div
              key={section.id}
              className="relative pb-2 last:pb-0"
              data-testid={`startup-timeline-section-${section.id}`}
            >
              <div className="relative flex items-center gap-2 py-1 pl-1">
                <span
                  className="relative z-10 size-2.5 shrink-0 rounded-full bg-[#2563eb] ring-4 ring-background"
                  aria-hidden
                />
                <span className="text-[11px] font-semibold text-foreground">
                  {sectionLabels.title}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {sectionLabels.hint}
                </span>
                <span className="ml-auto text-[9px] text-muted-foreground">
                  {section.nodes.length}
                </span>
              </div>

              <ol className="ml-[5px] border-l border-[#2563eb]/35 pl-4">
                {section.nodes.length === 0 ? (
                  <li className="py-1.5 text-[10px] text-muted-foreground/70">
                    {t("runtimeNotice.startupTimeline.empty")}
                  </li>
                ) : (
                  section.nodes.map((node) => {
                    const copy = resolveNodeCopy(t, node);
                    const status = STATUS_PRESENTATION[node.status];
                    const statusLabel = String(t(status.translationKey));
                    const projectLabel = resolveVisibleProjectLabel(
                      t,
                      node,
                      workspaceCatalog,
                    );
                    const durationLabel = resolveDurationLabel(t, node);
                    const isActive = activeNode?.id === node.id;
                    const accessibleLabel = String(
                      t("runtimeNotice.startupTimeline.detail.label", {
                        title: copy.title,
                      }),
                    );

                    return (
                      <li key={node.id} className="relative py-0.5">
                        <span
                          className={cn(
                            "absolute -left-[23px] top-2.5 z-10 flex size-3.5 items-center justify-center rounded-full border font-sans text-[8px] font-bold ring-2 ring-background",
                            status.markerClassName,
                          )}
                          aria-hidden
                        >
                          {status.glyph}
                        </span>
                        <button
                          type="button"
                          className={cn(
                            "group w-full rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted/55 focus-visible:bg-muted/55 focus-visible:ring-1 focus-visible:ring-[#2563eb]/70",
                            isActive && "bg-muted/55",
                          )}
                          aria-label={accessibleLabel}
                          aria-describedby={isActive ? tooltipId : undefined}
                          data-testid="startup-timeline-node"
                          data-operation={node.operationKey}
                          data-project={projectLabel}
                          data-status={node.status}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                          }}
                          onMouseEnter={(event) => {
                            openDetails(node.id, event.currentTarget);
                          }}
                          onMouseLeave={(event: ReactMouseEvent<HTMLButtonElement>) => {
                            if (document.activeElement !== event.currentTarget) {
                              closeDetails();
                            }
                          }}
                          onFocus={(event) => {
                            openDetails(node.id, event.currentTarget);
                          }}
                          onBlur={closeDetails}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              closeDetails();
                            }
                          }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openDetails(node.id, event.currentTarget);
                          }}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                              <span className="truncate text-[11px] font-semibold text-foreground">
                                {copy.title}
                              </span>
                              <span
                                className="max-w-36 shrink truncate rounded border border-border/60 bg-muted/35 px-1.5 py-0.5 text-[9px] text-muted-foreground"
                                title={
                                  node.operationKey === "workspace-catalog"
                                    ? workspaceCatalog
                                        .map((workspace) => workspace.label)
                                        .join(", ")
                                    : node.project.path ??
                                      node.project.workspaceId ??
                                      projectLabel
                                }
                              >
                                {projectLabel}
                              </span>
                              {node.compact ? (
                                <span className="min-w-0 truncate text-[9px] text-muted-foreground/80">
                                  {copy.description}
                                </span>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5 text-[9px]">
                              <span className={status.statusClassName}>{statusLabel}</span>
                              {node.count > 1 ? (
                                <span className="rounded bg-[#2563eb]/12 px-1 py-0.5 font-semibold text-[#2563eb] dark:text-blue-300">
                                  {t("runtimeNotice.startupTimeline.count", {
                                    count: node.count,
                                  })}
                                </span>
                              ) : null}
                              <span className="text-muted-foreground">{durationLabel}</span>
                            </div>
                          </div>
                          {!node.compact ? (
                            <p className="mt-0.5 line-clamp-2 text-[10px] leading-[1.35] text-muted-foreground/85">
                              {copy.description}
                            </p>
                          ) : null}
                        </button>
                      </li>
                    );
                  })
                )}
              </ol>
            </div>
          );
        })}
      </div>

      {activeNode && referenceElement && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={refs.setFloating}
              id={tooltipId}
              role="tooltip"
              className="z-[2147483100]"
              style={floatingStyles}
              data-testid="startup-timeline-detail"
            >
              <NodeDetail
                node={activeNode}
                t={t}
                workspaceCatalog={workspaceCatalog}
              />
            </div>,
            document.body,
          )
        : null}
    </section>
  );
});
