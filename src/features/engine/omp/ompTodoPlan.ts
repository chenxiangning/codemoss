import {
  getClientStoreSync,
  writeClientStoreValue,
} from "@/services/clientStorage";

/**
 * OMP P9 todo operations / plan state / compact / handoff 的 feature-local projection。
 * 协议事实不足的操作显式 unknown；context 丢失显式 recovery，绝不静默继续。
 * 持久化遵循 ompProviderProfile.ts 的 profile-scoped client storage 模式。
 */

export type OmpTodoStatus = "pending" | "in_progress" | "completed";

export type OmpTodoItem = Readonly<{
  id: string;
  content: string;
  status: OmpTodoStatus;
}>;

export type OmpTodoOperation = "add" | "update" | "complete" | "remove" | "clear";

/** 允许任意 operation 字符串进入边界，由投影负责显式 unknown。 */
export type OmpTodoOperationInput = Readonly<{
  operation: string;
  itemId?: string | null;
  content?: string | null;
  status?: string | null;
}>;

export type OmpPlanState =
  | "idle"
  | "planning"
  | "awaiting_review"
  | "executing"
  | "completed"
  | "failed";

export type OmpTodoPlanState = Readonly<{
  profileId: string;
  todos: readonly OmpTodoItem[];
  planState: OmpPlanState;
  revision: number;
}>;

export type OmpTodoProjectionResult =
  | Readonly<{ status: "applied"; state: OmpTodoPlanState }>
  | Readonly<{ status: "unknown"; reason: string; state: OmpTodoPlanState }>;

export type OmpPlanTransitionResult =
  | Readonly<{ status: "applied"; state: OmpTodoPlanState }>
  | Readonly<{ status: "rejected"; reason: string; state: OmpTodoPlanState }>;

const TODO_STATUSES: Readonly<Record<string, OmpTodoStatus>> = {
  pending: "pending",
  in_progress: "in_progress",
  completed: "completed",
};

/** plan 状态机：仅允许表中显式声明的边，其余一律 rejected。 */
const PLAN_TRANSITIONS: Readonly<Record<OmpPlanState, readonly OmpPlanState[]>> = {
  idle: ["planning"],
  planning: ["awaiting_review", "failed"],
  awaiting_review: ["executing", "planning"],
  executing: ["completed", "failed"],
  completed: ["idle"],
  failed: ["planning", "idle"],
};

export function createOmpTodoPlanState(profileId: string): OmpTodoPlanState {
  return Object.freeze({
    profileId: profileId.trim(),
    todos: Object.freeze([]),
    planState: "idle",
    revision: 0,
  });
}

const normalizeText = (value: string | null | undefined): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const unknownTodoResult = (
  state: OmpTodoPlanState,
  reason: string,
): OmpTodoProjectionResult => Object.freeze({ status: "unknown", reason, state });

export function applyOmpTodoOperation(
  state: OmpTodoPlanState,
  input: OmpTodoOperationInput,
): OmpTodoProjectionResult {
  const operation = input.operation;
  const itemId = normalizeText(input.itemId);
  const applied = (todos: readonly OmpTodoItem[]): OmpTodoProjectionResult =>
    Object.freeze({
      status: "applied",
      state: Object.freeze({
        ...state,
        todos: Object.freeze([...todos]),
        revision: state.revision + 1,
      }),
    });

  switch (operation as OmpTodoOperation) {
    case "add": {
      const content = normalizeText(input.content);
      if (!itemId || !content) {
        return unknownTodoResult(state, "malformed-add-operation");
      }
      if (state.todos.some((todo) => todo.id === itemId)) {
        return unknownTodoResult(state, "duplicate-todo-id");
      }
      return applied([...state.todos, Object.freeze({ id: itemId, content, status: "pending" })]);
    }
    case "update": {
      if (!itemId) {
        return unknownTodoResult(state, "malformed-update-operation");
      }
      const target = state.todos.find((todo) => todo.id === itemId);
      if (!target) {
        return unknownTodoResult(state, "missing-todo-item");
      }
      const status = input.status ? TODO_STATUSES[input.status] : undefined;
      if (input.status && !status) {
        return unknownTodoResult(state, "unknown-todo-status");
      }
      const content = normalizeText(input.content) ?? target.content;
      return applied(
        state.todos.map((todo) =>
          todo.id === itemId
            ? Object.freeze({ ...todo, content, status: status ?? todo.status })
            : todo,
        ),
      );
    }
    case "complete": {
      if (!itemId || !state.todos.some((todo) => todo.id === itemId)) {
        return unknownTodoResult(state, "missing-todo-item");
      }
      return applied(
        state.todos.map((todo) =>
          todo.id === itemId ? Object.freeze({ ...todo, status: "completed" }) : todo,
        ),
      );
    }
    case "remove": {
      if (!itemId || !state.todos.some((todo) => todo.id === itemId)) {
        return unknownTodoResult(state, "missing-todo-item");
      }
      return applied(state.todos.filter((todo) => todo.id !== itemId));
    }
    case "clear":
      return applied([]);
    default:
      return unknownTodoResult(state, "unknown-todo-operation");
  }
}

export function transitionOmpPlanState(
  state: OmpTodoPlanState,
  next: OmpPlanState,
): OmpPlanTransitionResult {
  if (!PLAN_TRANSITIONS[state.planState].includes(next)) {
    return Object.freeze({ status: "rejected", reason: "illegal-plan-transition", state });
  }
  return Object.freeze({
    status: "applied",
    state: Object.freeze({ ...state, planState: next, revision: state.revision + 1 }),
  });
}

/** compact 后保留的 canonical facts：todos（id/content/status）、planState、profileId。 */
export type OmpCompactedContext = Readonly<{
  kind: "omp-todo-plan-compact";
  profileId: string;
  planState: OmpPlanState;
  todos: readonly OmpTodoItem[];
  droppedFields: readonly string[];
}>;

/**
 * compact 边界：canonical facts 之外的一切 transient 字段（raw payload、stream
 * delta 等）显式列入 droppedFields，绝不混入投影。
 */
export function compactOmpTodoPlanContext(
  state: OmpTodoPlanState,
  extras: Readonly<Record<string, unknown>> = {},
): OmpCompactedContext {
  return Object.freeze({
    kind: "omp-todo-plan-compact",
    profileId: state.profileId,
    planState: state.planState,
    todos: state.todos,
    droppedFields: Object.freeze(Object.keys(extras)),
  });
}

export type OmpHandoffContext = Readonly<{
  kind: "omp-todo-plan-handoff";
  schemaVersion: 1;
  profileId: string;
  targetSessionId: string | null;
  planState: OmpPlanState;
  todos: readonly OmpTodoItem[];
}>;

/** handoff 只携带显式字段集；目标 session 未知时为 null，禁止编造。 */
export function buildOmpHandoffContext(
  state: OmpTodoPlanState,
  targetSessionId?: string | null,
): OmpHandoffContext {
  return Object.freeze({
    kind: "omp-todo-plan-handoff",
    schemaVersion: 1,
    profileId: state.profileId,
    targetSessionId: normalizeText(targetSessionId),
    planState: state.planState,
    todos: state.todos,
  });
}

export const OMP_TODO_PLAN_STORAGE_PREFIX = "ompTodoPlan";

export function ompTodoPlanStorageKey(profileId: string): string {
  return `${OMP_TODO_PLAN_STORAGE_PREFIX}:${profileId.trim()}`;
}

function isValidTodoItem(value: unknown): value is OmpTodoItem {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.content === "string" &&
    typeof record.status === "string" &&
    Object.values(TODO_STATUSES).includes(record.status as OmpTodoStatus)
  );
}

function normalizePersistedState(value: unknown): OmpTodoPlanState | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.profileId !== "string" ||
    !record.profileId.trim() ||
    !Array.isArray(record.todos) ||
    !record.todos.every(isValidTodoItem) ||
    typeof record.planState !== "string" ||
    !(record.planState in PLAN_TRANSITIONS) ||
    typeof record.revision !== "number"
  ) {
    return null;
  }
  return Object.freeze({
    profileId: record.profileId,
    todos: Object.freeze(record.todos as readonly OmpTodoItem[]),
    planState: record.planState as OmpPlanState,
    revision: record.revision,
  });
}

export function readOmpTodoPlanState(profileId: string): OmpTodoPlanState | null {
  return normalizePersistedState(
    getClientStoreSync<unknown>("app", ompTodoPlanStorageKey(profileId)),
  );
}

export function persistOmpTodoPlanState(state: OmpTodoPlanState): void {
  writeClientStoreValue("app", ompTodoPlanStorageKey(state.profileId), state, {
    immediate: true,
  });
}

export type OmpTodoPlanRecovery =
  | Readonly<{ status: "recovered"; state: OmpTodoPlanState }>
  | Readonly<{
      status: "lost";
      reason: "missing-persisted-state" | "profile-mismatch" | "corrupt-persisted-state";
      state: null;
    }>;

/** context 丢失显式 recovery：missing / profile 串台 / 损坏分别给出 reason。 */
export function recoverOmpTodoPlanContext(profileId: string): OmpTodoPlanRecovery {
  const lost = (reason: Extract<OmpTodoPlanRecovery, { status: "lost" }>["reason"]) =>
    Object.freeze({ status: "lost", reason, state: null }) as OmpTodoPlanRecovery;

  const raw = getClientStoreSync<unknown>("app", ompTodoPlanStorageKey(profileId));
  if (raw === undefined || raw === null) {
    return lost("missing-persisted-state");
  }
  const state = normalizePersistedState(raw);
  if (!state) {
    return lost("corrupt-persisted-state");
  }
  if (state.profileId !== profileId.trim()) {
    return lost("profile-mismatch");
  }
  return Object.freeze({ status: "recovered", state });
}
