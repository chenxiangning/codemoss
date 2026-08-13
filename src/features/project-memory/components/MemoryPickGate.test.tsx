// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryPickGate } from "./MemoryPickGate";
import { MemoryPickGateHost } from "./MemoryPickGateHost";
import {
  __resetMemoryPickGateStoreForTests,
  getMemoryPickGateSnapshot,
  getMemoryPickGateStoreVersion,
  openMemoryPickGate,
} from "../memoryPick/memoryPickGateStore";
import type { MemoryPickCandidate } from "../memoryPick/memoryPickTypes";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { defaultValue?: string }) =>
        options?.defaultValue ?? key,
    }),
  };
});

vi.mock("../services/projectMemoryFacade", () => ({
  projectMemoryFacade: {
    get: vi.fn(async () => null),
  },
}));

function candidate(
  id: string,
  score: number,
  title = id,
): MemoryPickCandidate {
  return {
    id,
    title,
    summary: `sum-${id}`,
    score,
    updatedAt: score * 100,
    detail: `detail-${id}`,
  };
}

beforeEach(() => {
  __resetMemoryPickGateStoreForTests();
});

afterEach(() => {
  cleanup();
  __resetMemoryPickGateStoreForTests();
  vi.useRealTimers();
});

describe("MemoryPickGate", () => {
  it("renders nothing when no active gate", () => {
    const { container } = render(
      <MemoryPickGate workspaceId="ws" threadId="th" />,
    );
    expect(container.querySelector(".memory-pick-gate")).toBeNull();
  });

  it("shows candidates, toggles pick selection, and confirms", async () => {
    const resolution = openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th",
      queryText: "数据库",
      mode: "pick",
      firstPick: true,
      retrieve: async () => ({
        candidates: [
          candidate("m1", 0.9, "连接池"),
          candidate("m2", 0.5, "主题"),
        ],
        error: null,
      }),
    });

    render(<MemoryPickGate workspaceId="ws" threadId="th" />);

    await waitFor(() => {
      expect(screen.getByText("连接池")).toBeTruthy();
    });
    expect(screen.getByText(/发送前/)).toBeTruthy();
    expect(screen.getAllByText("本轮挑选记忆注入").length).toBeGreaterThan(0);

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    fireEvent.click(checkboxes[0]!);

    fireEvent.click(screen.getByRole("button", { name: "确认并发送" }));
    await expect(resolution).resolves.toMatchObject({
      action: "confirm",
      selectedIds: ["m1"],
      mode: "pick",
    });
  });

  it("opens detail dialog from row action", async () => {
    void openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th-detail",
      queryText: "q",
      mode: "pick",
      firstPick: false,
      retrieve: async () => ({
        candidates: [candidate("m1", 0.9, "决策A")],
        error: null,
      }),
    });

    render(<MemoryPickGate workspaceId="ws" threadId="th-detail" />);
    await waitFor(() => expect(screen.getByText("决策A")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "详情" }));
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeTruthy();
    });
    expect(screen.getByText("detail-m1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "勾选本条并关闭" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(getMemoryPickGateSnapshot("ws", "th-detail")?.selectedIds).toContain(
      "m1",
    );
  });

  it("switch to always keeps checkboxes editable and dismiss resolves", async () => {
    const resolution = openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th-always",
      queryText: "q",
      mode: "pick",
      firstPick: false,
      retrieve: async () => ({
        candidates: [
          candidate("a", 0.9),
          candidate("b", 0.8),
          candidate("c", 0.7),
        ],
        error: null,
      }),
    });

    render(<MemoryPickGate workspaceId="ws" threadId="th-always" />);
    await waitFor(() => expect(screen.getByText("a")).toBeTruthy());

    fireEvent.click(
      screen.getByRole("radio", { name: /整轮开启自动top\(n\)记忆注入/ }),
    );
    await waitFor(() => {
      expect(getMemoryPickGateSnapshot("ws", "th-always")?.mode).toBe("always");
    });
    const boxes = screen.getAllByRole("checkbox");
    boxes.forEach((box) => {
      expect((box as HTMLInputElement).disabled).toBe(false);
    });
    // 可增减勾选
    fireEvent.click(boxes[0]!);
    await waitFor(() => {
      const ids = getMemoryPickGateSnapshot("ws", "th-always")?.selectedIds ?? [];
      expect(ids.length).toBeLessThan(3);
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "本 session 不再提示 · 整轮关闭记忆注入",
      }),
    );
    await expect(resolution).resolves.toEqual({ action: "dismiss" });
  });

  it("skip does not inject selection", async () => {
    const resolution = openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th-skip",
      queryText: "q",
      mode: "pick",
      firstPick: false,
      retrieve: async () => ({
        candidates: [candidate("x", 1, "X")],
        error: null,
      }),
    });
    render(<MemoryPickGate workspaceId="ws" threadId="th-skip" />);
    await waitFor(() => expect(screen.getByText("X")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "不选，直接发送" }));
    await expect(resolution).resolves.toEqual({
      action: "skip",
      mode: "pick",
    });
  });

  /** 假时钟下推进到 awaiting（含匹配最短展示 1s） */
  async function flushToAwaitingChoice() {
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1100);
      await Promise.resolve();
    });
  }

  it("always mode on open starts auto-confirm countdown", async () => {
    vi.useFakeTimers();
    const resolution = openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th-auto-open",
      queryText: "q",
      mode: "always",
      firstPick: false,
      retrieve: async () => ({
        candidates: [
          candidate("a", 0.9),
          candidate("b", 0.8),
          candidate("c", 0.7),
        ],
        error: null,
      }),
    });

    render(<MemoryPickGate workspaceId="ws" threadId="th-auto-open" />);
    await flushToAwaitingChoice();

    expect(screen.getByRole("button", { name: "取消自动确认" })).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8500);
    });
    await expect(resolution).resolves.toMatchObject({
      action: "confirm",
      mode: "always",
    });
  });

  it("switching pick→always mid-gate does not start auto-confirm", async () => {
    vi.useFakeTimers();
    void openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th-switch-no-auto",
      queryText: "q",
      mode: "pick",
      firstPick: false,
      retrieve: async () => ({
        candidates: [
          candidate("a", 0.9),
          candidate("b", 0.8),
          candidate("c", 0.7),
        ],
        error: null,
      }),
    });

    render(<MemoryPickGate workspaceId="ws" threadId="th-switch-no-auto" />);
    await flushToAwaitingChoice();
    expect(screen.getByText("a")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("radio", { name: /整轮开启自动top\(n\)记忆注入/ }),
    );
    expect(getMemoryPickGateSnapshot("ws", "th-switch-no-auto")?.mode).toBe(
      "always",
    );

    // 中途切换不得出现「取消自动确认」
    expect(screen.queryByRole("button", { name: "取消自动确认" })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });

    expect(screen.queryByRole("button", { name: "取消自动确认" })).toBeNull();
    expect(getMemoryPickGateSnapshot("ws", "th-switch-no-auto")?.phase).toBe(
      "awaiting-choice",
    );
  });

  it("user interaction interrupts auto-confirm and does not restart", async () => {
    vi.useFakeTimers();
    const resolution = openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th-interrupt",
      queryText: "q",
      mode: "always",
      firstPick: false,
      retrieve: async () => ({
        candidates: [
          candidate("a", 0.9),
          candidate("b", 0.8),
          candidate("c", 0.7),
        ],
        error: null,
      }),
    });

    render(<MemoryPickGate workspaceId="ws" threadId="th-interrupt" />);
    await flushToAwaitingChoice();
    expect(screen.getByRole("button", { name: "取消自动确认" })).toBeTruthy();

    // 勾选交互打断
    const boxes = screen.getAllByRole("checkbox");
    fireEvent.click(boxes[0]!);
    expect(screen.queryByRole("button", { name: "取消自动确认" })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });

    // 仍停留在挑选态，未自动 confirm
    expect(getMemoryPickGateSnapshot("ws", "th-interrupt")?.phase).toBe(
      "awaiting-choice",
    );

    fireEvent.click(screen.getByRole("button", { name: "确认并发送" }));
    await expect(resolution).resolves.toMatchObject({ action: "confirm" });
  });

  it("matching phase is compact: no strategy rail or confirm buttons", async () => {
    let resolveRetrieve!: (value: {
      candidates: MemoryPickCandidate[];
      error: null;
    }) => void;
    const retrievePromise = new Promise<{
      candidates: MemoryPickCandidate[];
      error: null;
    }>((resolve) => {
      resolveRetrieve = resolve;
    });

    void openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th-load",
      queryText: "q",
      mode: "pick",
      firstPick: false,
      retrieve: () => retrievePromise,
    });

    const { container } = render(
      <MemoryPickGate workspaceId="ws" threadId="th-load" />,
    );
    expect(
      container.querySelector(".memory-pick-gate--matching"),
    ).toBeTruthy();
    expect(screen.getByText(/正在匹配项目记忆/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "确认并发送" })).toBeNull();
    expect(container.querySelector(".memory-pick-gate__split")).toBeNull();

    await act(async () => {
      resolveRetrieve({
        candidates: [candidate("z", 1, "Z")],
        error: null,
      });
    });
    await waitFor(() => expect(screen.getByText("Z")).toBeTruthy(), {
      timeout: 3000,
    });
    expect(container.querySelector(".memory-pick-gate--ready")).toBeTruthy();
    expect(screen.getByRole("button", { name: "确认并发送" })).toBeTruthy();
  });

  it("does not thrash versions when Host mounts without active gate", () => {
    const before = getMemoryPickGateStoreVersion();
    const { rerender } = render(
      <MemoryPickGateHost workspaceId="ws" threadId="th-idle" />,
    );
    // 多次父级重渲染不得 bump store / 死循环
    for (let i = 0; i < 20; i += 1) {
      rerender(<MemoryPickGateHost workspaceId="ws" threadId="th-idle" />);
    }
    expect(getMemoryPickGateStoreVersion()).toBe(before);
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("Host mounts gate UI when open and unmounts after settle", async () => {
    const resolution = openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th-host",
      queryText: "q",
      mode: "pick",
      firstPick: false,
      retrieve: async () => ({
        candidates: [candidate("h1", 1, "HostMem")],
        error: null,
      }),
    });

    render(<MemoryPickGateHost workspaceId="ws" threadId="th-host" />);
    await waitFor(() => expect(screen.getByText("HostMem")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "不选，直接发送" }));
    await resolution;
    await waitFor(() => {
      expect(screen.queryByText("HostMem")).toBeNull();
    });
  });
});
