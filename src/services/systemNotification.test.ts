import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
const isTauriMock = vi.fn(() => true);
const sendPluginNotificationMock = vi.fn();
const onActionMock = vi.fn(async () => ({}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...(args as [])),
  isTauri: () => isTauriMock(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    show: vi.fn(),
    setFocus: vi.fn(),
  }),
}));

vi.mock("@tauri-apps/plugin-notification", () => ({
  onAction: (...args: unknown[]) => onActionMock(...(args as [])),
  sendNotification: (...args: unknown[]) =>
    sendPluginNotificationMock(...(args as [])),
}));

describe("systemNotification", () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
    isTauriMock.mockReset();
    isTauriMock.mockReturnValue(true);
    sendPluginNotificationMock.mockReset();
    onActionMock.mockReset();
    onActionMock.mockResolvedValue({});
  });

  it("requests permission through the native command", async () => {
    invokeMock.mockResolvedValueOnce({ status: "authorized", canSend: true });
    const { requestSystemNotificationPermission } = await import("./systemNotification");
    const state = await requestSystemNotificationPermission();
    expect(invokeMock).toHaveBeenCalledWith("system_notification_request_permission");
    expect(state).toEqual({ status: "authorized", canSend: true });
  });

  it("sends notifications through the native command first", async () => {
    invokeMock.mockResolvedValueOnce(undefined);
    const { sendSystemNotification } = await import("./systemNotification");
    await sendSystemNotification({
      title: "会话执行完成",
      body: "项目: demo",
      extra: { workspaceId: "ws-1", threadId: "t-1" },
    });
    expect(invokeMock).toHaveBeenCalledWith("system_notification_send", {
      title: "会话执行完成",
      body: "项目: demo",
    });
    expect(sendPluginNotificationMock).not.toHaveBeenCalled();
  });

  it("falls back to the plugin when the native command fails", async () => {
    invokeMock.mockRejectedValueOnce(new Error("command missing"));
    const { sendSystemNotification } = await import("./systemNotification");
    await sendSystemNotification({
      title: "会话执行完成",
      body: "项目: demo",
      extra: { workspaceId: "ws-1" },
    });
    expect(sendPluginNotificationMock).toHaveBeenCalledWith({
      title: "会话执行完成",
      body: "项目: demo",
      extra: { workspaceId: "ws-1" },
    });
  });

  it("no-ops outside Tauri", async () => {
    isTauriMock.mockReturnValue(false);
    const { sendSystemNotification, requestSystemNotificationPermission } =
      await import("./systemNotification");
    await sendSystemNotification({ title: "x", body: "y" });
    const state = await requestSystemNotificationPermission();
    expect(invokeMock).not.toHaveBeenCalled();
    expect(state).toEqual({ status: "unsupported", canSend: false });
  });
});
