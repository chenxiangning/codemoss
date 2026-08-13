import type {
  StartupTaskLifecycleState,
  StartupTraceEvent,
  StartupWorkspaceScope,
} from "../../startup-orchestration/utils/startupTrace";
import type { GlobalRuntimeNotice } from "../../../services/globalRuntimeNotices";
import type { WorkspaceInfo } from "../../../types";

export type StartupTimelineSectionId = "startup" | "runtime";

export type StartupTimelineStatus =
  | StartupTaskLifecycleState
  | "info"
  | "warning";

export type StartupTimelineProject = {
  identity: string;
  label: string;
  path: string | null;
  workspaceId: string | null;
  isGlobal: boolean;
};

export type StartupTimelineTimingSummary = {
  durationCount: number;
  firstDurationMs: number | null;
  latestDurationMs: number | null;
  maxDurationMs: number | null;
  totalDurationMs: number | null;
};

export type StartupTimelineNode = {
  id: string;
  section: StartupTimelineSectionId;
  operationKey: string;
  phase: string;
  status: StartupTimelineStatus;
  count: number;
  project: StartupTimelineProject;
  timing: StartupTimelineTimingSummary;
  titleKey: string | null;
  titleParams: GlobalRuntimeNotice["messageParams"];
  fallbackTitle: string;
  descriptionKey: string;
  technicalLabels: string[];
  sourceKinds: Array<"task" | "command" | "milestone" | "notice">;
  firstOrder: number;
  lastOrder: number;
  compact: boolean;
};

export type StartupDiagnosticsTimelineProjection = {
  sections: Array<{
    id: StartupTimelineSectionId;
    nodes: StartupTimelineNode[];
  }>;
  rawCount: number;
  nodeCount: number;
};

type WorkspaceReference = Pick<WorkspaceInfo, "id" | "name" | "path">;
type TaskTraceEvent = Extract<StartupTraceEvent, { type: "task" }>;
type TimelineSourceKind = StartupTimelineNode["sourceKinds"][number];

type SemanticDefinition = {
  key: string;
  pattern: RegExp;
};

type TaskExecution = {
  events: TaskTraceEvent[];
  firstSequence: number;
  lastSequence: number;
  finalEvent: TaskTraceEvent;
};

type OperationSample = {
  section: StartupTimelineSectionId;
  sourceKind: TimelineSourceKind;
  semanticKey: string;
  aggregationOperationKey: string;
  phase: string;
  status: StartupTimelineStatus;
  count: number;
  durationMs: number | null;
  order: number;
  lastOrder: number;
  project: StartupTimelineProject;
  titleKey: string | null;
  titleParams: GlobalRuntimeNotice["messageParams"];
  fallbackTitle: string;
  descriptionKey: string;
  technicalLabels: string[];
};

const OPERATION_KEY_PREFIX = "runtimeNotice.startupTimeline.operations";
const FALLBACK_KEY_PREFIX = "runtimeNotice.startupTimeline.fallback";

const SEMANTIC_DEFINITIONS: readonly SemanticDefinition[] = [
  {
    key: "session-catalog",
    pattern:
      /(?:thread list|list threads|thread titles|list thread titles|list .* sessions|session list|session catalog|session radar|opencode session)/,
  },
  {
    key: "workspace-files",
    pattern: /(?:list workspace files|workspace files|workspace file tree)/,
  },
  {
    key: "workspace-catalog",
    pattern: /(?:list workspaces|workspace list|workspace catalog|workspaces refresh)/,
  },
  { key: "skills", pattern: /(?:skills? list|list skills?)/ },
  { key: "prompts", pattern: /(?:prompts? list|list prompts?)/ },
  {
    key: "commands",
    pattern: /(?:commands? list|list .* commands|claude commands|opencode commands)/,
  },
  {
    key: "collaboration-modes",
    pattern: /(?:collaboration mode|collaboration modes)/,
  },
  {
    key: "models",
    pattern: /(?:model list|list models|engine models|get engine models)/,
  },
  { key: "agents", pattern: /(?:agents? list|list agents?)/ },
  { key: "git-diff", pattern: /(?:get git diffs?|git diffs?)/ },
  { key: "git-status", pattern: /(?:get git status|git status)/ },
  { key: "dictation", pattern: /(?:dictation model status|dictation status)/ },
  { key: "input-history", pattern: /(?:input history)/ },
  { key: "storage-migration", pattern: /(?:storage migration|local storage migration|migration)/ },
  { key: "storage-preload", pattern: /(?:storage preload|preload client store|local state)/ },
  { key: "app-import", pattern: /(?:app import|application import)/ },
  { key: "i18n", pattern: /(?:\bi18n\b|language resources?|translations?)/ },
  { key: "interface-resources", pattern: /(?:interface resources?|mount shell|client shell)/ },
  { key: "runtime-connection", pattern: /(?:runtime notice runtime|runtime connection)/ },
];

const MILESTONE_SEMANTICS: Record<string, string> = {
  "shell-ready": "shell-ready",
  "input-ready": "input-ready",
  "active-workspace-ready": "active-workspace-ready",
  "startup-gate-ready": "startup-gate-ready",
};

function normalizeOperationLabel(value: string): string {
  const normalized = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return normalized || value.trim().toLowerCase();
}

function resolveSemanticDefinition(labels: readonly string[]): SemanticDefinition | null {
  const searchable = labels
    .map(normalizeOperationLabel)
    .filter(Boolean)
    .join(" ");
  return (
    SEMANTIC_DEFINITIONS.find((definition) => definition.pattern.test(searchable)) ??
    null
  );
}

function operationTitleKey(operationKey: string): string {
  return `${OPERATION_KEY_PREFIX}.${operationKey}.title`;
}

function operationDescriptionKey(operationKey: string): string {
  return `${OPERATION_KEY_PREFIX}.${operationKey}.description`;
}

function fallbackDescriptionKey(sourceKind: TimelineSourceKind): string {
  return `${FALLBACK_KEY_PREFIX}.${sourceKind}`;
}

function basenameFromPath(path: string): string {
  const normalized = path.trim().replace(/[\\/]+$/, "");
  return normalized.split(/[\\/]/).pop()?.trim() ?? "";
}

function shortenWorkspaceId(workspaceId: string): string {
  const normalized = workspaceId.trim();
  return normalized.length > 14 ? `${normalized.slice(0, 12)}…` : normalized;
}

export function resolveStartupTimelineProject(
  workspaceScope: StartupWorkspaceScope,
  workspaces: readonly WorkspaceReference[],
): StartupTimelineProject {
  if (workspaceScope === "global") {
    return {
      identity: "global",
      label: "global",
      path: null,
      workspaceId: null,
      isGlobal: true,
    };
  }

  const workspaceId = workspaceScope.workspaceId.trim();
  const workspace = workspaces.find((candidate) => candidate.id === workspaceId);
  const workspacePath = workspace?.path.trim() || null;
  const label =
    workspace?.name.trim() ||
    (workspacePath ? basenameFromPath(workspacePath) : "") ||
    shortenWorkspaceId(workspaceId) ||
    "unknown";

  return {
    identity: `workspace:${workspaceId}`,
    label,
    path: workspacePath,
    workspaceId,
    isGlobal: false,
  };
}

function resolveNoticeProject(
  notice: GlobalRuntimeNotice,
  workspaces: readonly WorkspaceReference[],
): StartupTimelineProject {
  const workspaceLabel = notice.messageParams?.workspace;
  if (typeof workspaceLabel !== "string" || !workspaceLabel.trim()) {
    return resolveStartupTimelineProject("global", workspaces);
  }

  const normalizedLabel = workspaceLabel.trim();
  const matches = workspaces.filter((workspace) => {
    const workspacePath = workspace.path.trim();
    return (
      workspace.id === normalizedLabel ||
      workspace.name.trim() === normalizedLabel ||
      workspacePath === normalizedLabel ||
      basenameFromPath(workspacePath) === normalizedLabel
    );
  });
  if (matches.length === 1) {
    return resolveStartupTimelineProject(
      { workspaceId: matches[0].id },
      workspaces,
    );
  }

  // Source 没给稳定 workspace id 时禁止把同名项目误合并。
  return {
    identity: `notice:${normalizedLabel}:${notice.dedupeKey}`,
    label: normalizedLabel,
    path: null,
    workspaceId: null,
    isGlobal: false,
  };
}

function isFiniteDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function finalizeTaskExecution(events: TaskTraceEvent[]): TaskExecution {
  const finalEvent = events[events.length - 1];
  return {
    events,
    firstSequence: events[0].sequence,
    lastSequence: finalEvent.sequence,
    finalEvent,
  };
}

function foldTaskExecutions(events: readonly StartupTraceEvent[]): TaskExecution[] {
  const activeByTaskId = new Map<string, TaskTraceEvent[]>();
  const executions: TaskExecution[] = [];
  const taskEvents = events
    .filter((event): event is TaskTraceEvent => event.type === "task")
    .sort((left, right) => left.sequence - right.sequence);

  for (const event of taskEvents) {
    const activeEvents = activeByTaskId.get(event.taskId);
    const beginsNewExecution =
      event.lifecycleState === "queued" ||
      (event.lifecycleState === "started" &&
        activeEvents?.some((candidate) => candidate.lifecycleState !== "queued"));

    if (activeEvents && beginsNewExecution) {
      executions.push(finalizeTaskExecution(activeEvents));
      activeByTaskId.set(event.taskId, [event]);
      continue;
    }

    if (activeEvents) {
      activeEvents.push(event);
    } else {
      activeByTaskId.set(event.taskId, [event]);
    }
  }

  for (const activeEvents of activeByTaskId.values()) {
    executions.push(finalizeTaskExecution(activeEvents));
  }
  return executions.sort((left, right) => left.firstSequence - right.firstSequence);
}

function taskExecutionDuration(execution: TaskExecution): number | null {
  for (let index = execution.events.length - 1; index >= 0; index -= 1) {
    const durationMs = execution.events[index].durationMs;
    if (isFiniteDuration(durationMs)) {
      return durationMs;
    }
  }
  return null;
}

function buildTaskSample(
  execution: TaskExecution,
  workspaces: readonly WorkspaceReference[],
): OperationSample {
  const event = execution.finalEvent;
  const labels = [event.commandLabel ?? "", event.traceLabel, event.taskId];
  const semantic = resolveSemanticDefinition(labels);
  const fallbackTitle = event.traceLabel.trim() || event.commandLabel || event.taskId;
  const unknownKind = event.commandLabel ? "command" : "task";
  const semanticKey = semantic?.key ?? `unknown-${unknownKind}`;
  const unknownIdentity = normalizeOperationLabel(
    event.commandLabel ?? event.traceLabel ?? event.taskId,
  );

  return {
    section: "startup",
    sourceKind: "task",
    semanticKey,
    aggregationOperationKey:
      semantic?.key ?? `${semanticKey}:${unknownIdentity}`,
    phase: event.phase,
    status: event.lifecycleState,
    count: 1,
    durationMs: taskExecutionDuration(execution),
    order: execution.firstSequence,
    lastOrder: execution.lastSequence,
    project: resolveStartupTimelineProject(event.workspaceScope, workspaces),
    titleKey: semantic ? operationTitleKey(semantic.key) : null,
    titleParams: undefined,
    fallbackTitle,
    descriptionKey: semantic
      ? operationDescriptionKey(semantic.key)
      : fallbackDescriptionKey(unknownKind),
    technicalLabels: [
      `task:${event.taskId}`,
      `trace:${event.traceLabel}`,
      `phase:${event.phase}`,
      event.commandLabel ? `cmd:${event.commandLabel}` : "",
      event.fallbackReason ? `fallback:${event.fallbackReason}` : "",
      event.cancellationMode ? `cancel:${event.cancellationMode}` : "",
    ].filter(Boolean),
  };
}

function buildMilestoneSample(
  event: Extract<StartupTraceEvent, { type: "milestone" }>,
  workspaces: readonly WorkspaceReference[],
): OperationSample {
  const semanticKey = MILESTONE_SEMANTICS[event.milestone] ?? "unknown-milestone";
  return {
    section: "startup",
    sourceKind: "milestone",
    semanticKey,
    aggregationOperationKey: `milestone:${event.milestone}`,
    phase: "milestone",
    status: "completed",
    count: 1,
    durationMs: null,
    order: event.sequence,
    lastOrder: event.sequence,
    project: resolveStartupTimelineProject("global", workspaces),
    titleKey:
      semanticKey === "unknown-milestone" ? null : operationTitleKey(semanticKey),
    titleParams: undefined,
    fallbackTitle: `milestone:${event.milestone}`,
    descriptionKey:
      semanticKey === "unknown-milestone"
        ? fallbackDescriptionKey("milestone")
        : operationDescriptionKey(semanticKey),
    technicalLabels: [
      `milestone:${event.milestone}`,
      `tasks-so-far:${event.taskSequences.length}`,
    ],
  };
}

function noticeStatus(notice: GlobalRuntimeNotice): StartupTimelineStatus {
  if (notice.severity === "error") {
    return "failed";
  }
  if (notice.severity === "warning") {
    return "warning";
  }
  const normalizedKey = notice.messageKey.toLowerCase();
  if (/(?:ready|completed)$/.test(normalizedKey)) {
    return "completed";
  }
  if (/(?:pending|start|checking|restore|loading|mount)/.test(normalizedKey)) {
    return "started";
  }
  return "info";
}

function noticeDuration(notice: GlobalRuntimeNotice): number | null {
  const durationMs = notice.messageParams?.durationMs;
  return isFiniteDuration(durationMs) ? durationMs : null;
}

function buildNoticeSample(
  notice: GlobalRuntimeNotice,
  order: number,
  workspaces: readonly WorkspaceReference[],
): OperationSample {
  const semantic = resolveSemanticDefinition([notice.messageKey]);
  const semanticKey = semantic?.key ?? "unknown-notice";
  return {
    section:
      notice.category === "bootstrap" || notice.category === "diagnostic"
        ? "startup"
        : "runtime",
    sourceKind: "notice",
    semanticKey,
    aggregationOperationKey: `${semanticKey}:notice:${notice.messageKey}`,
    phase: notice.category === "bootstrap" ? "bootstrap" : notice.category,
    status: noticeStatus(notice),
    count: Math.max(1, Math.floor(notice.repeatCount)),
    durationMs: noticeDuration(notice),
    order,
    lastOrder: order,
    project: resolveNoticeProject(notice, workspaces),
    titleKey: notice.messageKey,
    titleParams: notice.messageParams,
    fallbackTitle: notice.messageKey,
    descriptionKey: semantic
      ? operationDescriptionKey(semantic.key)
      : fallbackDescriptionKey("notice"),
    technicalLabels: [
      `notice:${notice.messageKey}`,
      `category:${notice.category}`,
      `dedupe:${notice.dedupeKey}`,
    ],
  };
}

function buildTimingSummary(samples: readonly OperationSample[]): StartupTimelineTimingSummary {
  const durationSamples = samples
    .filter((sample) => isFiniteDuration(sample.durationMs))
    .sort((left, right) => left.order - right.order);
  if (durationSamples.length === 0) {
    return {
      durationCount: 0,
      firstDurationMs: null,
      latestDurationMs: null,
      maxDurationMs: null,
      totalDurationMs: null,
    };
  }

  const durations = durationSamples.map((sample) => sample.durationMs as number);
  return {
    durationCount: durations.length,
    firstDurationMs: durations[0],
    latestDurationMs: durations[durations.length - 1],
    maxDurationMs: Math.max(...durations),
    totalDurationMs: durations.reduce((total, durationMs) => total + durationMs, 0),
  };
}

const SOURCE_KIND_PRIORITY: Record<TimelineSourceKind, number> = {
  command: 4,
  task: 3,
  milestone: 2,
  notice: 1,
};

function selectPrimarySamples(samples: readonly OperationSample[]): OperationSample[] {
  const samplesByKind = new Map<TimelineSourceKind, OperationSample[]>();
  for (const sample of samples) {
    const kindSamples = samplesByKind.get(sample.sourceKind) ?? [];
    kindSamples.push(sample);
    samplesByKind.set(sample.sourceKind, kindSamples);
  }

  return [...samplesByKind.values()].sort((left, right) => {
    const leftCount = left.reduce((total, sample) => total + sample.count, 0);
    const rightCount = right.reduce((total, sample) => total + sample.count, 0);
    if (leftCount !== rightCount) {
      return rightCount - leftCount;
    }
    return SOURCE_KIND_PRIORITY[right[0].sourceKind] - SOURCE_KIND_PRIORITY[left[0].sourceKind];
  })[0];
}

function projectSamples(samples: readonly OperationSample[]): StartupTimelineNode[] {
  const grouped = new Map<string, OperationSample[]>();
  for (const sample of samples) {
    const groupKey = [
      sample.section,
      sample.phase,
      sample.aggregationOperationKey,
      sample.project.identity,
      sample.status,
    ].join("\u0000");
    const groupSamples = grouped.get(groupKey) ?? [];
    groupSamples.push(sample);
    grouped.set(groupKey, groupSamples);
  }

  return [...grouped.entries()]
    .map(([id, groupSamples]): StartupTimelineNode => {
      const orderedSamples = [...groupSamples].sort(
        (left, right) => left.order - right.order,
      );
      const primarySamples = selectPrimarySamples(orderedSamples);
      const primary = primarySamples[0];
      const sourceKinds = [...new Set(orderedSamples.map((sample) => sample.sourceKind))];
      return {
        id,
        section: primary.section,
        operationKey: primary.semanticKey,
        phase: primary.phase,
        status: primary.status,
        count: primarySamples.reduce((total, sample) => total + sample.count, 0),
        project: primary.project,
        timing: buildTimingSummary(primarySamples),
        titleKey: primary.titleKey,
        titleParams: primary.titleParams,
        fallbackTitle: primary.fallbackTitle,
        descriptionKey: primary.descriptionKey,
        technicalLabels: [
          ...new Set(orderedSamples.flatMap((sample) => sample.technicalLabels)),
        ],
        sourceKinds,
        firstOrder: Math.min(...orderedSamples.map((sample) => sample.order)),
        lastOrder: Math.max(...orderedSamples.map((sample) => sample.lastOrder)),
        compact: sourceKinds.length === 1 && sourceKinds[0] === "milestone",
      };
    })
    .sort((left, right) => left.firstOrder - right.firstOrder);
}

export function projectStartupDiagnosticsTimeline(input: {
  events: readonly StartupTraceEvent[];
  notices: readonly GlobalRuntimeNotice[];
  workspaces: readonly WorkspaceReference[];
}): StartupDiagnosticsTimelineProjection {
  const sortedEvents = [...input.events].sort(
    (left, right) => left.sequence - right.sequence,
  );
  const taskExecutions = foldTaskExecutions(sortedEvents);
  const taskSamples = taskExecutions.map((execution) =>
    buildTaskSample(execution, input.workspaces),
  );

  const taskIntervalsByOperation = new Map<string, Array<{
    firstSequence: number;
    lastSequence: number;
    phase: string;
  }>>();
  for (let index = 0; index < taskSamples.length; index += 1) {
    const sample = taskSamples[index];
    const execution = taskExecutions[index];
    const key = [
      sample.aggregationOperationKey,
      sample.project.identity,
      sample.status,
    ].join("\u0000");
    const intervals = taskIntervalsByOperation.get(key) ?? [];
    intervals.push({
      firstSequence: execution.firstSequence,
      lastSequence: execution.lastSequence,
      phase: sample.phase,
    });
    taskIntervalsByOperation.set(key, intervals);
  }

  const traceSamples: OperationSample[] = [...taskSamples];
  for (const event of sortedEvents) {
    if (event.type === "task") {
      continue;
    }
    if (event.type === "milestone") {
      traceSamples.push(buildMilestoneSample(event, input.workspaces));
      continue;
    }

    const semantic = resolveSemanticDefinition([event.commandLabel]);
    const semanticKey = semantic?.key ?? "unknown-command";
    const aggregationOperationKey =
      semantic?.key ?? `${semanticKey}:${normalizeOperationLabel(event.commandLabel)}`;
    const project = resolveStartupTimelineProject(event.workspaceScope, input.workspaces);
    const intervalKey = [
      aggregationOperationKey,
      project.identity,
      event.status,
    ].join("\u0000");
    const matchingInterval = taskIntervalsByOperation
      .get(intervalKey)
      ?.find(
        (interval) =>
          interval.firstSequence <= event.sequence &&
          interval.lastSequence >= event.sequence,
      );
    traceSamples.push({
      section: "startup",
      sourceKind: "command",
      semanticKey,
      aggregationOperationKey,
      phase: matchingInterval?.phase ?? "unscoped",
      status: event.status,
      count: 1,
      durationMs: isFiniteDuration(event.durationMs) ? event.durationMs : null,
      order: event.sequence,
      lastOrder: event.sequence,
      project,
      titleKey: semantic ? operationTitleKey(semantic.key) : null,
      titleParams: undefined,
      fallbackTitle: event.commandLabel,
      descriptionKey: semantic
        ? operationDescriptionKey(semantic.key)
        : fallbackDescriptionKey("command"),
      technicalLabels: [`cmd:${event.commandLabel}`],
    });
  }

  const sortedNotices = [...input.notices].sort(
    (left, right) => left.timestampMs - right.timestampMs,
  );
  const startupNoticeOrderBase =
    (sortedEvents[sortedEvents.length - 1]?.sequence ?? 0) + 1;
  const noticeSamples = sortedNotices
    .filter(
      (notice) =>
        input.events.length === 0 ||
        (notice.category !== "diagnostic" &&
          !notice.messageKey.startsWith("runtimeNotice.startup.")),
    )
    .map((notice, index) =>
      buildNoticeSample(
        notice,
        notice.category === "bootstrap"
          ? startupNoticeOrderBase + index
          : notice.timestampMs,
        input.workspaces,
      ),
    );

  const projectedNodes = projectSamples([...traceSamples, ...noticeSamples]);
  const startupNodes = projectedNodes.filter((node) => node.section === "startup");
  const runtimeNodes = projectedNodes.filter((node) => node.section === "runtime");

  return {
    sections: [
      { id: "startup", nodes: startupNodes },
      { id: "runtime", nodes: runtimeNodes },
    ],
    rawCount: input.events.length + input.notices.length,
    nodeCount: projectedNodes.length,
  };
}
