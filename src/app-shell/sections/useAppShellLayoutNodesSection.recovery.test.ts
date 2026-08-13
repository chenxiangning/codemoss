import { describe, expect, it, vi } from "vitest";
import {
  continueStaleThreadBindingForManualRecovery,
  recoverThreadBindingAndResendForManualRecovery,
  recoverThreadBindingForManualRecovery,
  shouldSuppressManualRecoveryResendUserMessage,
} from "./manualThreadRecovery";

describe("continueStaleThreadBindingForManualRecovery", () => {
  it("returns forked when native fork succeeds", async () => {
    const forkThreadForWorkspace = vi.fn(async () => " thread-forked ");
    const startThreadForWorkspace = vi.fn(async () => "thread-fresh");

    const result = await continueStaleThreadBindingForManualRecovery({
      workspaceId: " ws-1 ",
      threadId: " thread-stale ",
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-stale", engineSource: "codex" }],
      },
      forkThreadForWorkspace,
      startThreadForWorkspace,
    });

    expect(result).toEqual({
      kind: "forked",
      threadId: "thread-forked",
      retryable: true,
      userAction: "start-fresh-thread",
    });
    expect(forkThreadForWorkspace).toHaveBeenCalledWith("ws-1", "thread-stale", {
      activate: true,
    });
    expect(startThreadForWorkspace).not.toHaveBeenCalled();
  });

  it("falls back to fresh when native fork returns null for a dead parent", async () => {
    const forkThreadForWorkspace = vi.fn(async () => null);
    const startThreadForWorkspace = vi.fn(async () => " thread-fresh ");

    const result = await continueStaleThreadBindingForManualRecovery({
      workspaceId: "ws-1",
      threadId: "thread-stale",
      threadsByWorkspace: {
        "ws-1": [
          {
            id: "thread-stale",
            engineSource: "codex",
            providerProfileId: "provider-a",
          },
        ],
      },
      forkThreadForWorkspace,
      startThreadForWorkspace,
    });

    expect(result).toEqual({
      kind: "fresh",
      threadId: "thread-fresh",
      retryable: true,
      userAction: "start-fresh-thread",
    });
    expect(forkThreadForWorkspace).toHaveBeenCalledWith("ws-1", "thread-stale", {
      activate: true,
      providerProfileId: "provider-a",
    });
    expect(startThreadForWorkspace).toHaveBeenCalledWith("ws-1", {
      activate: true,
      engine: "codex",
      providerProfileId: "provider-a",
    });
  });

  it("falls back to fresh when native fork throws thread not found", async () => {
    const forkThreadForWorkspace = vi.fn(async () => {
      throw new Error("thread not found: thread-stale");
    });
    const startThreadForWorkspace = vi.fn(async () => "thread-fresh");

    const result = await continueStaleThreadBindingForManualRecovery({
      workspaceId: "ws-1",
      threadId: "thread-stale",
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-stale", engineSource: "codex" }],
      },
      forkThreadForWorkspace,
      startThreadForWorkspace,
    });

    expect(result).toEqual({
      kind: "fresh",
      threadId: "thread-fresh",
      retryable: true,
      userAction: "start-fresh-thread",
    });
  });

  it("surfaces failed when both fork and fresh are unavailable", async () => {
    const forkThreadForWorkspace = vi.fn(async () => null);
    const startThreadForWorkspace = vi.fn(async () => null);

    const result = await continueStaleThreadBindingForManualRecovery({
      workspaceId: "ws-1",
      threadId: "thread-stale",
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-stale", engineSource: "codex" }],
      },
      forkThreadForWorkspace,
      startThreadForWorkspace,
    });

    expect(result).toEqual({
      kind: "failed",
      reason: "fresh thread unavailable",
      retryable: true,
      userAction: "start-fresh-thread",
    });
  });

  it("surfaces the fresh error when fresh thread start throws", async () => {
    const forkThreadForWorkspace = vi.fn(async () => null);
    const startThreadForWorkspace = vi.fn(async () => {
      throw new Error("runtime unavailable");
    });

    const result = await continueStaleThreadBindingForManualRecovery({
      workspaceId: "ws-1",
      threadId: "thread-stale",
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-stale", engineSource: "codex" }],
      },
      forkThreadForWorkspace,
      startThreadForWorkspace,
    });

    expect(result).toEqual({
      kind: "failed",
      reason: "runtime unavailable",
      retryable: true,
      userAction: "start-fresh-thread",
    });
  });

  it("starts fresh directly when no fork primitive is provided", async () => {
    const startThreadForWorkspace = vi.fn(async () => "thread-fresh");

    const result = await continueStaleThreadBindingForManualRecovery({
      workspaceId: "ws-1",
      threadId: "thread-stale",
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-stale", engineSource: "codex" }],
      },
      startThreadForWorkspace,
    });

    expect(result).toEqual({
      kind: "fresh",
      threadId: "thread-fresh",
      retryable: true,
      userAction: "start-fresh-thread",
    });
    expect(startThreadForWorkspace).toHaveBeenCalledWith("ws-1", {
      activate: true,
      engine: "codex",
    });
  });
});

describe("recoverThreadBindingForManualRecovery", () => {
  it("returns the rebound thread when refresh succeeds", async () => {
    const refreshThread = vi.fn(async () => "thread-recovered");
    const startThreadForWorkspace = vi.fn(async () => "thread-fresh");

    const result = await recoverThreadBindingForManualRecovery({
      workspaceId: "ws-1",
      threadId: "thread-stale",
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-stale", engineSource: "codex" }],
      },
      refreshThread,
      startThreadForWorkspace,
    });

    expect(result).toEqual({
      kind: "rebound",
      threadId: "thread-recovered",
      retryable: false,
      userAction: "retry",
    });
    expect(refreshThread).toHaveBeenCalledWith("ws-1", "thread-stale");
    expect(startThreadForWorkspace).not.toHaveBeenCalled();
  });

  it("does not start a fresh codex thread unless explicit continuation is allowed", async () => {
    const refreshThread = vi.fn(async () => null);
    const startThreadForWorkspace = vi.fn(async () => "thread-fresh");

    const result = await recoverThreadBindingForManualRecovery({
      workspaceId: "ws-1",
      threadId: "thread-stale",
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-stale", engineSource: "codex" }],
      },
      refreshThread,
      startThreadForWorkspace,
    });

    expect(result).toEqual({
      kind: "failed",
      reason: "no verified replacement thread",
      retryable: true,
      userAction: "recover-thread",
    });
    expect(startThreadForWorkspace).not.toHaveBeenCalled();
  });

  it("starts a fresh codex thread when explicit fresh continuation is allowed", async () => {
    const refreshThread = vi.fn(async () => null);
    const startThreadForWorkspace = vi.fn(async () => "thread-fresh");

    const result = await recoverThreadBindingForManualRecovery({
      workspaceId: "ws-1",
      threadId: "thread-stale",
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-stale", engineSource: "codex" }],
      },
      refreshThread,
      startThreadForWorkspace,
      allowFreshThread: true,
    });

    expect(result).toEqual({
      kind: "fresh",
      threadId: "thread-fresh",
      retryable: true,
      userAction: "start-fresh-thread",
    });
    expect(startThreadForWorkspace).toHaveBeenCalledWith("ws-1", {
      activate: true,
      engine: "codex",
    });
  });

  it("keeps the engine family when stale non-codex recovery falls back to a fresh thread", async () => {
    const refreshThread = vi.fn(async () => null);
    const startThreadForWorkspace = vi.fn(async () => "claude-pending-new");

    const result = await recoverThreadBindingForManualRecovery({
      workspaceId: "ws-1",
      threadId: "claude:session-stale",
      threadsByWorkspace: {
        "ws-1": [
          {
            id: "claude:session-stale",
            engineSource: "claude",
          },
        ],
      },
      refreshThread,
      startThreadForWorkspace,
      allowFreshThread: true,
    });

    expect(result).toEqual({
      kind: "fresh",
      threadId: "claude-pending-new",
      retryable: true,
      userAction: "start-fresh-thread",
    });
    expect(startThreadForWorkspace).toHaveBeenCalledWith("ws-1", {
      activate: true,
      engine: "claude",
    });
  });

  it("rejects Gemini recovery before refresh or fresh-thread creation", async () => {
    const refreshThread = vi.fn(async () => "gemini:recovered");
    const startThreadForWorkspace = vi.fn(async () => "gemini-pending-new");

    const result = await recoverThreadBindingForManualRecovery({
      workspaceId: "ws-1",
      threadId: "gemini:session-stale",
      threadsByWorkspace: {
        "ws-1": [
          {
            id: "gemini:session-stale",
            engineSource: "gemini",
          },
        ],
      },
      refreshThread,
      startThreadForWorkspace,
      allowFreshThread: true,
    });

    expect(result).toEqual({
      kind: "failed",
      reason: "unsupported_engine",
      retryable: true,
      userAction: "start-fresh-thread",
    });
    expect(refreshThread).not.toHaveBeenCalled();
    expect(startThreadForWorkspace).not.toHaveBeenCalled();
  });

  it("falls back to a fresh thread when refresh rejects", async () => {
    const refreshThread = vi.fn(async () => {
      throw new Error("thread not found: thread-stale");
    });
    const startThreadForWorkspace = vi.fn(async () => " thread-fresh ");

    const result = await recoverThreadBindingForManualRecovery({
      workspaceId: "ws-1",
      threadId: "thread-stale",
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-stale", engineSource: "codex" }],
      },
      refreshThread,
      startThreadForWorkspace,
      allowFreshThread: true,
    });

    expect(result).toEqual({
      kind: "fresh",
      threadId: "thread-fresh",
      retryable: true,
      userAction: "start-fresh-thread",
    });
    expect(startThreadForWorkspace).toHaveBeenCalledWith("ws-1", {
      activate: true,
      engine: "codex",
    });
  });

  it("does not create a fresh thread when recover-only disallows fresh fallback", async () => {
    const refreshThread = vi.fn(async () => null);
    const startThreadForWorkspace = vi.fn(async () => "thread-fresh");

    const result = await recoverThreadBindingForManualRecovery({
      workspaceId: "ws-1",
      threadId: "thread-stale",
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-stale", engineSource: "codex" }],
      },
      refreshThread,
      startThreadForWorkspace,
      allowFreshThread: false,
    });

    expect(result).toEqual({
      kind: "failed",
      reason: "no verified replacement thread",
      retryable: true,
      userAction: "recover-thread",
    });
    expect(startThreadForWorkspace).not.toHaveBeenCalled();
  });

  it("keeps the refresh error when recover-only cannot verify a replacement thread", async () => {
    const refreshThread = vi.fn(async () => {
      throw new Error("thread not found: thread-stale");
    });
    const startThreadForWorkspace = vi.fn(async () => "thread-fresh");

    const result = await recoverThreadBindingForManualRecovery({
      workspaceId: "ws-1",
      threadId: "thread-stale",
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-stale", engineSource: "codex" }],
      },
      refreshThread,
      startThreadForWorkspace,
      allowFreshThread: false,
    });

    expect(result).toEqual({
      kind: "failed",
      reason: "thread not found: thread-stale",
      retryable: true,
      userAction: "recover-thread",
    });
    expect(startThreadForWorkspace).not.toHaveBeenCalled();
  });

  it("fails before runtime calls when required ids are empty", async () => {
    const refreshThread = vi.fn(async () => "thread-recovered");
    const startThreadForWorkspace = vi.fn(async () => "thread-fresh");

    const result = await recoverThreadBindingForManualRecovery({
      workspaceId: "ws-1",
      threadId: " ",
      threadsByWorkspace: {},
      refreshThread,
      startThreadForWorkspace,
    });

    expect(result).toEqual({
      kind: "failed",
      reason: "missing workspace or thread id",
      retryable: true,
      userAction: "recover-thread",
    });
    expect(refreshThread).not.toHaveBeenCalled();
    expect(startThreadForWorkspace).not.toHaveBeenCalled();
  });

  it("returns failed when fresh thread creation fails", async () => {
    const refreshThread = vi.fn(async () => null);
    const startThreadForWorkspace = vi.fn(async () => {
      throw new Error("runtime unavailable");
    });

    const result = await recoverThreadBindingForManualRecovery({
      workspaceId: "ws-1",
      threadId: "thread-stale",
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-stale", engineSource: "codex" }],
      },
      refreshThread,
      startThreadForWorkspace,
      allowFreshThread: true,
    });

    expect(result).toEqual({
      kind: "failed",
      reason: "runtime unavailable",
      retryable: true,
      userAction: "start-fresh-thread",
    });
  });

  it("suppresses replayed user message only for rebound resend", () => {
    expect(
      shouldSuppressManualRecoveryResendUserMessage({
        kind: "rebound",
        threadId: "thread-recovered",
        retryable: false,
        userAction: "retry",
      }),
    ).toBe(true);
    expect(
      shouldSuppressManualRecoveryResendUserMessage({
        kind: "fresh",
        threadId: "thread-fresh",
        retryable: true,
        userAction: "start-fresh-thread",
      }),
    ).toBe(false);
    expect(
      shouldSuppressManualRecoveryResendUserMessage({
        kind: "forked",
        threadId: "thread-forked",
        retryable: true,
        userAction: "start-fresh-thread",
      }),
    ).toBe(false);
  });
});

describe("recoverThreadBindingAndResendForManualRecovery", () => {
  const connectedWorkspace = {
    id: "ws-1",
    connected: true,
  };
  const disconnectedWorkspace = {
    id: "ws-1",
    connected: false,
  };

  it("rejects Gemini resend recovery before any owner side effect", async () => {
    const resolveWorkspace = vi.fn(() => connectedWorkspace);
    const refreshThread = vi.fn(async () => "gemini:rebound");
    const startThreadForWorkspace = vi.fn(async () => "gemini-pending-new");
    const connectWorkspace = vi.fn(async () => undefined);
    const sendUserMessageToThread = vi.fn(async () => undefined);

    const result = await recoverThreadBindingAndResendForManualRecovery({
      workspaceId: "ws-1",
      threadId: "gemini:session-stale",
      message: { text: "继续" },
      threadsByWorkspace: {
        "ws-1": [
          {
            id: "gemini:session-stale",
            engineSource: "gemini",
          },
        ],
      },
      resolveWorkspace,
      refreshThread,
      startThreadForWorkspace,
      connectWorkspace,
      sendUserMessageToThread,
    });

    expect(result).toEqual({
      kind: "failed",
      reason: "unsupported_engine",
      retryable: true,
      userAction: "start-fresh-thread",
    });
    expect(resolveWorkspace).not.toHaveBeenCalled();
    expect(refreshThread).not.toHaveBeenCalled();
    expect(startThreadForWorkspace).not.toHaveBeenCalled();
    expect(connectWorkspace).not.toHaveBeenCalled();
    expect(sendUserMessageToThread).not.toHaveBeenCalled();
  });

  it("resends to a forked codex thread when historical stale recovery cannot rebind", async () => {
    const resolveWorkspace = vi.fn(() => disconnectedWorkspace);
    const refreshThread = vi.fn(async () => {
      throw new Error("thread not found: thread-stale");
    });
    const startThreadForWorkspace = vi.fn(async () => " thread-fresh ");
    const forkThreadForWorkspace = vi.fn(async () => " thread-forked ");
    const connectWorkspace = vi.fn(async () => undefined);
    const sendUserMessageToThread = vi.fn(async () => undefined);

    const result = await recoverThreadBindingAndResendForManualRecovery({
      workspaceId: " ws-1 ",
      threadId: " thread-stale ",
      message: {
        text: " 继续 ",
      },
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-stale", engineSource: "codex" }],
      },
      resolveWorkspace,
      refreshThread,
      startThreadForWorkspace,
      forkThreadForWorkspace,
      connectWorkspace,
      sendUserMessageToThread,
    });

    expect(result).toEqual({
      kind: "forked",
      threadId: "thread-forked",
      retryable: true,
      userAction: "start-fresh-thread",
    });
    expect(resolveWorkspace).toHaveBeenCalledWith("ws-1");
    expect(refreshThread).toHaveBeenCalledWith("ws-1", "thread-stale");
    expect(forkThreadForWorkspace).toHaveBeenCalledWith("ws-1", "thread-stale", {
      activate: true,
    });
    expect(startThreadForWorkspace).not.toHaveBeenCalled();
    expect(connectWorkspace).toHaveBeenCalledWith(disconnectedWorkspace);
    expect(sendUserMessageToThread).toHaveBeenCalledWith(
      disconnectedWorkspace,
      "thread-forked",
      "继续",
      [],
      {
        suppressUserMessageRender: false,
        skipOptimisticUserBubble: false,
      },
    );
  });

  it("falls back to a fresh codex thread when stale fork is unavailable", async () => {
    const refreshThread = vi.fn(async () => null);
    const startThreadForWorkspace = vi.fn(async () => "thread-fresh");
    const forkThreadForWorkspace = vi.fn(async () => null);
    const sendUserMessageToThread = vi.fn(async () => undefined);

    const result = await recoverThreadBindingAndResendForManualRecovery({
      workspaceId: "ws-1",
      threadId: "thread-stale",
      message: {
        text: "继续",
      },
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-stale", engineSource: "codex" }],
      },
      resolveWorkspace: vi.fn(() => connectedWorkspace),
      refreshThread,
      startThreadForWorkspace,
      forkThreadForWorkspace,
      connectWorkspace: vi.fn(async () => undefined),
      sendUserMessageToThread,
    });

    expect(result).toEqual({
      kind: "fresh",
      threadId: "thread-fresh",
      retryable: true,
      userAction: "start-fresh-thread",
    });
    expect(forkThreadForWorkspace).toHaveBeenCalledWith("ws-1", "thread-stale", {
      activate: true,
    });
    expect(startThreadForWorkspace).toHaveBeenCalledWith("ws-1", {
      activate: true,
      engine: "codex",
    });
    expect(sendUserMessageToThread).toHaveBeenCalledWith(
      connectedWorkspace,
      "thread-fresh",
      "继续",
      [],
      {
        suppressUserMessageRender: false,
        skipOptimisticUserBubble: false,
      },
    );
  });

  it("resends to a rebound thread and suppresses the duplicate user bubble", async () => {
    const resolveWorkspace = vi.fn(() => connectedWorkspace);
    const refreshThread = vi.fn(async () => "thread-rebound");
    const startThreadForWorkspace = vi.fn(async () => "thread-fresh");
    const connectWorkspace = vi.fn(async () => undefined);
    const sendUserMessageToThread = vi.fn(async () => undefined);

    const result = await recoverThreadBindingAndResendForManualRecovery({
      workspaceId: "ws-1",
      threadId: "thread-stale",
      message: {
        text: "继续",
        images: ["image-a.png"],
      },
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-stale", engineSource: "codex" }],
      },
      resolveWorkspace,
      refreshThread,
      startThreadForWorkspace,
      connectWorkspace,
      sendUserMessageToThread,
    });

    expect(result).toEqual({
      kind: "rebound",
      threadId: "thread-rebound",
      retryable: false,
      userAction: "retry",
    });
    expect(startThreadForWorkspace).not.toHaveBeenCalled();
    expect(connectWorkspace).not.toHaveBeenCalled();
    expect(sendUserMessageToThread).toHaveBeenCalledWith(
      connectedWorkspace,
      "thread-rebound",
      "继续",
      ["image-a.png"],
      {
        suppressUserMessageRender: true,
        skipOptimisticUserBubble: true,
      },
    );
  });

  it("fails before recovery when workspace lookup misses", async () => {
    const refreshThread = vi.fn(async () => "thread-rebound");
    const startThreadForWorkspace = vi.fn(async () => "thread-fresh");
    const sendUserMessageToThread = vi.fn(async () => undefined);

    const result = await recoverThreadBindingAndResendForManualRecovery({
      workspaceId: "ws-missing",
      threadId: "thread-stale",
      message: {
        text: "继续",
      },
      threadsByWorkspace: {},
      resolveWorkspace: vi.fn(() => null),
      refreshThread,
      startThreadForWorkspace,
      connectWorkspace: vi.fn(async () => undefined),
      sendUserMessageToThread,
    });

    expect(result).toEqual({
      kind: "failed",
      reason: "workspace unavailable",
      retryable: true,
      userAction: "start-fresh-thread",
    });
    expect(refreshThread).not.toHaveBeenCalled();
    expect(startThreadForWorkspace).not.toHaveBeenCalled();
    expect(sendUserMessageToThread).not.toHaveBeenCalled();
  });

  it("fails before recovery when there is no prompt or image to resend", async () => {
    const refreshThread = vi.fn(async () => "thread-rebound");
    const startThreadForWorkspace = vi.fn(async () => "thread-fresh");

    const result = await recoverThreadBindingAndResendForManualRecovery({
      workspaceId: "ws-1",
      threadId: "thread-stale",
      message: {
        text: " ",
        images: [],
      },
      threadsByWorkspace: {},
      resolveWorkspace: vi.fn(() => connectedWorkspace),
      refreshThread,
      startThreadForWorkspace,
      connectWorkspace: vi.fn(async () => undefined),
      sendUserMessageToThread: vi.fn(async () => undefined),
    });

    expect(result).toEqual({
      kind: "failed",
      reason: "missing message to resend",
      retryable: true,
      userAction: "start-fresh-thread",
    });
    expect(refreshThread).not.toHaveBeenCalled();
    expect(startThreadForWorkspace).not.toHaveBeenCalled();
  });

  it("returns a failed result when resend throws after recovery", async () => {
    const refreshThread = vi.fn(async () => null);
    const startThreadForWorkspace = vi.fn(async () => "thread-fresh");

    const result = await recoverThreadBindingAndResendForManualRecovery({
      workspaceId: "ws-1",
      threadId: "thread-stale",
      message: {
        text: "继续",
      },
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-stale", engineSource: "codex" }],
      },
      resolveWorkspace: vi.fn(() => connectedWorkspace),
      refreshThread,
      startThreadForWorkspace,
      connectWorkspace: vi.fn(async () => undefined),
      sendUserMessageToThread: vi.fn(async () => {
        throw new Error("send failed");
      }),
    });

    expect(result).toEqual({
      kind: "failed",
      reason: "send failed",
      retryable: true,
      userAction: "start-fresh-thread",
    });
  });
});
