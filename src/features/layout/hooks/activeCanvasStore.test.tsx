// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import {
  EMPTY_ACTIVE_CANVAS_CHILD_SUBAGENT_THREADS,
  EMPTY_ACTIVE_CANVAS_NATIVE_THREAD_IDS,
  EMPTY_ACTIVE_CANVAS_SNAPSHOT,
  EMPTY_ACTIVE_CANVAS_TASK_RUNS,
  activeCanvasStore,
  createActiveCanvasStore,
  setActiveCanvasSnapshot,
  shallowEqual,
  stabilizeListByMemberIdentity,
  useActiveCanvasSelector,
  type ActiveCanvasSnapshot,
} from "./activeCanvasStore";

function snapshotOf(
  overrides: Partial<ActiveCanvasSnapshot>,
): ActiveCanvasSnapshot {
  return {
    ...EMPTY_ACTIVE_CANVAS_SNAPSHOT,
    ...overrides,
  };
}

describe("activeCanvasStore", () => {
  afterEach(() => {
    cleanup();
    setActiveCanvasSnapshot(EMPTY_ACTIVE_CANVAS_SNAPSHOT);
  });

  it("does not notify when snapshot shell changes but top-level fields are identical", () => {
    const base = snapshotOf({ threadId: "thread-1" });
    const store = createActiveCanvasStore(base);
    const listener = vi.fn();
    store.subscribe(listener);

    // 新对象、字段引用全同 → 不得 notify（layout 壳抖动 #185 防御）
    store.setSnapshot({ ...base });
    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(base);
  });

  it("does not notify selector subscribers when the selected value is equal", () => {
    const store = createActiveCanvasStore(
      snapshotOf({
        threadId: "thread-1",
        isThinking: true,
      }),
    );
    const listener = vi.fn();

    store.subscribeSelector(
      (snapshot) => ({
        threadId: snapshot.threadId,
        isThinking: snapshot.isThinking,
      }),
      listener,
      shallowEqual,
    );

    store.setSnapshot(
      snapshotOf({
        threadId: "thread-1",
        isThinking: true,
        heartbeatPulse: 2,
      }),
    );

    expect(listener).not.toHaveBeenCalled();
  });

  it("notifies selector subscribers when the selected thread changes", () => {
    const store = createActiveCanvasStore(snapshotOf({ threadId: "thread-1" }));
    const listener = vi.fn();

    store.subscribeSelector((snapshot) => snapshot.threadId, listener);
    store.setSnapshot(snapshotOf({ threadId: "thread-2" }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().threadId).toBe("thread-2");
  });

  it("does not notify Canvas for background binding-only updates", () => {
    const items: ActiveCanvasSnapshot["items"] = [
      { id: "m1", kind: "message", role: "assistant", text: "done" },
    ];
    const store = createActiveCanvasStore(
      snapshotOf({
        threadId: "shared:session-1",
        items,
      }),
    );
    const listener = vi.fn();

    store.subscribeSelector(
      (snapshot) => ({ threadId: snapshot.threadId, items: snapshot.items }),
      listener,
      shallowEqual,
    );
    store.setSnapshot(
      snapshotOf({
        threadId: "shared:session-1",
        items,
        threadStatusById: {
          "shared:background": {
            isProcessing: true,
            hasUnread: false,
            isReviewing: false,
            processingStartedAt: 1,
          },
        },
      }),
    );

    expect(listener).not.toHaveBeenCalled();
  });

  it("useActiveCanvasSelector tolerates unstable inline selectors without update-depth loop", () => {
    setActiveCanvasSnapshot(snapshotOf({ threadId: "thread-stable" }));
    let renderCount = 0;

    function Probe() {
      renderCount += 1;
      // 故意每帧新箭头：旧实现会因 useMemo(selector) 换 getSnapshot 叠满 #185
      const threadId = useActiveCanvasSelector((snapshot) => snapshot.threadId);
      const [, bump] = useState(0);
      return (
        <button type="button" onClick={() => bump((n) => n + 1)}>
          {threadId}
        </button>
      );
    }

    const view = render(<Probe />);
    const baseline = renderCount;
    // 父级连点重渲染不得进入无限环
    for (let i = 0; i < 30; i += 1) {
      view.rerender(<Probe />);
    }
    expect(renderCount).toBeLessThan(baseline + 40);
    expect(view.getByRole("button").textContent).toBe("thread-stable");
    expect(activeCanvasStore.getSnapshot().threadId).toBe("thread-stable");
  });

  it("stabilizeListByMemberIdentity keeps empty and member-equal lists referentially stable", () => {
    const emptyA = stabilizeListByMemberIdentity(
      EMPTY_ACTIVE_CANVAS_CHILD_SUBAGENT_THREADS,
      [],
      EMPTY_ACTIVE_CANVAS_CHILD_SUBAGENT_THREADS,
    );
    const emptyB = stabilizeListByMemberIdentity(
      emptyA,
      [],
      EMPTY_ACTIVE_CANVAS_CHILD_SUBAGENT_THREADS,
    );
    expect(emptyA).toBe(EMPTY_ACTIVE_CANVAS_CHILD_SUBAGENT_THREADS);
    expect(emptyB).toBe(EMPTY_ACTIVE_CANVAS_CHILD_SUBAGENT_THREADS);

    const threadA = { id: "child-1" } as ActiveCanvasSnapshot["childSubagentThreads"][number];
    const first = stabilizeListByMemberIdentity(
      EMPTY_ACTIVE_CANVAS_CHILD_SUBAGENT_THREADS,
      [threadA],
      EMPTY_ACTIVE_CANVAS_CHILD_SUBAGENT_THREADS,
    );
    const second = stabilizeListByMemberIdentity(
      first,
      [threadA],
      EMPTY_ACTIVE_CANVAS_CHILD_SUBAGENT_THREADS,
    );
    expect(second).toBe(first);

    const native = stabilizeListByMemberIdentity(
      EMPTY_ACTIVE_CANVAS_NATIVE_THREAD_IDS,
      ["claude:owner"],
      EMPTY_ACTIVE_CANVAS_NATIVE_THREAD_IDS,
    );
    const nativeAgain = stabilizeListByMemberIdentity(
      native,
      ["claude:owner"],
      EMPTY_ACTIVE_CANVAS_NATIVE_THREAD_IDS,
    );
    // 字符串原始值相同但数组是新的 → 按成员 Object.is 可保留 previous
    expect(nativeAgain).toBe(native);
  });

  it("does not notify when only empty-collection shells thrash across snapshots", () => {
    const base = snapshotOf({
      threadId: "thread-1",
      childSubagentThreads: EMPTY_ACTIVE_CANVAS_CHILD_SUBAGENT_THREADS,
      activeNativeThreadIds: EMPTY_ACTIVE_CANVAS_NATIVE_THREAD_IDS,
      taskRuns: EMPTY_ACTIVE_CANVAS_TASK_RUNS,
    });
    const store = createActiveCanvasStore(base);
    const listener = vi.fn();
    store.subscribe(listener);

    // 写入前已收敛到 EMPTY_* 单例：40 次壳抖动不得 notify（#185 / App-BG-8EZ_F）
    for (let i = 0; i < 40; i += 1) {
      const stabilizedChildren = stabilizeListByMemberIdentity(
        store.getSnapshot().childSubagentThreads,
        [],
        EMPTY_ACTIVE_CANVAS_CHILD_SUBAGENT_THREADS,
      );
      const stabilizedNative = stabilizeListByMemberIdentity(
        store.getSnapshot().activeNativeThreadIds,
        [],
        EMPTY_ACTIVE_CANVAS_NATIVE_THREAD_IDS,
      );
      store.setSnapshot({
        ...base,
        childSubagentThreads: stabilizedChildren,
        activeNativeThreadIds: stabilizedNative,
        taskRuns: EMPTY_ACTIVE_CANVAS_TASK_RUNS,
      });
    }
    expect(listener).not.toHaveBeenCalled();
  });

  it("useActiveCanvasSelector keeps object slice identity when only unrelated store fields change", () => {
    type CanvasSlice = {
      threadId: string | null;
      items: ActiveCanvasSnapshot["items"];
    };
    const items: ActiveCanvasSnapshot["items"] = [
      { id: "m1", kind: "message", role: "assistant", text: "hello" },
    ];
    setActiveCanvasSnapshot(
      snapshotOf({
        threadId: "thread-1",
        items,
        isThinking: true,
      }),
    );

    let renderCount = 0;
    // 用数组槽位承接闭包写入，避免 let | null 在 tsc 下被收窄成 never
    // （build 的 `tsc` include 了 src/**/*.test.tsx）。
    const lastSliceBox: { current: CanvasSlice | null } = { current: null };

    function Probe() {
      renderCount += 1;
      const slice = useActiveCanvasSelector(
        (snapshot): CanvasSlice => ({
          threadId: snapshot.threadId,
          items: snapshot.items,
        }),
        shallowEqual,
      );
      lastSliceBox.current = slice;
      return <div data-testid="slice">{slice.threadId}</div>;
    }

    render(<Probe />);
    const sliceAfterMount = lastSliceBox.current;
    const rendersAfterMount = renderCount;
    expect(sliceAfterMount).not.toBeNull();
    expect(sliceAfterMount!.threadId).toBe("thread-1");

    // 仅 heartbeat 抖动：select 切片语义不变 → 不得强制重渲染换引用
    setActiveCanvasSnapshot(
      snapshotOf({
        threadId: "thread-1",
        items,
        isThinking: true,
        heartbeatPulse: 9,
      }),
    );

    expect(renderCount).toBe(rendersAfterMount);
    expect(lastSliceBox.current).toBe(sliceAfterMount);
  });
});
