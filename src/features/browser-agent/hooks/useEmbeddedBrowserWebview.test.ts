import { beforeEach, describe, expect, it, vi } from "vitest";

const mountBrowserAgentWebview = vi.fn();
const syncBrowserAgentWebviewBounds = vi.fn();
const hideBrowserAgentWebview = vi.fn();

vi.mock("@/services/tauri", () => ({
  mountBrowserAgentWebview: (...args: unknown[]) =>
    mountBrowserAgentWebview(...args),
  syncBrowserAgentWebviewBounds: (...args: unknown[]) =>
    syncBrowserAgentWebviewBounds(...args),
  hideBrowserAgentWebview: (...args: unknown[]) =>
    hideBrowserAgentWebview(...args),
}));

const BOUNDS = { x: 10, y: 20, width: 640, height: 480 };

// 模块级 mounted 集合跨用例隔离：每个用例重新加载模块拿到干净状态
async function loadModule() {
  return import("./useEmbeddedBrowserWebview");
}

describe("useEmbeddedBrowserWebview module helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    mountBrowserAgentWebview.mockReset().mockResolvedValue({});
    syncBrowserAgentWebviewBounds.mockReset().mockResolvedValue(undefined);
    hideBrowserAgentWebview.mockReset().mockResolvedValue(undefined);
  });

  it("首次显示走 mount，再次显示同会话走 sync（不重建页面）", async () => {
    const { showEmbeddedBrowserWebview } = await loadModule();

    await showEmbeddedBrowserWebview("s1", BOUNDS);
    expect(mountBrowserAgentWebview).toHaveBeenCalledWith({
      browserSessionId: "s1",
      bounds: BOUNDS,
    });
    expect(syncBrowserAgentWebviewBounds).not.toHaveBeenCalled();

    await showEmbeddedBrowserWebview("s1", BOUNDS);
    expect(mountBrowserAgentWebview).toHaveBeenCalledTimes(1);
    expect(syncBrowserAgentWebviewBounds).toHaveBeenCalledWith("s1", BOUNDS);
  });

  it("晚到 mount 后仍按最后激活的 tab 收敛 native renderer", async () => {
    const { showEmbeddedBrowserWebview } = await loadModule();

    await showEmbeddedBrowserWebview("s1", BOUNDS);

    let resolveSecondMount: ((value: unknown) => void) | undefined;
    mountBrowserAgentWebview.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecondMount = resolve;
        }),
    );

    const staleShow = showEmbeddedBrowserWebview("s2", BOUNDS);
    await Promise.resolve();
    await Promise.resolve();
    expect(resolveSecondMount).toBeTypeOf("function");

    const latestShow = showEmbeddedBrowserWebview("s1", BOUNDS);

    resolveSecondMount?.({});
    await Promise.all([staleShow, latestShow]);

    expect(mountBrowserAgentWebview).toHaveBeenLastCalledWith({
      browserSessionId: "s1",
      bounds: BOUNDS,
    });
    expect(mountBrowserAgentWebview.mock.invocationCallOrder[1]).toBeLessThan(
      mountBrowserAgentWebview.mock.invocationCallOrder[2] ?? Infinity,
    );
    expect(hideBrowserAgentWebview).not.toHaveBeenCalledWith("s1");
  });

  it("does not hide the current tab when the next mount fails", async () => {
    const { showEmbeddedBrowserWebview } = await loadModule();

    await showEmbeddedBrowserWebview("s1", BOUNDS);
    hideBrowserAgentWebview.mockClear();
    mountBrowserAgentWebview.mockRejectedValueOnce(new Error("webview busy"));

    await expect(showEmbeddedBrowserWebview("s2", BOUNDS)).rejects.toThrow(
      /webview busy/,
    );

    expect(hideBrowserAgentWebview).not.toHaveBeenCalled();
  });

  it("A → B → A 每次切 tab 都导航同一个 native renderer", async () => {
    const { showEmbeddedBrowserWebview } = await loadModule();

    await showEmbeddedBrowserWebview("s1", BOUNDS);
    await showEmbeddedBrowserWebview("s2", BOUNDS);
    await showEmbeddedBrowserWebview("s1", BOUNDS);

    expect(mountBrowserAgentWebview).toHaveBeenCalledTimes(3);
    expect(mountBrowserAgentWebview).toHaveBeenNthCalledWith(1, {
      browserSessionId: "s1",
      bounds: BOUNDS,
    });
    expect(mountBrowserAgentWebview).toHaveBeenNthCalledWith(2, {
      browserSessionId: "s2",
      bounds: BOUNDS,
    });
    expect(mountBrowserAgentWebview).toHaveBeenNthCalledWith(3, {
      browserSessionId: "s1",
      bounds: BOUNDS,
    });
    expect(syncBrowserAgentWebviewBounds).not.toHaveBeenCalled();
    expect(hideBrowserAgentWebview).not.toHaveBeenCalled();
  });

  it("旧 tab 的 cleanup 不会隐藏当前 tab 的 renderer", async () => {
    const {
      requestHideEmbeddedBrowserWebview,
      showEmbeddedBrowserWebview,
    } = await loadModule();

    await showEmbeddedBrowserWebview("s1", BOUNDS);
    await showEmbeddedBrowserWebview("s2", BOUNDS);
    requestHideEmbeddedBrowserWebview("s1");
    await Promise.resolve();
    await Promise.resolve();

    expect(hideBrowserAgentWebview).not.toHaveBeenCalled();
  });

  it("临时隐藏后恢复同一 tab 时只 sync，不重新导航页面", async () => {
    const {
      requestHideEmbeddedBrowserWebview,
      showEmbeddedBrowserWebview,
    } = await loadModule();

    await showEmbeddedBrowserWebview("s1", BOUNDS);
    requestHideEmbeddedBrowserWebview("s1");
    await Promise.resolve();
    await Promise.resolve();

    await showEmbeddedBrowserWebview("s1", BOUNDS);

    expect(hideBrowserAgentWebview).toHaveBeenCalledWith("s1");
    expect(mountBrowserAgentWebview).toHaveBeenCalledTimes(1);
    expect(syncBrowserAgentWebviewBounds).toHaveBeenCalledWith("s1", BOUNDS);
  });

  it("并发 show 同一未挂载会话时按 mount 后 sync 串行收敛", async () => {
    const { showEmbeddedBrowserWebview } = await loadModule();

    // mount 挂起，制造并发窗口：第二次 show 必须在首次完成后走 sync。
    let resolveMount: ((value: unknown) => void) | undefined;
    mountBrowserAgentWebview.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMount = resolve;
        }),
    );

    const first = showEmbeddedBrowserWebview("s1", BOUNDS);
    const second = showEmbeddedBrowserWebview("s1", BOUNDS);

    // 冲刷微任务，让第一个 mount 进入 native 队列。
    await Promise.resolve();

    resolveMount?.({});
    await Promise.all([first, second]);

    expect(mountBrowserAgentWebview).toHaveBeenCalledTimes(1);
    expect(syncBrowserAgentWebviewBounds).toHaveBeenCalledTimes(1);
    expect(syncBrowserAgentWebviewBounds).toHaveBeenCalledWith("s1", BOUNDS);
  });

  it("forceRemount 时即使已挂载也重新 mount（同会话导航新 URL）", async () => {
    const { showEmbeddedBrowserWebview } = await loadModule();

    await showEmbeddedBrowserWebview("s1", BOUNDS);
    await showEmbeddedBrowserWebview("s1", BOUNDS, true);

    expect(mountBrowserAgentWebview).toHaveBeenCalledTimes(2);
    expect(syncBrowserAgentWebviewBounds).not.toHaveBeenCalled();
  });

  it("unmount 隐藏并注销记录，下次显示重新 mount", async () => {
    const { showEmbeddedBrowserWebview, unmountEmbeddedBrowserWebview } =
      await loadModule();

    await showEmbeddedBrowserWebview("s1", BOUNDS);
    unmountEmbeddedBrowserWebview("s1");
    await Promise.resolve();
    await Promise.resolve();

    expect(hideBrowserAgentWebview).toHaveBeenCalledWith("s1");

    await showEmbeddedBrowserWebview("s1", BOUNDS);

    expect(mountBrowserAgentWebview).toHaveBeenCalledTimes(2);
  });

  it("measureEmbeddedWebviewContainer 对空容器/过小矩形返回 null", async () => {
    const { measureEmbeddedWebviewContainer } = await loadModule();

    expect(measureEmbeddedWebviewContainer(null)).toBeNull();

    const tiny = {
      getBoundingClientRect: () => ({
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      }),
    } as unknown as HTMLElement;
    expect(measureEmbeddedWebviewContainer(tiny)).toBeNull();

    const normal = {
      getBoundingClientRect: () => ({
        x: 5,
        y: 6,
        width: 300,
        height: 200,
      }),
    } as unknown as HTMLElement;
    expect(measureEmbeddedWebviewContainer(normal)).toEqual({
      x: 5,
      y: 6,
      width: 300,
      height: 200,
    });
  });
});
