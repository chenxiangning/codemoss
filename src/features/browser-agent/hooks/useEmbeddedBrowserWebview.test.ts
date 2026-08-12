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
