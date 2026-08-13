import {
  resolveAlwaysPrefillCount,
  selectTopKIds,
} from "./memoryPickPolicy";
import type {
  MemoryPickComposerMode,
  MemoryPickGateUiState,
  MemoryPickResolution,
  MemoryPickRetrieveResult,
} from "./memoryPickTypes";
import { PICK_MATCH_MIN_DISPLAY_MS } from "./memoryPickTypes";
import {
  getMemoryPickSessionPolicy,
  setMemoryPickAlwaysPreferredCount,
} from "./memoryPickSessionStore";
import { emitMemoryPickTelemetry } from "./memoryPickTelemetry";

const gates = new Map<string, MemoryPickGateUiState>();
const resolvers = new Map<string, (resolution: MemoryPickResolution) => void>();
const listeners = new Set<() => void>();

/** 单调版本号：useSyncExternalStore 只订阅 number，避免对象引用抖动死循环 */
let storeVersion = 0;

function keyOf(workspaceId: string, threadId: string) {
  return `${workspaceId}\u0000${threadId}`;
}

function emit() {
  storeVersion += 1;
  listeners.forEach((listener) => listener());
}

export function subscribeMemoryPickGateStore(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 稳定 primitive snapshot（无变更时 Object.is 相等） */
export function getMemoryPickGateStoreVersion(): number {
  return storeVersion;
}

export function getMemoryPickGateSnapshot(
  workspaceId: string | null | undefined,
  threadId: string | null | undefined,
): MemoryPickGateUiState | null {
  if (!workspaceId || !threadId) return null;
  return gates.get(keyOf(workspaceId, threadId)) ?? null;
}

export function hasActiveMemoryPickGate(
  workspaceId: string | null | undefined,
  threadId: string | null | undefined,
): boolean {
  if (!workspaceId || !threadId) return false;
  return gates.has(keyOf(workspaceId, threadId));
}

export function getActiveMemoryPickGateKeys(): string[] {
  return Array.from(gates.keys());
}

function arraysEqual(a: string[], b: string[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function updateGate(
  workspaceId: string,
  threadId: string,
  patch: Partial<MemoryPickGateUiState>,
) {
  const key = keyOf(workspaceId, threadId);
  const prev = gates.get(key);
  if (!prev) return;

  // 无实质变化不 bump version，避免无意义重渲染
  let changed = false;
  for (const [k, v] of Object.entries(patch) as Array<
    [keyof MemoryPickGateUiState, MemoryPickGateUiState[keyof MemoryPickGateUiState]]
  >) {
    const prevVal = prev[k];
    if (Array.isArray(prevVal) && Array.isArray(v)) {
      if (!arraysEqual(prevVal as string[], v as string[])) {
        changed = true;
        break;
      }
    } else if (prevVal !== v) {
      changed = true;
      break;
    }
  }
  if (!changed) return;

  gates.set(key, { ...prev, ...patch });
  emit();
}

export function setMemoryPickGateSelectedIds(
  workspaceId: string,
  threadId: string,
  selectedIds: string[],
) {
  updateGate(workspaceId, threadId, { selectedIds: [...selectedIds] });
}

export function setMemoryPickGateMode(
  workspaceId: string,
  threadId: string,
  mode: MemoryPickComposerMode,
) {
  const record = gates.get(keyOf(workspaceId, threadId));
  if (!record) return;
  if (mode === record.mode) return;
  if (mode === "always") {
    const preferred = getMemoryPickSessionPolicy(
      workspaceId,
      threadId,
    ).alwaysPreferredCount;
    const topIds = selectTopKIds(
      record.candidates,
      resolveAlwaysPrefillCount(preferred, record.candidates.length),
    );
    updateGate(workspaceId, threadId, { mode, selectedIds: topIds });
    return;
  }
  updateGate(workspaceId, threadId, { mode, selectedIds: [] });
}

function settleGate(
  workspaceId: string,
  threadId: string,
  resolution: MemoryPickResolution,
) {
  const key = keyOf(workspaceId, threadId);
  const resolve = resolvers.get(key);
  if (!resolve && !gates.has(key)) return;
  const record = gates.get(key);
  gates.delete(key);
  resolvers.delete(key);
  emit();
  if (record) {
    if (resolution.action === "confirm") {
      emitMemoryPickTelemetry("memory_pick_confirm", {
        mode: resolution.mode,
        selectedCount: resolution.selectedIds.length,
        candidateCount: record.candidates.length,
        firstPick: record.firstPick,
        phase: record.phase,
      });
    } else if (resolution.action === "skip") {
      emitMemoryPickTelemetry("memory_pick_skip", {
        mode: resolution.mode,
        candidateCount: record.candidates.length,
        phase: record.phase,
      });
    } else if (resolution.action === "dismiss") {
      emitMemoryPickTelemetry("memory_pick_dismiss", {
        mode: record.mode,
        phase: record.phase,
      });
    } else if (resolution.action === "cancel") {
      emitMemoryPickTelemetry("memory_pick_cancel", {
        mode: record.mode,
        phase: record.phase,
      });
    }
  }
  resolve?.(resolution);
}

export function confirmMemoryPickGate(workspaceId: string, threadId: string) {
  const record = gates.get(keyOf(workspaceId, threadId));
  if (!record) return;
  // always 与 pick 均以用户当前勾选为准（不再强制 Top3）
  const selectedIds = [...record.selectedIds];
  if (record.mode === "always") {
    setMemoryPickAlwaysPreferredCount(
      workspaceId,
      threadId,
      selectedIds.length,
    );
  }
  // 直接 settle，避免 flushing 中间态多一次 emit
  settleGate(workspaceId, threadId, {
    action: "confirm",
    selectedIds,
    mode: record.mode === "always" ? "always" : "pick",
  });
}

export function skipMemoryPickGate(workspaceId: string, threadId: string) {
  const record = gates.get(keyOf(workspaceId, threadId));
  if (!record) return;
  settleGate(workspaceId, threadId, {
    action: "skip",
    mode: record.mode === "always" ? "always" : "pick",
  });
}

export function dismissMemoryPickGate(workspaceId: string, threadId: string) {
  settleGate(workspaceId, threadId, { action: "dismiss" });
}

export function cancelMemoryPickGate(workspaceId: string, threadId: string) {
  settleGate(workspaceId, threadId, { action: "cancel" });
}

export function openMemoryPickGate(params: {
  workspaceId: string;
  threadId: string;
  queryText: string;
  mode: MemoryPickComposerMode;
  firstPick: boolean;
  retrieve: () => Promise<
    Pick<MemoryPickRetrieveResult, "candidates" | "error"> &
      Partial<Pick<MemoryPickRetrieveResult, "diagnostics">>
  >;
}): Promise<MemoryPickResolution> {
  const { workspaceId, threadId, queryText, mode, firstPick, retrieve } =
    params;
  const key = keyOf(workspaceId, threadId);

  const existingResolve = resolvers.get(key);
  if (existingResolve) {
    gates.delete(key);
    resolvers.delete(key);
    existingResolve({ action: "cancel" });
    // 不单独 emit：下面会立刻写入新 gate 再 emit 一次
  }

  return new Promise<MemoryPickResolution>((resolve) => {
    const initialMode: MemoryPickComposerMode =
      mode === "always" || mode === "pick" ? mode : "pick";

    gates.set(key, {
      workspaceId,
      threadId,
      phase: "retrieving",
      queryText,
      candidates: [],
      selectedIds: [],
      mode: firstPick ? "pick" : initialMode,
      error: null,
      firstPick,
    });
    resolvers.set(key, resolve);
    emit();

    const startedAt = Date.now();
    const settleAfterMinDisplay = async <T,>(value: T): Promise<T> => {
      const elapsed = Date.now() - startedAt;
      const waitMs = Math.max(0, PICK_MATCH_MIN_DISPLAY_MS - elapsed);
      if (waitMs > 0) {
        await new Promise((r) => {
          window.setTimeout(r, waitMs);
        });
      }
      return value;
    };

    void retrieve()
      .then((result) => settleAfterMinDisplay(result))
      .then((result) => {
        const current = gates.get(key);
        if (!current || !resolvers.has(key)) return;

        // 无候选 / 超时 / 失败：直接过（auto skip），不弹空选择面板
        if (result.candidates.length === 0) {
          const r = resolvers.get(key);
          gates.delete(key);
          resolvers.delete(key);
          emit();
          emitMemoryPickTelemetry("memory_pick_skip", {
            mode: current.mode === "always" ? "always" : "pick",
            candidateCount: 0,
            phase: "retrieving",
            emptyReason: result.diagnostics?.emptyReason ?? null,
            error: result.error,
          });
          r?.({
            action: "skip",
            mode: current.mode === "always" ? "always" : "pick",
            emptyReason: result.diagnostics?.emptyReason ?? "no_match",
          });
          return;
        }

        const nextMode = current.mode;
        let selectedIds: string[] = [];
        if (nextMode === "always") {
          const preferred = getMemoryPickSessionPolicy(
            workspaceId,
            threadId,
          ).alwaysPreferredCount;
          selectedIds = selectTopKIds(
            result.candidates,
            resolveAlwaysPrefillCount(preferred, result.candidates.length),
          );
        }

        gates.set(key, {
          ...current,
          phase: "awaiting-choice",
          candidates: result.candidates,
          selectedIds,
          error: result.error,
        });
        emit();
        emitMemoryPickTelemetry("memory_pick_gate_shown", {
          mode: nextMode,
          candidateCount: result.candidates.length,
          firstPick: current.firstPick,
          retrievalMode: result.diagnostics?.retrievalMode ?? "lexical",
          phase: "awaiting-choice",
        });
      })
      .catch(async () => {
        await settleAfterMinDisplay(null);
        const current = gates.get(key);
        // 检索异常：直接过，不阻断发送
        if (!current || !resolvers.has(key)) return;
        const r = resolvers.get(key);
        gates.delete(key);
        resolvers.delete(key);
        emit();
        emitMemoryPickTelemetry("memory_pick_skip", {
          mode: current.mode === "always" ? "always" : "pick",
          candidateCount: 0,
          phase: "retrieving",
          emptyReason: "error",
        });
        r?.({
          action: "skip",
          mode: current.mode === "always" ? "always" : "pick",
          emptyReason: "error",
        });
      });
  });
}

export function __resetMemoryPickGateStoreForTests() {
  for (const resolve of resolvers.values()) {
    resolve({ action: "cancel" });
  }
  gates.clear();
  resolvers.clear();
  storeVersion += 1;
  listeners.forEach((listener) => listener());
}
