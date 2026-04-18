import { describe, expect, it } from "vitest";
import {
  normalizeRuntimeReconnectErrorMessage,
  resolveRuntimeReconnectHint,
} from "./runtimeReconnect";

describe("resolveRuntimeReconnectHint", () => {
  it("matches POSIX and Windows pipe disconnect errors", () => {
    expect(resolveRuntimeReconnectHint("Broken pipe (os error 32)")).toEqual({
      reason: "broken-pipe",
      rawMessage: "Broken pipe (os error 32)",
    });
    expect(resolveRuntimeReconnectHint("The pipe is being closed. (os error 232)")).toEqual({
      reason: "broken-pipe",
      rawMessage: "The pipe is being closed. (os error 232)",
    });
  });

  it("matches workspace disconnect errors and ignores unrelated text", () => {
    expect(resolveRuntimeReconnectHint("workspace not connected")).toEqual({
      reason: "workspace-not-connected",
      rawMessage: "workspace not connected",
    });
    expect(resolveRuntimeReconnectHint("request timed out")).toBeNull();
  });

  it("ignores long assistant replies that only quote runtime disconnect text", () => {
    expect(
      resolveRuntimeReconnectHint(
        "Broken pipe (os error 32)\n\n结论先行：这是一次 stale session 问题，需要后端重建。",
      ),
    ).toBeNull();
  });

  it("keeps reconnect detection for repeated raw error lines", () => {
    expect(
      resolveRuntimeReconnectHint("Broken pipe (os error 32)\nBroken pipe (os error 32)"),
    ).toEqual({
      reason: "broken-pipe",
      rawMessage: "Broken pipe (os error 32)",
    });
  });
});

describe("normalizeRuntimeReconnectErrorMessage", () => {
  it("normalizes unknown error input to a readable string", () => {
    expect(normalizeRuntimeReconnectErrorMessage(new Error("runtime gone"))).toBe("runtime gone");
    expect(normalizeRuntimeReconnectErrorMessage({ reason: "pipe closed" })).toBe('{"reason":"pipe closed"}');
  });
});
