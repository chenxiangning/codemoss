import { describe, expect, it } from "vitest";

import {
  buildAgentCanvasThreadId,
  isAgentCanvasThreadId,
  parseAgentCanvasThreadId,
} from "./agentCanvasThread";

describe("agentCanvasThread", () => {
  it("builds and parses agent-canvas thread ids", () => {
    const id = buildAgentCanvasThreadId(
      "shared:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "attempt-stage-1",
    );
    expect(isAgentCanvasThreadId(id)).toBe(true);
    expect(parseAgentCanvasThreadId(id)).toEqual({
      sharedThreadId: "shared:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      attemptId: "attempt-stage-1",
    });
  });

  it("returns empty when inputs missing", () => {
    expect(buildAgentCanvasThreadId("", "a")).toBe("");
    expect(buildAgentCanvasThreadId("shared:x", "")).toBe("");
  });

  it("contract 3: canvas key embeds shared: thread prefix", () => {
    const sharedThreadId = "shared:bbbbbbbb-cccc-dddd-eeee-ffffffffffff";
    const attemptId = "attempt-implement-1";
    const id = buildAgentCanvasThreadId(sharedThreadId, attemptId);
    expect(id.startsWith("agent-canvas:shared:")).toBe(true);
    expect(id).toBe(`agent-canvas:${sharedThreadId}:${attemptId}`);
    const parsed = parseAgentCanvasThreadId(id);
    expect(parsed?.sharedThreadId.startsWith("shared:")).toBe(true);
    expect(parsed).toEqual({ sharedThreadId, attemptId });
  });

  it("contract 3: rejects non-shared canvas key shape on parse", () => {
    // 非 shared: 前缀不得被 parse 成协作 canvas 身份
    expect(parseAgentCanvasThreadId("agent-canvas:claude:uuid:attempt")).toBe(
      null,
    );
    expect(parseAgentCanvasThreadId("shared:only-main-thread")).toBe(null);
  });
});
