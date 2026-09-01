import type { OmpAdminOwner } from "./ompAdminBoundary";
import type { OmpRawEvent } from "./ompProjection";

/**
 * OMP P9 jobs/agents/delegated tasks feature-local store。
 * 高频 job control frames 只进入本模块，绝不接入 AppShell 根渲染链；
 * 订阅方通过事件驱动 listener 消费，background job settlement 与 foreground
 * turn 完全隔离（见 tasks.md 10.5 约束）。
 */

export type OmpJobKind = "agent" | "delegated-task" | "background-job" | "unknown";

export type OmpJobState =
  | "queued"
  | "running"
  | "awaiting_join"
  | "terminal"
  | "cancelled";

export type OmpJobFrameKind = "started" | "updated" | "completed";

export type OmpJobFrame = Readonly<{
  kind: OmpJobFrameKind;
  jobId: string;
  jobKind: OmpJobKind;
  owner: OmpAdminOwner | null;
  stateHint: OmpJobState | null;
  detail: string | null;
}>;

export type OmpJobFrameProjection =
  | Readonly<{ status: "known"; frame: OmpJobFrame }>
  | Readonly<{ status: "unknown"; reason: string; payload: OmpRawEvent }>;

const JOB_FRAME_TYPES: Readonly<Record<string, OmpJobFrameKind>> = {
  job_started: "started",
  job_updated: "updated",
  job_completed: "completed",
};

const JOB_KINDS: Readonly<Record<string, Exclude<OmpJobKind, "unknown">>> = {
  agent: "agent",
  delegated_task: "delegated-task",
  task: "delegated-task",
  background: "background-job",
  background_job: "background-job",
  job: "background-job",
};

const JOB_STATES: Readonly<Record<string, OmpJobState>> = {
  queued: "queued",
  running: "running",
  awaiting_join: "awaiting_join",
  terminal: "terminal",
  cancelled: "cancelled",
};

const asNonEmptyString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const asJobId = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return asNonEmptyString(value);
};

function parseOwner(value: unknown): OmpAdminOwner | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const workspaceId = asNonEmptyString(record.workspaceId);
  const runtimeProfileId = asNonEmptyString(record.runtimeProfileId);
  const providerProfileId = asNonEmptyString(record.providerProfileId);
  const nativeSessionId = asNonEmptyString(record.nativeSessionId);
  if (record.engine !== "omp" || !workspaceId || !runtimeProfileId || !providerProfileId || !nativeSessionId) {
    return null;
  }
  const logicalThreadId = asNonEmptyString(record.logicalThreadId);
  return {
    engine: "omp",
    workspaceId,
    runtimeProfileId,
    providerProfileId,
    nativeSessionId,
    ...(logicalThreadId ? { logicalThreadId } : {}),
  };
}

/**
 * 解析 OMP RPC job control frame。协议事实不足（无 stable id、未知 type）时
 * 显式返回 unknown，绝不编造协议行为。
 */
export function parseOmpJobFrame(rawEvent: OmpRawEvent): OmpJobFrameProjection {
  const unknown = (reason: string): OmpJobFrameProjection =>
    Object.freeze({ status: "unknown", reason, payload: rawEvent });

  const rawType = asNonEmptyString(rawEvent.type);
  const frameKind = rawType ? JOB_FRAME_TYPES[rawType] : undefined;
  if (!frameKind) {
    return unknown("not-a-job-frame");
  }
  const jobId =
    asJobId(rawEvent.job_id) ?? asJobId(rawEvent.jobId) ?? asJobId(rawEvent.id);
  if (!jobId) {
    return unknown("missing-job-id");
  }
  const rawKind = asNonEmptyString(rawEvent.kind) ?? asNonEmptyString(rawEvent.job_kind);
  const jobKind: OmpJobKind = (rawKind && JOB_KINDS[rawKind]) || "unknown";
  const rawState = asNonEmptyString(rawEvent.state) ?? asNonEmptyString(rawEvent.status);
  const stateHint = (rawState && JOB_STATES[rawState]) || null;
  const detail = asNonEmptyString(rawEvent.message) ?? asNonEmptyString(rawEvent.detail);
  return Object.freeze({
    status: "known",
    frame: Object.freeze({
      kind: frameKind,
      jobId,
      jobKind,
      owner: parseOwner(rawEvent.owner),
      stateHint,
      detail,
    }),
  });
}

export type OmpJobRecord = Readonly<{
  jobId: string;
  kind: OmpJobKind;
  owner: OmpAdminOwner | null;
  state: OmpJobState;
  joinedByTurnId: string | null;
  revision: number;
  lastEvent: OmpJobFrameKind | "cancel_requested";
  detail: string | null;
}>;

export type OmpJobsState = Readonly<{
  jobs: Readonly<Record<string, OmpJobRecord>>;
  /** foreground turn 标记只读，background job settlement 永不触碰。 */
  foregroundTurnId: string | null;
  unknownFrames: readonly Extract<OmpJobFrameProjection, { status: "unknown" }>[];
}>;

export const EMPTY_OMP_JOBS_STATE: OmpJobsState = Object.freeze({
  jobs: Object.freeze({}),
  foregroundTurnId: null,
  unknownFrames: Object.freeze([]),
});

/** unknown frames 有界保存，避免高频异常帧造成内存膨胀。 */
const MAX_UNKNOWN_FRAMES = 50;
/** settled（terminal/cancelled）记录有界保留：超出后按插入序驱逐最旧 settled，live 永不驱逐。 */
const MAX_SETTLED_JOBS = 100;

/** owner 结构化相等：parseOwner 每次新建对象，引用比较恒 false（P9 review 实证）。 */
const sameOwner = (a: OmpAdminOwner | null, b: OmpAdminOwner | null): boolean => {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.workspaceId === b.workspaceId &&
    a.runtimeProfileId === b.runtimeProfileId &&
    a.providerProfileId === b.providerProfileId &&
    a.nativeSessionId === b.nativeSessionId &&
    a.logicalThreadId === b.logicalThreadId
  );
};

/** 帧 owner 与既有记录 owner 均存在且不一致 → 跨 session/runtime 同 id 冲突，拒绝应用。 */
const hasOwnerConflict = (
  frameOwner: OmpAdminOwner | null,
  existingOwner: OmpAdminOwner | null,
): boolean => frameOwner !== null && existingOwner !== null && !sameOwner(frameOwner, existingOwner);

const isLive = (state: OmpJobState): boolean =>
  state === "queued" || state === "running" || state === "awaiting_join";

/** 只允许前向或同态转换，禁止 running -> queued 之类的回退。 */
const STATE_ORDER: Readonly<Record<OmpJobState, number>> = {
  queued: 0,
  running: 1,
  awaiting_join: 2,
  terminal: 3,
  cancelled: 3,
};

function canTransition(from: OmpJobState, to: OmpJobState): boolean {
  if (!isLive(from)) {
    return false;
  }
  return STATE_ORDER[to] >= STATE_ORDER[from];
}

const withJob = (
  state: OmpJobsState,
  record: OmpJobRecord,
): OmpJobsState =>
  Object.freeze({ ...state, jobs: Object.freeze({ ...state.jobs, [record.jobId]: record }) });
/** 写入后裁剪：settled 记录超上限时驱逐最旧的（对象键插入序），live 记录不受影响。 */
const pruneSettledJobs = (state: OmpJobsState): OmpJobsState => {
  const entries = Object.entries(state.jobs);
  const settledKeys = entries
    .filter(([, record]) => !isLive(record.state))
    .map(([jobId]) => jobId);
  if (settledKeys.length <= MAX_SETTLED_JOBS) {
    return state;
  }
  const evict = new Set(settledKeys.slice(0, settledKeys.length - MAX_SETTLED_JOBS));
  const jobs: Record<string, OmpJobRecord> = {};
  for (const [jobId, record] of entries) {
    if (!evict.has(jobId)) {
      jobs[jobId] = record;
    }
  }
  return Object.freeze({ ...state, jobs: Object.freeze(jobs) });
};

export function applyOmpJobFrame(
  state: OmpJobsState,
  projection: OmpJobFrameProjection,
): OmpJobsState {
  if (projection.status === "unknown") {
    // 显式记录 unknown frame，不静默丢弃
    return Object.freeze({
      ...state,
      unknownFrames: Object.freeze([...state.unknownFrames, projection].slice(-MAX_UNKNOWN_FRAMES)),
    });
  }
  const { frame } = projection;
  const existing = state.jobs[frame.jobId];

  if (frame.kind === "started") {
    if (existing && !isLive(existing.state)) {
      // terminal/cancelled 是吸收态：重复 started 不得复活 settled job
      return state;
    }
    if (existing) {
      // owner 冲突的 started 不得静默换主（跨 session 同 id 污染防护）
      if (hasOwnerConflict(frame.owner, existing.owner)) {
        return state;
      }
      const nextState =
        frame.stateHint && canTransition(existing.state, frame.stateHint)
          ? frame.stateHint
          : existing.state;
      if (
        nextState === existing.state &&
        frame.detail === existing.detail &&
        (frame.jobKind === "unknown" || frame.jobKind === existing.kind) &&
        sameOwner(frame.owner, existing.owner)
      ) {
        return state;
      }
      return withJob(state, {
        ...existing,
        kind: frame.jobKind !== "unknown" ? frame.jobKind : existing.kind,
        owner: frame.owner ?? existing.owner,
        state: nextState,
        lastEvent: "started",
        detail: frame.detail ?? existing.detail,
        revision: existing.revision + 1,
      });
    }
    return withJob(
      state,
      Object.freeze({
        jobId: frame.jobId,
        kind: frame.jobKind,
        owner: frame.owner,
        state:
          frame.stateHint && frame.stateHint !== "terminal" && frame.stateHint !== "cancelled"
            ? frame.stateHint
            : "queued",
        joinedByTurnId: null,
        revision: 0,
        lastEvent: "started",
        detail: frame.detail,
      }),
    );
  }

  if (!existing || !isLive(existing.state)) {
    // updated/completed 落在未知或已 settled 的 job 上：忽略，保持吸收语义
    return state;
  }
  // updated/completed 必须校验归属：跨 session/runtime 的同 id 帧不得污染
  // 本 session 的 job（对照 ompTodoPlan 的 profile-mismatch fail-closed 模式）。
  if (hasOwnerConflict(frame.owner, existing.owner)) {
    return state;
  }

  if (frame.kind === "updated") {
    const nextState =
      frame.stateHint && isLive(frame.stateHint) && canTransition(existing.state, frame.stateHint)
        ? frame.stateHint
        : existing.state;
    if (nextState === existing.state && frame.detail === existing.detail) {
      return state;
    }
    return withJob(state, {
      ...existing,
      state: nextState,
      lastEvent: "updated",
      detail: frame.detail ?? existing.detail,
      revision: existing.revision + 1,
    });
  }

  // completed：live -> terminal，join 关系保留用于审计
  return pruneSettledJobs(
    withJob(state, {
      ...existing,
      state: "terminal",
      lastEvent: "completed",
      detail: frame.detail ?? existing.detail,
      revision: existing.revision + 1,
    }),
  );
}

/** cancel 语义：仅对 live job 生效，terminal/cancelled 与未知 job 为 no-op。 */
export function requestOmpJobCancel(state: OmpJobsState, jobId: string): OmpJobsState {
  const existing = state.jobs[jobId];
  if (!existing || !isLive(existing.state)) {
    return state;
  }
  return pruneSettledJobs(
    withJob(state, {
      ...existing,
      state: "cancelled",
      lastEvent: "cancel_requested",
      revision: existing.revision + 1,
    }),
  );
}

/** join 语义：仅 live job 可 join；join 后进入 awaiting_join 并记录发起 turn。 */
export function requestOmpJobJoin(
  state: OmpJobsState,
  jobId: string,
  turnId: string,
): OmpJobsState {
  const existing = state.jobs[jobId];
  const normalizedTurnId = asNonEmptyString(turnId);
  if (!existing || !isLive(existing.state) || !normalizedTurnId) {
    return state;
  }
  if (existing.state === "awaiting_join" && existing.joinedByTurnId === normalizedTurnId) {
    return state;
  }
  return withJob(state, {
    ...existing,
    state: "awaiting_join",
    joinedByTurnId: normalizedTurnId,
    revision: existing.revision + 1,
  });
}

export type OmpJobsListener = (state: OmpJobsState) => void;

export type OmpJobsController = Readonly<{
  getState(): OmpJobsState;
  dispatch(rawEvent: OmpRawEvent): OmpJobFrameProjection;
  cancel(jobId: string): void;
  join(jobId: string, turnId: string): void;
  subscribe(listener: OmpJobsListener): () => void;
}>;

/**
 * Feature-local 事件驱动 store：listener 仅在 observable change 时触发，
 * 与 React/AppShell 根链解耦；foregroundTurnId 创建时绑定、此后只读。
 */
export function createOmpJobsController(
  options: { foregroundTurnId?: string | null } = {},
): OmpJobsController {
  let state: OmpJobsState = Object.freeze({
    ...EMPTY_OMP_JOBS_STATE,
    foregroundTurnId: options.foregroundTurnId ?? null,
  });
  const listeners = new Set<OmpJobsListener>();
  const commit = (next: OmpJobsState) => {
    if (next === state) {
      return;
    }
    state = next;
    for (const listener of listeners) {
      listener(state);
    }
  };
  return Object.freeze({
    getState: () => state,
    dispatch(rawEvent: OmpRawEvent): OmpJobFrameProjection {
      const projection = parseOmpJobFrame(rawEvent);
      commit(applyOmpJobFrame(state, projection));
      return projection;
    },
    cancel(jobId: string) {
      commit(requestOmpJobCancel(state, jobId));
    },
    join(jobId: string, turnId: string) {
      commit(requestOmpJobJoin(state, jobId, turnId));
    },
    subscribe(listener: OmpJobsListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  });
}
