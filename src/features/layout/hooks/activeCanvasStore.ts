import { useCallback, useRef, useSyncExternalStore } from "react";

import type {
  RateLimitSnapshot,
  ThreadSummary,
  ThreadTokenUsage,
} from "../../../types";
import type { MessagesProps } from "../../messages";
import type { ThreadActivityStatus } from "./layoutNodesTypes";

export type ActiveCanvasSnapshot = Pick<
  MessagesProps,
  | "items"
  | "threadId"
  | "workspaceId"
  | "workspacePath"
  | "userInputRequests"
  | "approvals"
  | "conversationState"
  | "plan"
  | "isThinking"
  | "isHistoryLoading"
  | "historyLoadingProgress"
  | "historyRecoveryFailureReason"
  | "isContextCompacting"
  | "processingStartedAt"
  | "lastDurationMs"
  | "heartbeatPulse"
  | "codexSilentSuspectedAt"
  | "taskRuns"
> & {
  activeWorkspaceId: string | null;
  activeTurnId: string | null;
  threadItemsByThread: Record<string, MessagesProps["items"]>;
  threadStatusById: Record<string, ThreadActivityStatus>;
  activeThreadStatus: ThreadActivityStatus | null;
  activeTokenUsage: ThreadTokenUsage | null;
  activeRateLimits: RateLimitSnapshot | null;
  /**
   * 当前幕布线程的子代理会话（parentThreadId === threadId）。
   * Shared Grok 投影缺 spawn tool 时，用它合成 persona 卡。
   */
  childSubagentThreads: ThreadSummary[];
  /**
   * Shared 父会话的 nativeThreadIds（含 claude: owner），用于 Claude Agent 子会话解析。
   */
  activeNativeThreadIds: string[];
};

export type ActiveCanvasStore = {
  getSnapshot: () => ActiveCanvasSnapshot;
  setSnapshot: (snapshot: ActiveCanvasSnapshot) => void;
  subscribe: (listener: () => void) => () => void;
  subscribeSelector: <T>(
    selector: (snapshot: ActiveCanvasSnapshot) => T,
    listener: () => void,
    isEqual?: (left: T, right: T) => boolean,
  ) => () => void;
};

export const EMPTY_ACTIVE_CANVAS_ITEMS: MessagesProps["items"] = [];
export const EMPTY_ACTIVE_CANVAS_THREAD_ITEMS: Record<
  string,
  MessagesProps["items"]
> = {};
export const EMPTY_ACTIVE_CANVAS_THREAD_STATUS: Record<
  string,
  ThreadActivityStatus
> = {};
export const EMPTY_ACTIVE_CANVAS_TASK_RUNS: NonNullable<
  MessagesProps["taskRuns"]
> = [];

/** 空数组必须是模块级单例：layout 每帧 `?? []` / `filter→[]` 会击穿 setSnapshot 顶层 shallowEqual。 */
export const EMPTY_ACTIVE_CANVAS_USER_INPUT_REQUESTS: NonNullable<
  MessagesProps["userInputRequests"]
> = [];
export const EMPTY_ACTIVE_CANVAS_APPROVALS: NonNullable<
  MessagesProps["approvals"]
> = [];
export const EMPTY_ACTIVE_CANVAS_CHILD_SUBAGENT_THREADS: ThreadSummary[] = [];
export const EMPTY_ACTIVE_CANVAS_NATIVE_THREAD_IDS: string[] = [];

export const EMPTY_ACTIVE_CANVAS_SNAPSHOT: ActiveCanvasSnapshot = {
  activeWorkspaceId: null,
  activeTurnId: null,
  items: EMPTY_ACTIVE_CANVAS_ITEMS,
  threadId: null,
  workspaceId: null,
  workspacePath: null,
  userInputRequests: EMPTY_ACTIVE_CANVAS_USER_INPUT_REQUESTS,
  approvals: EMPTY_ACTIVE_CANVAS_APPROVALS,
  conversationState: null,
  plan: null,
  isThinking: false,
  isHistoryLoading: false,
  historyLoadingProgress: null,
  historyRecoveryFailureReason: null,
  isContextCompacting: false,
  processingStartedAt: null,
  lastDurationMs: null,
  heartbeatPulse: 0,
  codexSilentSuspectedAt: null,
  taskRuns: EMPTY_ACTIVE_CANVAS_TASK_RUNS,
  threadItemsByThread: EMPTY_ACTIVE_CANVAS_THREAD_ITEMS,
  threadStatusById: EMPTY_ACTIVE_CANVAS_THREAD_STATUS,
  activeThreadStatus: null,
  activeTokenUsage: null,
  activeRateLimits: null,
  childSubagentThreads: EMPTY_ACTIVE_CANVAS_CHILD_SUBAGENT_THREADS,
  activeNativeThreadIds: EMPTY_ACTIVE_CANVAS_NATIVE_THREAD_IDS,
};

/**
 * 列表成员 Object.is 全等时保留 previous 引用。
 * 供 layout 写 snapshot 时切断「filter/map 出新数组、内容未变」的 store notify。
 */
export function stabilizeListByMemberIdentity<T>(
  previous: readonly T[],
  next: readonly T[],
  empty: T[],
): T[] {
  if (next.length === 0) {
    return empty;
  }
  if (
    previous.length === next.length &&
    previous.every((item, index) => Object.is(item, next[index]))
  ) {
    return previous as T[];
  }
  return next as T[];
}

export function shallowEqual<T extends Record<string, unknown>>(
  left: T,
  right: T,
): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => Object.is(left[key], right[key]));
}

export function createActiveCanvasStore(
  initialSnapshot: ActiveCanvasSnapshot = EMPTY_ACTIVE_CANVAS_SNAPSHOT,
): ActiveCanvasStore {
  let snapshot = initialSnapshot;
  const listeners = new Set<() => void>();

  const notify = () => {
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot: () => snapshot,
    setSnapshot: (nextSnapshot) => {
      if (Object.is(snapshot, nextSnapshot)) {
        return;
      }
      // 顶层字段全部 Object.is 相等时不 notify：切断 layout 每帧换 snapshot 壳引用
      // 导致的 useSyncExternalStore 订阅风暴（AP-02 / #185）。
      if (
        shallowEqual(
          snapshot as unknown as Record<string, unknown>,
          nextSnapshot as unknown as Record<string, unknown>,
        )
      ) {
        return;
      }
      snapshot = nextSnapshot;
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeSelector: (selector, listener, isEqual = Object.is) => {
      let selected = selector(snapshot);
      return activeCanvasStoreSubscribe(listeners, () => {
        const nextSelected = selector(snapshot);
        if (isEqual(selected, nextSelected)) {
          return;
        }
        selected = nextSelected;
        listener();
      });
    },
  };
}

function activeCanvasStoreSubscribe(
  listeners: Set<() => void>,
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const activeCanvasStore = createActiveCanvasStore();

export function setActiveCanvasSnapshot(snapshot: ActiveCanvasSnapshot): void {
  activeCanvasStore.setSnapshot(snapshot);
}

export function getActiveCanvasSnapshot(): ActiveCanvasSnapshot {
  return activeCanvasStore.getSnapshot();
}

/**
 * 从 activeCanvasStore 选取切片。
 *
 * 关键 #185 防护（对抗式约束）：
 * 1. selector / isEqual 经 ref 读取——内联箭头 identity 不得驱动 subscribe/getSnapshot 重建。
 * 2. getSnapshot 必须可重复调用且返回稳定引用：语义相等时回传缓存 selected，
 *    禁止「每次 selector() 都 new 对象 → useSyncExternalStore 判定变化 → 无限渲染」。
 * 3. 对象切片必须传 shallowEqual（或自定义 isEqual）；默认 Object.is 只适用于
 *    primitive / 稳定字段引用。
 * 4. 订阅整 store notify，由 getSnapshot 做选择与 isEqual；无关字段抖动不换 selected 引用。
 */
export function useActiveCanvasSelector<T>(
  selector: (snapshot: ActiveCanvasSnapshot) => T,
  isEqual: (left: T, right: T) => boolean = Object.is,
): T {
  const selectorRef = useRef(selector);
  const isEqualRef = useRef(isEqual);
  selectorRef.current = selector;
  isEqualRef.current = isEqual;

  type SelectionCache = {
    storeSnapshot: ActiveCanvasSnapshot;
    selected: T;
  };
  const cacheRef = useRef<SelectionCache | null>(null);

  const subscribe = useCallback((onStoreChange: () => void) => {
    return activeCanvasStore.subscribe(onStoreChange);
  }, []);

  const getSnapshot = useCallback((): T => {
    const storeSnapshot = activeCanvasStore.getSnapshot();
    const cache = cacheRef.current;
    // 同一 store 对象：直接回缓存，保证 getSnapshot 多次调用恒等
    if (cache && Object.is(cache.storeSnapshot, storeSnapshot)) {
      return cache.selected;
    }
    const nextSelected = selectorRef.current(storeSnapshot);
    if (cache && isEqualRef.current(cache.selected, nextSelected)) {
      // 字段语义未变：保留 selected 引用，只前移 storeSnapshot 指针
      cacheRef.current = {
        storeSnapshot,
        selected: cache.selected,
      };
      return cache.selected;
    }
    cacheRef.current = {
      storeSnapshot,
      selected: nextSelected,
    };
    return nextSelected;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
