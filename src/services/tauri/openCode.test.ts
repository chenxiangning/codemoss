import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  getOpenCodeSessionList,
  isOpenCodeCliUnavailableError,
  resetOpenCodeSessionListCacheForTests,
} from "./openCode";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("isOpenCodeCliUnavailableError", () => {
  it("matches known unavailability diagnostics", () => {
    expect(isOpenCodeCliUnavailableError("OpenCode CLI not found")).toBe(true);
    expect(
      isOpenCodeCliUnavailableError(
        "OpenCode CLI is disabled in CLI validation settings",
      ),
    ).toBe(true);
    expect(
      isOpenCodeCliUnavailableError(
        "Engine is disabled in CLI validation settings",
      ),
    ).toBe(true);
    expect(
      isOpenCodeCliUnavailableError(
        "[OPENCODE_CLI_UNSAFE] Resolved OpenCode binary is not safe",
      ),
    ).toBe(true);
  });

  it("does not match real execution failures", () => {
    expect(
      isOpenCodeCliUnavailableError("opencode session list failed: boom"),
    ).toBe(false);
  });
});

describe("getOpenCodeSessionList", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    resetOpenCodeSessionListCacheForTests();
  });

  it("returns sessions when OpenCode CLI is available", async () => {
    vi.mocked(invoke).mockResolvedValue([
      {
        sessionId: "s1",
        title: "Demo",
        updatedLabel: "1h ago",
        updatedAt: 1,
      },
    ]);

    await expect(getOpenCodeSessionList("ws-1")).resolves.toEqual([
      {
        sessionId: "s1",
        title: "Demo",
        updatedLabel: "1h ago",
        updatedAt: 1,
      },
    ]);
    expect(invoke).toHaveBeenCalledWith("opencode_session_list", {
      workspaceId: "ws-1",
    });
  });

  it("reuses TTL cache so a second list does not re-invoke CLI", async () => {
    vi.mocked(invoke).mockResolvedValue([
      {
        sessionId: "s1",
        title: "Demo",
        updatedLabel: "1h ago",
        updatedAt: 1,
      },
    ]);

    await getOpenCodeSessionList("ws-1");
    await getOpenCodeSessionList("ws-1");

    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent lists into one in-flight invoke", async () => {
    let resolveInvoke: ((value: unknown) => void) | undefined;
    vi.mocked(invoke).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInvoke = resolve;
        }),
    );

    const a = getOpenCodeSessionList("ws-1");
    const b = getOpenCodeSessionList("ws-1");
    expect(invoke).toHaveBeenCalledTimes(1);

    expect(resolveInvoke).toBeTypeOf("function");
    resolveInvoke!([
      {
        sessionId: "s1",
        title: "Demo",
        updatedLabel: "1h ago",
        updatedAt: 1,
      },
    ]);

    await expect(a).resolves.toEqual([
      expect.objectContaining({ sessionId: "s1" }),
    ]);
    await expect(b).resolves.toEqual([
      expect.objectContaining({ sessionId: "s1" }),
    ]);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("treats missing OpenCode CLI as an empty session list (no throw)", async () => {
    vi.mocked(invoke).mockRejectedValue("OpenCode CLI not found");

    await expect(getOpenCodeSessionList("ws-1")).resolves.toEqual([]);
  });

  it("treats disabled OpenCode engine settings as an empty session list", async () => {
    vi.mocked(invoke).mockRejectedValue(
      "OpenCode CLI is disabled in CLI validation settings",
    );

    await expect(getOpenCodeSessionList("ws-1")).resolves.toEqual([]);
  });

  it("treats generic disabled-engine diagnostics as empty session list", async () => {
    vi.mocked(invoke).mockRejectedValue(
      "Engine is disabled in CLI validation settings",
    );

    await expect(getOpenCodeSessionList("ws-1")).resolves.toEqual([]);
  });

  it("treats Windows unsafe OpenCode binary probe failures as empty", async () => {
    vi.mocked(invoke).mockRejectedValue(
      "[OPENCODE_CLI_UNSAFE] Resolved OpenCode binary is not safe for background CLI probing on Windows: C:\\opencode.exe",
    );

    await expect(getOpenCodeSessionList("ws-1")).resolves.toEqual([]);
  });

  it("still surfaces unexpected session-list failures", async () => {
    vi.mocked(invoke).mockRejectedValue(
      "opencode session list failed: permission denied",
    );

    await expect(getOpenCodeSessionList("ws-1")).rejects.toMatch(
      /permission denied/,
    );
  });

  it("honors timeoutMs budget and returns empty without waiting forever", async () => {
    vi.mocked(invoke).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([{ sessionId: "late" }]), 500);
        }),
    );
    await expect(
      getOpenCodeSessionList("ws-1", { timeoutMs: 30 }),
    ).resolves.toEqual([]);
  }, 5_000);

  it("does not cache timeout empties so a later call can still load", async () => {
    vi.mocked(invoke)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve([{ sessionId: "late" }]), 200);
          }),
      )
      .mockResolvedValueOnce([
        {
          sessionId: "s1",
          title: "Demo",
          updatedLabel: "1h ago",
          updatedAt: 1,
        },
      ]);

    await expect(
      getOpenCodeSessionList("ws-1", { timeoutMs: 20 }),
    ).resolves.toEqual([]);
    await expect(getOpenCodeSessionList("ws-1")).resolves.toEqual([
      expect.objectContaining({ sessionId: "s1" }),
    ]);
    expect(invoke).toHaveBeenCalledTimes(2);
  }, 5_000);
});
